import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { addDays, FREE_LIMITS, todayInTimeZone } from '@subca/shared';
import type { Queue } from 'bullmq';
import { fromDbDate, toDbDate } from '../common/db-date.js';
import type { Env } from '../config/env.js';
import { activeEntitlementWhere } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_TIMEZONE } from '../subscriptions/subscriptions.service.js';
import { planReminders, type PlannedReminder } from './planner.js';
import {
  REMINDER_JOB,
  REMINDERS_QUEUE,
  STALE_AFTER_MS,
  type ReminderJobData,
} from './reminders.constants.js';
import { rollForward } from './roll-forward.js';

/** Lập lịch trước các lượt nhắc sẽ đến hạn trong khoảng này. */
const PLAN_AHEAD_MS = 26 * 60 * 60 * 1000;
/** Đưa vào hàng đợi (job hẹn giờ) các lượt nhắc đến hạn trong khoảng này. */
const ENQUEUE_AHEAD_MS = 30 * 60 * 1000;
/** Mốc nhắc xa nhất cho phép (khớp schema: tối đa 90 ngày). */
const MAX_OFFSET_DAYS = 90;
const PAGE = 500;

export interface TickResult {
  rolled: number;
  planned: number;
  enqueued: number;
  expired: number;
}

/**
 * Chạy mỗi 5 phút: (1) đẩy kỳ gia hạn đã qua, (2) sinh lượt nhắc sắp đến hạn,
 * (3) đưa lượt nhắc vào hàng đợi BullMQ dưới dạng job hẹn giờ.
 * Chạy trùng / nhiều instance vẫn an toàn: lượt nhắc có khóa unique, job dùng ID của lượt nhắc.
 */
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REMINDERS_QUEUE)
    private readonly queue: Queue<ReminderJobData>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron('*/5 * * * *', { name: 'reminders-tick' })
  async cron(): Promise<void> {
    if (!this.config.get('REMINDERS_ENABLED', { infer: true }) || this.running)
      return;
    this.running = true;
    try {
      const r = await this.tick();
      if (r.rolled || r.planned || r.enqueued || r.expired)
        this.logger.log(JSON.stringify(r));
    } catch (error) {
      this.logger.error(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  async tick(now = new Date()): Promise<TickResult> {
    const rolled = await this.rollForwardDue(now);
    const planned = await this.planUpcoming(now);
    const { enqueued, expired } = await this.enqueueDue(now);
    return { rolled, planned, enqueued, expired };
  }

  /** (1) Subscription đã qua ngày gia hạn / hết trial theo múi giờ người dùng. */
  async rollForwardDue(now: Date): Promise<number> {
    // Lấy dư một ngày (múi giờ sớm nhất là UTC+14), lọc chính xác theo múi giờ từng người bên dưới
    const upper = toDbDate(addDays(now.toISOString().slice(0, 10), 1));
    let count = 0;
    let cursor: string | undefined;
    for (;;) {
      const subs = await this.prisma.subscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'REVIEW', 'TRIAL'] },
          nextRenewalDate: { lt: upper },
        },
        include: {
          user: { select: { settings: { select: { timezone: true } } } },
        },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (subs.length === 0) break;
      cursor = subs[subs.length - 1]!.id;

      for (const sub of subs) {
        const today = todayInTimeZone(
          sub.user.settings?.timezone ?? DEFAULT_TIMEZONE,
          now,
        );
        const result = rollForward(
          {
            status: sub.status,
            startDate: fromDbDate(sub.startDate),
            anchorDay: sub.anchorDay,
            intervalUnit: sub.intervalUnit,
            intervalCount: sub.intervalCount,
            nextRenewalDate: sub.nextRenewalDate
              ? fromDbDate(sub.nextRenewalDate)
              : null,
            trialEndDate: sub.trialEndDate
              ? fromDbDate(sub.trialEndDate)
              : null,
            autoRenew: sub.autoRenew,
          },
          today,
        );
        if (!result) continue;
        await this.prisma.$transaction([
          this.prisma.renewalCharge.createMany({
            data: result.charges.map((d) => ({
              subscriptionId: sub.id,
              userId: sub.userId,
              chargedOn: toDbDate(d),
              amountMinor: sub.amountMinor,
              currency: sub.currency,
            })),
            skipDuplicates: true,
          }),
          this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: result.status,
              nextRenewalDate: result.nextRenewalDate
                ? toDbDate(result.nextRenewalDate)
                : null,
              ...(result.cancelled && { cancelledAt: now }),
            },
          }),
        ]);
        count++;
      }
      if (subs.length < PAGE) break;
    }
    return count;
  }

  /** (2) Sinh lượt nhắc có thời điểm gửi trong [now − STALE, now + 26 giờ). */
  async planUpcoming(now: Date): Promise<number> {
    const window = {
      from: new Date(now.getTime() - STALE_AFTER_MS),
      to: new Date(now.getTime() + PLAN_AHEAD_MS),
    };
    const utcToday = now.toISOString().slice(0, 10);
    // Ngày đến hạn có thể có lượt nhắc trong cửa sổ: từ hôm qua tới hôm nay + mốc xa nhất + 2 ngày
    const range = {
      gte: toDbDate(addDays(utcToday, -1)),
      lte: toDbDate(addDays(utcToday, MAX_OFFSET_DAYS + 2)),
    };

    let created = 0;
    let cursor: string | undefined;
    for (;;) {
      const subs = await this.prisma.subscription.findMany({
        where: {
          OR: [
            { status: { in: ['ACTIVE', 'REVIEW'] }, nextRenewalDate: range },
            { status: 'TRIAL', trialEndDate: range },
          ],
        },
        include: {
          user: {
            select: {
              settings: true,
              reminderRules: true,
              entitlements: {
                where: activeEntitlementWhere(now),
                select: { id: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (subs.length === 0) break;
      cursor = subs[subs.length - 1]!.id;

      const planned: PlannedReminder[] = subs.flatMap((sub) => {
        const s = sub.user.settings;
        return planReminders(
          {
            id: sub.id,
            userId: sub.userId,
            status: sub.status,
            nextRenewalDate: sub.nextRenewalDate
              ? fromDbDate(sub.nextRenewalDate)
              : null,
            trialEndDate: sub.trialEndDate
              ? fromDbDate(sub.trialEndDate)
              : null,
            intervalUnit: sub.intervalUnit,
            amountMinor: sub.amountMinor,
            currency: sub.currency,
            reminderOffsets: sub.reminderOffsets,
          },
          sub.user.reminderRules,
          {
            timezone: s?.timezone ?? DEFAULT_TIMEZONE,
            reminderMinuteOfDay: s?.reminderMinuteOfDay ?? 510,
            notificationsEnabled: s?.notificationsEnabled ?? true,
            currency: s?.currency ?? 'VND',
            isPlus: sub.user.entitlements.length > 0,
          },
          window,
          FREE_LIMITS.maxReminderOffsets,
        );
      });
      if (planned.length > 0) {
        const res = await this.prisma.reminder.createMany({
          data: planned.map((p) => ({
            userId: p.userId,
            subscriptionId: p.subscriptionId,
            kind: p.kind,
            offsetDays: p.offsetDays,
            dueDate: toDbDate(p.dueDate),
            scheduledAt: p.scheduledAt,
          })),
          skipDuplicates: true,
        });
        created += res.count;
      }
      if (subs.length < PAGE) break;
    }
    return created;
  }

  /** (3) Đưa lượt nhắc đến hạn trong 30 phút tới vào hàng đợi; bỏ các lượt đã quá trễ. */
  async enqueueDue(now: Date): Promise<{ enqueued: number; expired: number }> {
    const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);
    const expired = await this.prisma.reminder.updateMany({
      where: { status: 'PENDING', scheduledAt: { lt: staleBefore } },
      data: { status: 'CANCELLED', error: 'STALE' },
    });

    const due = await this.prisma.reminder.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: {
          gte: staleBefore,
          lte: new Date(now.getTime() + ENQUEUE_AHEAD_MS),
        },
      },
      select: { id: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
      take: 5000,
    });
    if (due.length > 0) {
      // jobId = id lượt nhắc → thêm lại job đang chờ sẽ bị BullMQ bỏ qua, không gửi trùng
      await this.queue.addBulk(
        due.map((r) => ({
          name: REMINDER_JOB,
          data: { reminderId: r.id },
          opts: {
            jobId: r.id,
            delay: Math.max(0, r.scheduledAt.getTime() - now.getTime()),
          },
        })),
      );
    }
    return { enqueued: due.length, expired: expired.count };
  }
}
