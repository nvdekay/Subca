import { Injectable } from '@nestjs/common';
import {
  FREE_LIMITS,
  type CurrencyCode,
  type ReminderFeedItemDto,
  type ReminderRuleDto,
  type RemindersDto,
  type UpdateReminderRules,
} from '@subca/shared';
import { fromDbDate } from '../common/db-date.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TIMEZONE,
  subscriptionInclude,
} from '../subscriptions/subscriptions.service.js';
import { buildReminderMessage } from './message.js';
import { planReminders } from './planner.js';

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 30;
const UPCOMING_DAYS = 30;

const feedInclude = {
  ...subscriptionInclude,
  paymentMethod: { select: { label: true, last4: true, archivedAt: true } },
} satisfies Prisma.SubscriptionInclude;
type FeedSubscription = Prisma.SubscriptionGetPayload<{
  include: typeof feedInclude;
}>;

/** Màn Thông báo: lịch sử nhắc, nhắc sắp tới và quy tắc nhắc chung của người dùng. */
@Injectable()
export class ReminderFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plan: PlanService,
  ) {}

  async feed(userId: string, now = new Date()): Promise<RemindersDto> {
    const [settings, rules, isPlus, sent, subs] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.reminderRule.findMany({ where: { userId } }),
      this.plan.isPlus(userId, now),
      this.prisma.reminder.findMany({
        where: {
          userId,
          status: 'SENT',
          sentAt: { gte: new Date(now.getTime() - HISTORY_DAYS * DAY_MS) },
        },
        include: { subscription: { include: feedInclude } },
        orderBy: { sentAt: 'desc' },
        take: 50,
      }),
      this.prisma.subscription.findMany({
        where: { userId, status: { in: ['ACTIVE', 'REVIEW', 'TRIAL'] } },
        include: feedInclude,
      }),
    ]);

    const user = {
      timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
      reminderMinuteOfDay: settings?.reminderMinuteOfDay ?? 510,
      notificationsEnabled: settings?.notificationsEnabled ?? true,
      currency: settings?.currency ?? 'VND',
      isPlus,
    };

    const history = sent.map((r) =>
      item(r.subscription, {
        id: r.id,
        kind: r.kind,
        offsetDays: r.offsetDays,
        dueDate: fromDbDate(r.dueDate),
        at: r.sentAt ?? r.scheduledAt,
      }),
    );

    // Tính bằng đúng planner mà cron dùng để tạo lượt nhắc, nên danh sách khớp push thật.
    const window = {
      from: now,
      to: new Date(now.getTime() + UPCOMING_DAYS * DAY_MS),
    };
    const upcoming = subs
      .flatMap((s) =>
        planReminders(
          {
            id: s.id,
            userId,
            status: s.status,
            nextRenewalDate: s.nextRenewalDate
              ? fromDbDate(s.nextRenewalDate)
              : null,
            trialEndDate: s.trialEndDate ? fromDbDate(s.trialEndDate) : null,
            intervalUnit: s.intervalUnit,
            amountMinor: s.amountMinor,
            currency: s.currency,
            reminderOffsets: s.reminderOffsets,
          },
          rules,
          user,
          window,
          FREE_LIMITS.maxReminderOffsets,
        ).map((p) => ({ p, s })),
      )
      .sort((a, b) => a.p.scheduledAt.getTime() - b.p.scheduledAt.getTime())
      .map(({ p, s }) =>
        item(s, {
          id: null,
          kind: p.kind,
          offsetDays: p.offsetDays,
          dueDate: p.dueDate,
          at: p.scheduledAt,
        }),
      );

    return {
      history,
      upcoming,
      notificationsEnabled: user.notificationsEnabled,
    };
  }

  async rules(userId: string): Promise<ReminderRuleDto[]> {
    const rows = await this.prisma.reminderRule.findMany({
      where: { userId },
      orderBy: [{ kind: 'asc' }, { offsetDays: 'desc' }],
    });
    return rows.map((r) => ({
      kind: r.kind,
      offsetDays: r.offsetDays,
      minInterval: r.minInterval,
      enabled: r.enabled,
    }));
  }

  /** Thay toàn bộ quy tắc nhắc chung (màn gửi đủ danh sách công tắc mỗi lần lưu). */
  async replaceRules(
    userId: string,
    input: UpdateReminderRules,
  ): Promise<ReminderRuleDto[]> {
    await this.prisma.$transaction([
      this.prisma.reminderRule.deleteMany({ where: { userId } }),
      this.prisma.reminderRule.createMany({
        data: input.rules.map((r) => ({
          userId,
          kind: r.kind,
          offsetDays: r.offsetDays,
          minInterval: r.minInterval,
          enabled: r.enabled,
        })),
      }),
    ]);
    return this.rules(userId);
  }
}

function item(
  sub: FeedSubscription,
  r: {
    id: string | null;
    kind: ReminderFeedItemDto['kind'];
    offsetDays: number;
    dueDate: string;
    at: Date;
  },
): ReminderFeedItemDto {
  const name = sub.customName ?? sub.service?.name ?? 'Subscription';
  const pm =
    sub.paymentMethod && !sub.paymentMethod.archivedAt
      ? sub.paymentMethod
      : null;
  const { title, body } = buildReminderMessage({
    kind: r.kind,
    offsetDays: r.offsetDays,
    dueDate: r.dueDate,
    name,
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
  return {
    id: r.id,
    subscriptionId: sub.id,
    name,
    service: sub.service,
    kind: r.kind,
    offsetDays: r.offsetDays,
    dueDate: r.dueDate,
    at: r.at.toISOString(),
    title,
    body,
  };
}
