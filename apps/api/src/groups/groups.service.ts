import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  buildVietQrPayload,
  computeShares,
  groupTransferNote,
  inviteUrl,
  MAX_GROUP_MEMBERS,
  todayInTimeZone,
  type AddGroupMember,
  type CreateGroup,
  type CurrencyCode,
  type GroupCardDto,
  type GroupCycleDto,
  type GroupDetailDto,
  type GroupMemberDto,
  type GroupsOverviewDto,
  type IsoDate,
  type JoinGroup,
  type SetSplit,
  type UpdateGroup,
  type UpdateGroupMember,
} from '@subca/shared';
import { fromDbDate, toDbDate } from '../common/db-date.js';
import { FxService } from '../fx/fx.service.js';
import type {
  GroupCycle,
  GroupMember,
  GroupPayment,
  Prisma,
} from '../generated/prisma/client.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TIMEZONE,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';
import { dueDateOf, dueDayFromDate, periodOf, periodStart } from './cycle.js';
import { generateInviteCode } from './invite-code.js';

/** Trạng thái khoản phải trả mà chủ nhóm vẫn đang chờ tiền. */
const OPEN_STATUSES = ['PENDING', 'CLAIMED_PAID'] as const;

const groupInclude = {
  members: true,
  owner: { select: { displayName: true } },
  subscription: {
    select: {
      id: true,
      service: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoKey: true,
          brandColor: true,
        },
      },
    },
  },
} satisfies Prisma.GroupInclude;

export type GroupRow = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;
type CycleRow = GroupCycle & { payments: GroupPayment[] };

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plan: PlanService,
    private readonly fx: FxService,
  ) {}

  /** Màn Chia tiền nhóm: nhóm mình làm chủ, nhóm mình tham gia, tổng sẽ nhận / cần trả. */
  async overview(userId: string): Promise<GroupsOverviewDto> {
    const [groups, settings, ownedLimit] = await Promise.all([
      this.prisma.group.findMany({
        where: {
          archivedAt: null,
          members: { some: { userId, status: { not: 'LEFT' } } },
        },
        include: groupInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.settings(userId),
      this.plan.ownedGroupLimit(userId),
    ]);
    const today = todayInTimeZone(settings.timezone);
    const currency = settings.currency;
    const rates = await this.fx.rateTable(
      currency,
      groups.map((g) => g.currency),
      today,
    );

    const owned: GroupCardDto[] = [];
    const joined: GroupCardDto[] = [];
    const missing = new Set<CurrencyCode>();
    let incomingMinor = 0n;
    let incomingPeople = 0;
    let outgoingMinor = 0n;
    let outgoingGroups = 0;

    for (const group of groups) {
      const members = activeMembers(group);
      const me = members.find((m) => m.userId === userId);
      if (!me) continue;
      const shares = computeShares(
        group.totalAmountMinor,
        members,
        group.splitMode,
      );
      const cycle = await this.syncCycle(group, members, shares, today);
      const byMember = paymentsByMember(cycle);
      const isOwner = me.role === 'OWNER';
      const groupCurrency = group.currency as CurrencyCode;

      const add = (amountMinor: bigint): boolean => {
        const converted = rates.convert(amountMinor, groupCurrency);
        if (converted === null) {
          missing.add(groupCurrency);
          return false;
        }
        if (isOwner) incomingMinor += converted;
        else outgoingMinor += converted;
        return true;
      };

      if (isOwner) {
        // Chủ nhóm: còn chờ tiền của ai (đã báo chuyển nhưng chưa xác nhận vẫn tính là đang chờ)
        for (const p of cycle.payments) {
          if (!isOpen(p)) continue;
          if (add(p.amountMinor)) incomingPeople++;
        }
      } else {
        const mine = byMember.get(me.id);
        // Thành viên: đã báo "Tôi đã chuyển" thì coi như xong, không tính vào khoản cần trả
        if (mine && mine.status === 'PENDING' && add(mine.amountMinor)) {
          outgoingGroups++;
        }
      }

      const card = this.toCard(group, members, me, shares, cycle);
      (isOwner ? owned : joined).push(card);
    }

    return {
      currency,
      incomingMinor: incomingMinor.toString(),
      incomingPeople,
      outgoingMinor: outgoingMinor.toString(),
      outgoingGroups,
      owned,
      joined,
      ownedLimit,
      missingRates: [...missing],
    };
  }

  async get(userId: string, groupId: string): Promise<GroupDetailDto> {
    const { group } = await this.load(userId, groupId);
    return this.buildDetail(userId, group);
  }

  async create(userId: string, input: CreateGroup): Promise<GroupDetailDto> {
    await this.assertWithinGroupLimit(userId);
    const today = await this.today(userId);

    let name = input.name ?? null;
    let totalAmountMinor = input.totalAmountMinor
      ? BigInt(input.totalAmountMinor)
      : null;
    let currency = input.currency ?? null;
    let dueDay = input.dueDay ?? null;

    if (input.subscriptionId) {
      const sub = await this.prisma.subscription.findFirst({
        where: {
          id: input.subscriptionId,
          userId,
          status: { in: TRACKED_STATUSES },
        },
        include: {
          service: { select: { name: true } },
          group: { select: { id: true } },
        },
      });
      if (!sub) {
        throw badRequest(
          'INVALID_REFERENCE',
          'Không tìm thấy gói để chia',
          'subscriptionId',
        );
      }
      if (sub.group) {
        throw badRequest(
          'SUBSCRIPTION_ALREADY_IN_GROUP',
          'Gói này đang được chia ở một nhóm khác',
          'subscriptionId',
        );
      }
      name ??= sub.customName ?? sub.service?.name ?? 'Nhóm chia tiền';
      totalAmountMinor ??= sub.amountMinor;
      currency ??= sub.currency as CurrencyCode;
      dueDay ??= dueDayFromDate(
        sub.nextRenewalDate ? fromDbDate(sub.nextRenewalDate) : today,
      );
    }
    if (!name || totalAmountMinor === null || !currency) {
      throw badRequest(
        'VALIDATION_ERROR',
        'Thiếu tên hoặc giá gói',
        'totalAmountMinor',
      );
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    const otherNames = Array.from(
      { length: input.memberCount - 1 },
      (_, i) => input.memberNames?.[i] ?? 'Chờ tham gia',
    );

    const group = await this.prisma.group.create({
      data: {
        ownerId: userId,
        subscriptionId: input.subscriptionId ?? null,
        name,
        totalAmountMinor,
        currency,
        dueDay: dueDay ?? dueDayFromDate(today),
        maxMembers: input.memberCount,
        inviteCode: generateInviteCode(),
        ...payoutData(input.payout ?? null),
        members: {
          create: [
            {
              userId,
              displayName: profile?.displayName ?? 'Bạn',
              role: 'OWNER',
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
            ...otherNames.map((displayName) => ({ displayName })),
          ],
        },
      },
      include: groupInclude,
    });
    return this.buildDetail(userId, group);
  }

  async update(
    userId: string,
    groupId: string,
    input: UpdateGroup,
  ): Promise<GroupDetailDto> {
    const { group } = await this.loadAsOwner(userId, groupId);
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.totalAmountMinor !== undefined && {
          totalAmountMinor: BigInt(input.totalAmountMinor),
        }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.dueDay !== undefined && { dueDay: input.dueDay }),
        ...(input.payout !== undefined && payoutData(input.payout)),
      },
      include: groupInclude,
    });
    return this.buildDetail(userId, updated);
  }

  /** Xóa nhóm = lưu trữ: không hiện nữa, giữ lịch sử thu tiền. */
  async archive(userId: string, groupId: string): Promise<void> {
    const { group } = await this.loadAsOwner(userId, groupId);
    await this.prisma.group.update({
      where: { id: group.id },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Đổi cách chia. `CUSTOM` phải gửi phần của mọi thành viên và tổng khớp giá gói —
   * chia lệch thì nhóm sẽ thu thiếu hoặc thừa so với số tiền thật phải trả.
   */
  async setSplit(
    userId: string,
    groupId: string,
    input: SetSplit,
  ): Promise<GroupDetailDto> {
    const { group } = await this.loadAsOwner(userId, groupId);
    const members = activeMembers(group);

    if (input.splitMode === 'EQUAL') {
      await this.prisma.$transaction([
        this.prisma.group.update({
          where: { id: group.id },
          data: { splitMode: 'EQUAL' },
        }),
        this.prisma.groupMember.updateMany({
          where: { groupId: group.id },
          data: { customShareMinor: null },
        }),
      ]);
    } else {
      const ids = new Set(members.map((m) => m.id));
      if (
        input.shares.length !== members.length ||
        input.shares.some((s) => !ids.has(s.memberId))
      ) {
        throw badRequest(
          'VALIDATION_ERROR',
          'Phải gửi phần chia của đúng các thành viên trong nhóm',
          'shares',
        );
      }
      const sum = input.shares.reduce((a, s) => a + BigInt(s.amountMinor), 0n);
      if (sum !== group.totalAmountMinor) {
        const diff = group.totalAmountMinor - sum;
        throw badRequest(
          'SPLIT_TOTAL_MISMATCH',
          diff > 0n
            ? `Tổng các phần còn thiếu ${diff} so với giá gói`
            : `Tổng các phần đang dư ${-diff} so với giá gói`,
          'shares',
        );
      }
      await this.prisma.$transaction([
        this.prisma.group.update({
          where: { id: group.id },
          data: { splitMode: 'CUSTOM' },
        }),
        ...input.shares.map((s) =>
          this.prisma.groupMember.update({
            where: { id: s.memberId },
            data: { customShareMinor: BigInt(s.amountMinor) },
          }),
        ),
      ]);
    }
    return this.get(userId, groupId);
  }

  async addMember(
    userId: string,
    groupId: string,
    input: AddGroupMember,
  ): Promise<GroupDetailDto> {
    const { group } = await this.loadAsOwner(userId, groupId);
    const members = activeMembers(group);
    if (members.length >= Math.min(group.maxMembers, MAX_GROUP_MEMBERS)) {
      throw badRequest(
        'GROUP_FULL',
        `Nhóm chỉ có ${group.maxMembers} chỗ. Tăng số người trong phần cài đặt nhóm nếu gói cho phép.`,
      );
    }
    await this.prisma.groupMember.create({
      data: { groupId: group.id, displayName: input.displayName },
    });
    return this.get(userId, groupId);
  }

  async updateMember(
    userId: string,
    groupId: string,
    memberId: string,
    input: UpdateGroupMember,
  ): Promise<GroupDetailDto> {
    const { group } = await this.loadAsOwner(userId, groupId);
    const member = group.members.find(
      (m) => m.id === memberId && m.status !== 'LEFT',
    );
    if (!member) throw memberNotFound();
    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { displayName: input.displayName },
    });
    return this.get(userId, groupId);
  }

  /** Chủ nhóm gỡ một thành viên, hoặc thành viên tự rời nhóm. */
  async removeMember(
    userId: string,
    groupId: string,
    memberId: string,
  ): Promise<void> {
    const { group, me } = await this.load(userId, groupId);
    const member = group.members.find(
      (m) => m.id === memberId && m.status !== 'LEFT',
    );
    if (!member) throw memberNotFound();
    if (member.role === 'OWNER') {
      throw badRequest(
        'VALIDATION_ERROR',
        'Chủ nhóm không rời được nhóm. Xóa nhóm nếu không chia nữa.',
      );
    }
    if (me.role !== 'OWNER' && me.id !== member.id) throw notOwner();

    await this.prisma.$transaction([
      // Bỏ các khoản chưa trả; khoản đã trả giữ lại để lịch sử không mất
      this.prisma.groupPayment.deleteMany({
        where: { memberId: member.id, status: 'PENDING' },
      }),
      this.prisma.groupMember.update({
        where: { id: member.id },
        data: { status: 'LEFT', leftAt: new Date(), customShareMinor: null },
      }),
    ]);
  }

  /** Tham gia nhóm bằng mã mời: nhận một chỗ còn trống, hoặc thêm chỗ nếu nhóm còn hạn mức. */
  async join(userId: string, input: JoinGroup): Promise<GroupDetailDto> {
    const group = await this.prisma.group.findFirst({
      where: { inviteCode: input.inviteCode, archivedAt: null },
      include: groupInclude,
    });
    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'INVITE_NOT_FOUND',
        message: 'Link mời không còn hiệu lực',
      });
    }
    const members = activeMembers(group);
    if (members.some((m) => m.userId === userId)) {
      return this.buildDetail(userId, group);
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    const displayName = profile?.displayName ?? 'Thành viên mới';
    const emptySlot = members.find(
      (m) => m.userId === null && m.status === 'INVITED',
    );
    if (
      !emptySlot &&
      members.length >= Math.min(group.maxMembers, MAX_GROUP_MEMBERS)
    ) {
      throw badRequest('GROUP_FULL', 'Nhóm đã đủ người');
    }

    if (emptySlot) {
      await this.prisma.groupMember.update({
        where: { id: emptySlot.id },
        data: {
          userId,
          displayName,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
    } else {
      await this.prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          displayName,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
    }
    return this.get(userId, group.id);
  }

  // ───────────────────────── dùng chung ─────────────────────────

  /** Nhóm mình đang tham gia (kèm dòng thành viên của mình). */
  async load(
    userId: string,
    groupId: string,
  ): Promise<{ group: GroupRow; me: GroupMember }> {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, archivedAt: null },
      include: groupInclude,
    });
    const me = group?.members.find(
      (m) => m.userId === userId && m.status !== 'LEFT',
    );
    // Không phân biệt "không tồn tại" và "nhóm của người khác"
    if (!group || !me) throw groupNotFound();
    return { group, me };
  }

  async loadAsOwner(
    userId: string,
    groupId: string,
  ): Promise<{ group: GroupRow; me: GroupMember }> {
    const loaded = await this.load(userId, groupId);
    if (loaded.me.role !== 'OWNER') throw notOwner();
    return loaded;
  }

  async buildDetail(userId: string, group: GroupRow): Promise<GroupDetailDto> {
    const today = await this.today(userId);
    const members = activeMembers(group);
    const me = members.find((m) => m.userId === userId);
    if (!me) throw groupNotFound();
    const isOwner = me.role === 'OWNER';
    const shares = computeShares(
      group.totalAmountMinor,
      members,
      group.splitMode,
    );
    const cycle = await this.syncCycle(group, members, shares, today);
    const byMember = paymentsByMember(cycle);
    const period = periodOf(today);
    const currency = group.currency as CurrencyCode;

    const memberDtos: GroupMemberDto[] = members.map((m) => {
      const payment = byMember.get(m.id) ?? null;
      return {
        id: m.id,
        displayName: m.displayName,
        role: m.role,
        status: m.status,
        isMe: m.userId === userId,
        shareMinor: (shares.get(m.id) ?? 0n).toString(),
        payment:
          m.role === 'OWNER' || !payment
            ? null
            : {
                id: payment.id,
                status: payment.status,
                amountMinor: payment.amountMinor.toString(),
                claimedAt: payment.claimedAt?.toISOString() ?? null,
                confirmedAt: payment.confirmedAt?.toISOString() ?? null,
                lastRemindedAt: payment.lastRemindedAt?.toISOString() ?? null,
              },
      };
    });

    const sumShares = [...shares.values()].reduce((a, b) => a + b, 0n);
    const myShare = shares.get(me.id) ?? 0n;
    const transferNote = groupTransferNote(group.name, period);
    return {
      id: group.id,
      name: group.name,
      service: group.subscription?.service ?? null,
      subscriptionId: group.subscriptionId,
      isOwner,
      ownerName: group.owner.displayName ?? 'Chủ nhóm',
      totalAmountMinor: group.totalAmountMinor.toString(),
      currency,
      splitMode: group.splitMode,
      dueDay: group.dueDay,
      maxMembers: group.maxMembers,
      inviteCode: group.inviteCode,
      inviteUrl: inviteUrl(group.inviteCode),
      payout: payoutDto(group),
      splitDiffMinor: (group.totalAmountMinor - sumShares).toString(),
      myShareMinor: myShare.toString(),
      cycle: cycleDto(period, dueDateOf(period, group.dueDay), cycle.payments),
      members: memberDtos,
      vietQrPayload: this.qrPayload(
        group,
        isOwner,
        myShare,
        shares,
        transferNote,
      ),
      transferNote,
      history: await this.history(group, period),
    };
  }

  /**
   * Chuỗi QR VietQR. Thành viên nhận QR đúng phần của mình; chủ nhóm nhận QR để chia sẻ
   * cho cả nhóm nên chỉ điền sẵn số tiền khi mọi người trả bằng nhau (chia đều).
   * NAPAS247 chỉ chuyển VND nên nhóm tính bằng ngoại tệ không có QR.
   */
  private qrPayload(
    group: GroupRow,
    isOwner: boolean,
    myShare: bigint,
    shares: Map<string, bigint>,
    transferNote: string,
  ): string | null {
    if (!group.payoutBankBin || !group.payoutAccountNo) return null;
    if (group.currency !== 'VND') return null;

    let amountMinor: bigint | undefined;
    if (!isOwner) amountMinor = myShare > 0n ? myShare : undefined;
    else if (group.splitMode === 'EQUAL') {
      const payerShares = [...shares.values()];
      const first = payerShares[0];
      amountMinor =
        first && payerShares.every((s) => s === first) && first > 0n
          ? first
          : undefined;
    }
    try {
      return buildVietQrPayload({
        bankBin: group.payoutBankBin,
        accountNo: group.payoutAccountNo,
        amountMinor,
        description: transferNote,
      });
    } catch {
      // Thông tin nhận tiền không hợp lệ (nhập từ bản cũ) → không hiện QR thay vì làm lỗi cả màn
      return null;
    }
  }

  /**
   * Bảo đảm kỳ thu của tháng này tồn tại và các khoản phải trả khớp cách chia hiện tại.
   * Chỉ sửa khoản còn PENDING: khoản đã báo chuyển / đã xác nhận giữ nguyên số tiền cũ.
   */
  private async syncCycle(
    group: GroupRow,
    members: GroupMember[],
    shares: Map<string, bigint>,
    today: IsoDate,
  ): Promise<CycleRow> {
    const period = periodOf(today);
    const periodDate = toDbDate(periodStart(period));
    const dueDate = toDbDate(dueDateOf(period, group.dueDay));
    const cycle = await this.prisma.groupCycle.upsert({
      where: { groupId_period: { groupId: group.id, period: periodDate } },
      create: {
        groupId: group.id,
        period: periodDate,
        dueDate,
        totalAmountMinor: group.totalAmountMinor,
      },
      update: { dueDate, totalAmountMinor: group.totalAmountMinor },
      include: { payments: true },
    });

    const payers = members.filter((m) => m.role !== 'OWNER');
    const existing = new Map(cycle.payments.map((p) => [p.memberId, p]));
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const m of payers) {
      const share = shares.get(m.id) ?? 0n;
      const payment = existing.get(m.id);
      if (!payment) {
        ops.push(
          this.prisma.groupPayment.create({
            data: {
              cycleId: cycle.id,
              groupId: group.id,
              memberId: m.id,
              amountMinor: share,
            },
          }),
        );
      } else if (
        payment.status === 'PENDING' &&
        payment.amountMinor !== share
      ) {
        ops.push(
          this.prisma.groupPayment.update({
            where: { id: payment.id },
            data: { amountMinor: share },
          }),
        );
      }
    }
    const payerIds = new Set(payers.map((m) => m.id));
    const stale = cycle.payments.filter(
      (p) => !payerIds.has(p.memberId) && p.status === 'PENDING',
    );
    if (stale.length > 0) {
      ops.push(
        this.prisma.groupPayment.deleteMany({
          where: { id: { in: stale.map((p) => p.id) } },
        }),
      );
    }
    if (ops.length === 0) return cycle;

    await this.prisma.$transaction(ops);
    const payments = await this.prisma.groupPayment.findMany({
      where: { cycleId: cycle.id },
    });
    return { ...cycle, payments };
  }

  /** Các kỳ đã qua, mới nhất trước. */
  private async history(
    group: GroupRow,
    currentPeriod: string,
  ): Promise<GroupCycleDto[]> {
    const cycles = await this.prisma.groupCycle.findMany({
      where: {
        groupId: group.id,
        period: { lt: toDbDate(periodStart(currentPeriod)) },
      },
      include: { payments: true },
      orderBy: { period: 'desc' },
      take: 6,
    });
    return cycles.map((c) =>
      cycleDto(
        fromDbDate(c.period).slice(0, 7),
        fromDbDate(c.dueDate),
        c.payments,
      ),
    );
  }

  private toCard(
    group: GroupRow,
    members: GroupMember[],
    me: GroupMember,
    shares: Map<string, bigint>,
    cycle: CycleRow,
  ): GroupCardDto {
    const period = fromDbDate(cycle.period).slice(0, 7);
    const summary = cycleDto(
      period,
      dueDateOf(period, group.dueDay),
      cycle.payments,
    );
    const mine = cycle.payments.find((p) => p.memberId === me.id) ?? null;
    return {
      id: group.id,
      name: group.name,
      service: group.subscription?.service ?? null,
      isOwner: me.role === 'OWNER',
      ownerName: group.owner.displayName ?? 'Chủ nhóm',
      totalAmountMinor: group.totalAmountMinor.toString(),
      currency: group.currency as CurrencyCode,
      dueDate: summary.dueDate,
      myShareMinor: (shares.get(me.id) ?? 0n).toString(),
      myPaymentStatus: me.role === 'OWNER' ? null : (mine?.status ?? null),
      memberCount: members.length,
      paidCount: summary.paidCount,
      payerCount: summary.payerCount,
      members: members.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        status: m.status,
        isMe: m.userId === me.userId,
      })),
    };
  }

  private async assertWithinGroupLimit(userId: string): Promise<void> {
    const limit = await this.plan.ownedGroupLimit(userId);
    if (limit === null) return;
    const owned = await this.prisma.group.count({
      where: { ownerId: userId, archivedAt: null },
    });
    if (owned >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAN_LIMIT_REACHED',
        message: `Gói Free tạo tối đa ${limit} nhóm chia tiền. Nâng cấp Subca Plus để tạo không giới hạn.`,
        limit,
      });
    }
  }

  private async settings(
    userId: string,
  ): Promise<{ currency: CurrencyCode; timezone: string }> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { currency: true, timezone: true },
    });
    return {
      currency: (settings?.currency ?? 'VND') as CurrencyCode,
      timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
    };
  }

  private async today(userId: string): Promise<IsoDate> {
    return todayInTimeZone((await this.settings(userId)).timezone);
  }
}

/** Thành viên còn trong nhóm: chủ nhóm trước, rồi theo thứ tự được mời (thứ tự này quyết định phần lẻ khi chia đều). */
export function activeMembers(group: GroupRow): GroupMember[] {
  return group.members
    .filter((m) => m.status !== 'LEFT')
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'OWNER' ? -1 : 1;
      const byTime = a.invitedAt.getTime() - b.invitedAt.getTime();
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });
}

export const isOpen = (p: GroupPayment): boolean =>
  (OPEN_STATUSES as readonly string[]).includes(p.status);

function paymentsByMember(cycle: CycleRow): Map<string, GroupPayment> {
  return new Map(cycle.payments.map((p) => [p.memberId, p]));
}

export function cycleDto(
  period: string,
  dueDate: IsoDate,
  payments: GroupPayment[],
): GroupCycleDto {
  let expected = 0n;
  let collected = 0n;
  let paidCount = 0;
  for (const p of payments) {
    expected += p.amountMinor;
    if (p.status === 'CONFIRMED') collected += p.amountMinor;
    // WAIVED = chủ nhóm miễn cho thành viên → coi như xong, không còn phải trả
    if (p.status === 'CONFIRMED' || p.status === 'WAIVED') paidCount++;
  }
  return {
    period,
    dueDate,
    expectedMinor: expected.toString(),
    collectedMinor: collected.toString(),
    paidCount,
    payerCount: payments.length,
  };
}

interface PayoutColumns {
  payoutBankBin: string | null;
  payoutBankName: string | null;
  payoutAccountNo: string | null;
  payoutAccountName: string | null;
}

function payoutData(
  payout: {
    bankBin: string;
    bankName?: string | undefined;
    accountNo: string;
    accountName: string;
  } | null,
): PayoutColumns {
  return payout
    ? {
        payoutBankBin: payout.bankBin,
        payoutBankName: payout.bankName ?? null,
        payoutAccountNo: payout.accountNo,
        payoutAccountName: payout.accountName,
      }
    : {
        payoutBankBin: null,
        payoutBankName: null,
        payoutAccountNo: null,
        payoutAccountName: null,
      };
}

function payoutDto(group: GroupRow): GroupDetailDto['payout'] {
  if (!group.payoutBankBin || !group.payoutAccountNo) return null;
  return {
    bankBin: group.payoutBankBin,
    bankName: group.payoutBankName,
    accountNo: group.payoutAccountNo,
    accountName: group.payoutAccountName ?? '',
  };
}

export function groupNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'GROUP_NOT_FOUND',
    message: 'Không tìm thấy nhóm',
  });
}

export function memberNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'GROUP_MEMBER_NOT_FOUND',
    message: 'Không tìm thấy thành viên',
  });
}

export function notOwner(): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    code: 'NOT_GROUP_OWNER',
    message: 'Chỉ chủ nhóm làm được việc này',
  });
}

export function badRequest(
  code: string,
  message: string,
  field?: string,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code,
    message,
    ...(field ? { issues: [{ path: field, message }] } : {}),
  });
}
