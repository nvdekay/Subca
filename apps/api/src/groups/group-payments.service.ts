import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  formatAmountVi,
  type CurrencyCode,
  type GroupDetailDto,
  type IsoDate,
} from '@subca/shared';
import { fromDbDate } from '../common/db-date.js';
import type {
  GroupCycle,
  GroupMember,
  GroupPayment,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GroupNotifier } from './group-notifier.service.js';
import {
  badRequest,
  GroupsService,
  isOpen,
  type GroupRow,
} from './groups.service.js';

/** Khoảng cách tối thiểu giữa 2 lần nhắc cùng một người, để không làm phiền. */
const REMIND_COOLDOWN_MS = 6 * 60 * 60 * 1000;

type PaymentRow = GroupPayment & { member: GroupMember; cycle: GroupCycle };

@Injectable()
export class GroupPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    private readonly notifier: GroupNotifier,
  ) {}

  /** Thành viên bấm "Tôi đã chuyển" — chủ nhóm xác nhận sau khi thấy tiền về. */
  async claim(
    userId: string,
    groupId: string,
    paymentId: string,
  ): Promise<GroupDetailDto> {
    const { group, me } = await this.groups.load(userId, groupId);
    const payment = await this.findPayment(group.id, paymentId);
    if (payment.memberId !== me.id) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'NOT_YOUR_PAYMENT',
        message: 'Đây không phải khoản của bạn',
      });
    }
    // Chỉ báo được một lần: bấm lại sẽ gửi push trùng cho chủ nhóm
    if (payment.status !== 'PENDING') {
      throw badRequest(
        'PAYMENT_ALREADY_DONE',
        payment.status === 'CLAIMED_PAID'
          ? 'Bạn đã báo đã chuyển, đang chờ chủ nhóm xác nhận'
          : 'Khoản này đã xong, không cần thao tác nữa',
      );
    }
    await this.prisma.groupPayment.update({
      where: { id: payment.id },
      data: { status: 'CLAIMED_PAID', claimedAt: new Date() },
    });
    await this.notifier.notify(group.ownerId, {
      groupId: group.id,
      title: `${me.displayName} đã chuyển ${this.money(group, payment)}`,
      body: `Nhóm ${group.name} · xác nhận khi bạn nhận được tiền.`,
    });
    return this.groups.get(userId, group.id);
  }

  /** Chủ nhóm bấm "Đã nhận". */
  async confirm(
    userId: string,
    groupId: string,
    paymentId: string,
  ): Promise<GroupDetailDto> {
    const { group } = await this.groups.loadAsOwner(userId, groupId);
    const payment = await this.findPayment(group.id, paymentId);
    if (payment.status !== 'CONFIRMED') {
      await this.prisma.groupPayment.update({
        where: { id: payment.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
      if (payment.member.userId) {
        await this.notifier.notify(payment.member.userId, {
          groupId: group.id,
          title: `Đã nhận ${this.money(group, payment)} của bạn`,
          body: `Nhóm ${group.name} · xong phần tháng ${monthOf(payment)} của bạn.`,
        });
      }
    }
    return this.groups.get(userId, group.id);
  }

  /** Chủ nhóm miễn phần của một thành viên trong kỳ này. */
  async waive(
    userId: string,
    groupId: string,
    paymentId: string,
  ): Promise<GroupDetailDto> {
    const { group } = await this.groups.loadAsOwner(userId, groupId);
    const payment = await this.findPayment(group.id, paymentId);
    if (payment.status !== 'WAIVED') {
      await this.prisma.groupPayment.update({
        where: { id: payment.id },
        data: { status: 'WAIVED', confirmedAt: null, claimedAt: null },
      });
      if (payment.member.userId) {
        await this.notifier.notify(payment.member.userId, {
          groupId: group.id,
          title: `Bạn được miễn phần tháng ${monthOf(payment)}`,
          body: `Nhóm ${group.name} · không cần chuyển tiền kỳ này.`,
        });
      }
    }
    return this.groups.get(userId, group.id);
  }

  /** Chủ nhóm bấm nhầm thì mở lại khoản để thu tiếp. */
  async reopen(
    userId: string,
    groupId: string,
    paymentId: string,
  ): Promise<GroupDetailDto> {
    const { group } = await this.groups.loadAsOwner(userId, groupId);
    const payment = await this.findPayment(group.id, paymentId);
    await this.prisma.groupPayment.update({
      where: { id: payment.id },
      data: { status: 'PENDING', claimedAt: null, confirmedAt: null },
    });
    return this.groups.get(userId, group.id);
  }

  /** Nhắc một thành viên chưa trả. */
  async remind(
    userId: string,
    groupId: string,
    paymentId: string,
  ): Promise<GroupDetailDto> {
    const { group, me } = await this.groups.loadAsOwner(userId, groupId);
    const payment = await this.findPayment(group.id, paymentId);
    this.assertOpen(payment);
    if (!payment.member.userId) {
      throw badRequest(
        'MEMBER_NOT_JOINED',
        'Thành viên chưa tham gia nhóm. Gửi lại link mời để họ nhận nhắc.',
      );
    }
    if (isOnCooldown(payment)) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'REMIND_TOO_SOON',
          message: 'Vừa nhắc xong, chờ vài giờ rồi nhắc lại.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.sendReminder(group, me, payment);
    return this.groups.get(userId, group.id);
  }

  /** Nhắc mọi thành viên chưa trả trong kỳ đang thu. */
  async remindAll(
    userId: string,
    groupId: string,
  ): Promise<{ reminded: number; skipped: number }> {
    const { group, me } = await this.groups.loadAsOwner(userId, groupId);
    // Kỳ mới nhất = kỳ đang thu (đã được tạo khi mở màn nhóm)
    const cycle = await this.prisma.groupCycle.findFirst({
      where: { groupId: group.id },
      orderBy: { period: 'desc' },
      include: { payments: { include: { member: true, cycle: true } } },
    });
    if (!cycle) return { reminded: 0, skipped: 0 };

    let reminded = 0;
    let skipped = 0;
    for (const payment of cycle.payments) {
      if (!isOpen(payment) || !payment.member.userId || isOnCooldown(payment)) {
        skipped++;
        continue;
      }
      await this.sendReminder(group, me, payment);
      reminded++;
    }
    return { reminded, skipped };
  }

  // ─────────────────────────────────────────────

  private async sendReminder(
    group: GroupRow,
    owner: GroupMember,
    payment: PaymentRow,
  ): Promise<void> {
    await this.prisma.groupPayment.update({
      where: { id: payment.id },
      data: { lastRemindedAt: new Date() },
    });
    await this.notifier.notify(payment.member.userId!, {
      groupId: group.id,
      title: `Bạn chưa trả ${owner.displayName} ${this.money(group, payment)}`,
      body: `Nhóm ${group.name} · hạn ${ddmm(fromDbDate(payment.cycle.dueDate))}.`,
    });
  }

  private async findPayment(
    groupId: string,
    paymentId: string,
  ): Promise<PaymentRow> {
    const payment = await this.prisma.groupPayment.findFirst({
      where: { id: paymentId, groupId },
      include: { member: true, cycle: true },
    });
    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'GROUP_PAYMENT_NOT_FOUND',
        message: 'Không tìm thấy khoản phải trả',
      });
    }
    return payment;
  }

  private assertOpen(payment: PaymentRow): void {
    if (!isOpen(payment)) {
      throw badRequest(
        'PAYMENT_ALREADY_DONE',
        'Khoản này đã xong, không cần thao tác nữa',
      );
    }
  }

  private money(group: GroupRow, payment: GroupPayment): string {
    return formatAmountVi(payment.amountMinor, group.currency as CurrencyCode);
  }
}

const isOnCooldown = (payment: GroupPayment): boolean =>
  payment.lastRemindedAt !== null &&
  Date.now() - payment.lastRemindedAt.getTime() < REMIND_COOLDOWN_MS;

const monthOf = (payment: PaymentRow): number =>
  Number(fromDbDate(payment.cycle.period).slice(5, 7));

const ddmm = (date: IsoDate): string =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}`;
