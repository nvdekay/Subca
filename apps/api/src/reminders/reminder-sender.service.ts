import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CurrencyCode } from '@subca/shared';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { fromDbDate } from '../common/db-date.js';
import { PUSH_SENDER, type PushSender } from '../push/push-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildReminderMessage } from './message.js';
import { STALE_AFTER_MS } from './reminders.constants.js';

export type SendOutcome = 'SENT' | 'FAILED' | 'CANCELLED' | 'SKIPPED';

/** Lỗi tạm thời (mạng, Expo quá tải): ném ra để BullMQ thử lại. */
export class TransientPushError extends Error {}

/**
 * Gửi một lượt nhắc. Kiểm tra lại dữ liệu mới nhất trước khi gửi vì job có thể được tạo
 * từ vài chục phút trước: gói đã hủy, đổi ngày, hoặc người dùng tắt thông báo thì bỏ.
 */
@Injectable()
export class ReminderSender {
  private readonly logger = new Logger(ReminderSender.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
  ) {}

  async send(reminderId: string, now = new Date()): Promise<SendOutcome> {
    const r = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: {
        subscription: {
          include: {
            service: { select: { name: true } },
            paymentMethod: {
              select: { label: true, last4: true, archivedAt: true },
            },
          },
        },
        user: {
          select: {
            settings: { select: { notificationsEnabled: true } },
            pushTokens: true,
          },
        },
      },
    });
    if (!r || r.status !== 'PENDING') return 'SKIPPED';

    const cancel = async (reason: string): Promise<SendOutcome> => {
      await this.prisma.reminder.update({
        where: { id: r.id },
        data: { status: 'CANCELLED', error: reason },
      });
      return 'CANCELLED';
    };

    const sub = r.subscription;
    const dueDate = fromDbDate(r.dueDate);
    if (r.scheduledAt.getTime() < now.getTime() - STALE_AFTER_MS)
      return cancel('STALE');
    if (r.user.settings && !r.user.settings.notificationsEnabled)
      return cancel('NOTIFICATIONS_DISABLED');
    if (r.kind === 'TRIAL_END') {
      if (
        sub.status !== 'TRIAL' ||
        !sub.trialEndDate ||
        fromDbDate(sub.trialEndDate) !== dueDate
      ) {
        return cancel('SUBSCRIPTION_CHANGED');
      }
    } else if (
      (sub.status !== 'ACTIVE' && sub.status !== 'REVIEW') ||
      !sub.nextRenewalDate ||
      fromDbDate(sub.nextRenewalDate) !== dueDate
    ) {
      return cancel('SUBSCRIPTION_CHANGED');
    }

    const tokens = r.user.pushTokens;
    if (tokens.length === 0) {
      await this.prisma.reminder.update({
        where: { id: r.id },
        data: { status: 'FAILED', error: 'NO_PUSH_TOKEN' },
      });
      return 'FAILED';
    }

    const pm =
      sub.paymentMethod && !sub.paymentMethod.archivedAt
        ? sub.paymentMethod
        : null;
    const { title, body } = buildReminderMessage({
      kind: r.kind,
      offsetDays: r.offsetDays,
      dueDate,
      name: sub.customName ?? sub.service?.name ?? 'Subscription',
      amountMinor: sub.amountMinor,
      currency: sub.currency as CurrencyCode,
      intervalUnit: sub.intervalUnit,
      intervalCount: sub.intervalCount,
      paymentLabel: pm
        ? pm.last4
          ? `${pm.label} •• ${pm.last4}`
          : pm.label
        : null,
    });
    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      // App dùng để mở thẳng màn chi tiết subscription khi bấm thông báo
      data: {
        type: 'reminder',
        reminderId: r.id,
        subscriptionId: sub.id,
        kind: r.kind,
      },
    }));

    let tickets;
    try {
      tickets = await this.push.send(messages);
    } catch (error) {
      throw new TransientPushError(
        `Gửi push lỗi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const okTicketIds: string[] = [];
    const errors: string[] = [];
    const deadTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') okTicketIds.push(ticket.id);
      else {
        errors.push(ticket.details?.error ?? ticket.message);
        // Máy đã gỡ app / token hết hiệu lực → xóa token để lần sau không gửi nữa
        if (ticket.details?.error === 'DeviceNotRegistered')
          deadTokens.push(tokens[i]!.token);
      }
    });
    if (deadTokens.length > 0) {
      await this.prisma.pushToken.deleteMany({
        where: { token: { in: deadTokens } },
      });
    }

    if (okTicketIds.length > 0) {
      await this.prisma.reminder.update({
        where: { id: r.id },
        data: {
          status: 'SENT',
          sentAt: now,
          pushTicketId: okTicketIds.join(','),
          error: errors.length ? errors.join(',') : null,
        },
      });
      return 'SENT';
    }
    await this.prisma.reminder.update({
      where: { id: r.id },
      data: { status: 'FAILED', error: errors.join(',') || 'UNKNOWN' },
    });
    this.logger.warn(`Lượt nhắc ${r.id} gửi thất bại: ${errors.join(',')}`);
    return 'FAILED';
  }
}
