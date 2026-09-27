import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUSH_SENDER, type PushSender } from '../push/push-sender.js';

/** Expo khuyến nghị đợi ~15 phút mới lấy biên nhận; biên nhận được giữ khoảng 24 giờ. */
const MIN_AGE_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BATCH = 1000;

export interface ReceiptCheckResult {
  checked: number;
  failed: number;
  tokensRemoved: number;
}

/**
 * Kiểm tra push receipt: "ticket ok" chỉ nghĩa là Expo đã nhận yêu cầu; biên nhận mới cho biết
 * Apple/Google có nhận thông báo không. Máy đã gỡ app (DeviceNotRegistered) → xóa token.
 */
@Injectable()
export class ReceiptChecker {
  private readonly logger = new Logger(ReceiptChecker.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron('*/15 * * * *', { name: 'push-receipts' })
  async cron(): Promise<void> {
    if (!this.config.get('REMINDERS_ENABLED', { infer: true }) || this.running)
      return;
    this.running = true;
    try {
      const r = await this.check();
      if (r.checked) this.logger.log(JSON.stringify(r));
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.running = false;
    }
  }

  async check(now = new Date()): Promise<ReceiptCheckResult> {
    const reminders = await this.prisma.reminder.findMany({
      where: {
        status: 'SENT',
        receiptCheckedAt: null,
        pushTicketId: { not: null },
        sentAt: { lte: new Date(now.getTime() - MIN_AGE_MS) },
      },
      select: { id: true, pushTicketId: true, sentAt: true },
      orderBy: { sentAt: 'asc' },
      take: BATCH,
    });
    if (reminders.length === 0)
      return { checked: 0, failed: 0, tokensRemoved: 0 };

    const ticketsOf = (r: (typeof reminders)[number]) =>
      r.pushTicketId!.split(',').filter(Boolean);
    const receipts = await this.push.getReceipts(reminders.flatMap(ticketsOf));

    let checked = 0;
    let failed = 0;
    const deadTokens = new Set<string>();
    for (const r of reminders) {
      const tickets = ticketsOf(r);
      const got = tickets
        .map((id) => receipts[id])
        .filter((x) => x !== undefined);
      const expired = now.getTime() - r.sentAt!.getTime() > MAX_AGE_MS;
      // Chưa đủ biên nhận và chưa quá hạn giữ biên nhận → để lượt sau kiểm tra tiếp
      if (got.length < tickets.length && !expired) continue;

      const errors = got.filter((x) => x.status === 'error');
      for (const e of errors) {
        const token = (e.details as { expoPushToken?: string } | undefined)
          ?.expoPushToken;
        if (e.details?.error === 'DeviceNotRegistered' && token)
          deadTokens.add(token);
      }
      const allFailed = got.length > 0 && errors.length === got.length;
      await this.prisma.reminder.update({
        where: { id: r.id },
        data: {
          receiptCheckedAt: now,
          ...(allFailed && { status: 'FAILED' }),
          ...(errors.length > 0 && {
            error: errors
              .map((e) => `RECEIPT:${e.details?.error ?? e.message}`)
              .join(',')
              .slice(0, 500),
          }),
        },
      });
      checked++;
      if (allFailed) failed++;
    }
    if (deadTokens.size > 0) {
      await this.prisma.pushToken.deleteMany({
        where: { token: { in: [...deadTokens] } },
      });
    }
    return { checked, failed, tokensRemoved: deadTokens.size };
  }
}
