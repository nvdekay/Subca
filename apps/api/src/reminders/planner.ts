import { reminderInstant, type IsoDate } from '@subca/shared';
import type {
  IntervalUnit,
  ReminderKind,
  SubscriptionStatus,
} from '../generated/prisma/client.js';

const INTERVAL_ORDER: Record<IntervalUnit, number> = {
  DAY: 0,
  WEEK: 1,
  MONTH: 2,
  YEAR: 3,
};

export interface PlannerSubscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  nextRenewalDate: IsoDate | null;
  trialEndDate: IsoDate | null;
  intervalUnit: IntervalUnit;
  amountMinor: bigint;
  currency: string;
  /** Mốc nhắc riêng của gói; rỗng = dùng quy tắc chung của người dùng. */
  reminderOffsets: number[];
}

export interface PlannerRule {
  kind: ReminderKind;
  offsetDays: number;
  minInterval: IntervalUnit | null;
  minAmountMinor: bigint | null;
  enabled: boolean;
}

export interface PlannerUser {
  timezone: string;
  reminderMinuteOfDay: number;
  notificationsEnabled: boolean;
  currency: string;
  isPlus: boolean;
}

export interface PlannedReminder {
  userId: string;
  subscriptionId: string;
  kind: ReminderKind;
  offsetDays: number;
  dueDate: IsoDate;
  scheduledAt: Date;
}

/**
 * Các lượt nhắc của một subscription có thời điểm gửi nằm trong [from, to).
 * - TRIAL → nhắc trước ngày hết trial (TRIAL_END); ACTIVE / REVIEW → nhắc trước ngày gia hạn (RENEWAL).
 * - Mốc nhắc: mốc riêng của gói nếu có, nếu không thì quy tắc chung (lọc theo chu kỳ tối thiểu và số tiền tối thiểu).
 * - Gói Free chỉ giữ 1 mốc gần ngày đến hạn nhất.
 */
export function planReminders(
  sub: PlannerSubscription,
  rules: PlannerRule[],
  user: PlannerUser,
  window: { from: Date; to: Date },
  freeMaxOffsets: number,
): PlannedReminder[] {
  if (!user.notificationsEnabled) return [];

  let kind: ReminderKind;
  let dueDate: IsoDate | null;
  if (sub.status === 'TRIAL') {
    kind = 'TRIAL_END';
    dueDate = sub.trialEndDate;
  } else if (sub.status === 'ACTIVE' || sub.status === 'REVIEW') {
    kind = 'RENEWAL';
    dueDate = sub.nextRenewalDate;
  } else {
    return [];
  }
  if (!dueDate) return [];

  let offsets =
    sub.reminderOffsets.length > 0
      ? sub.reminderOffsets
      : rules
          .filter((r) => r.enabled && r.kind === kind)
          .filter(
            (r) =>
              !r.minInterval ||
              INTERVAL_ORDER[sub.intervalUnit] >= INTERVAL_ORDER[r.minInterval],
          )
          // Ngưỡng số tiền chỉ so được khi cùng tiền tệ; khác tiền tệ thì vẫn nhắc cho chắc
          .filter(
            (r) =>
              r.minAmountMinor === null ||
              sub.currency !== user.currency ||
              sub.amountMinor >= r.minAmountMinor,
          )
          .map((r) => r.offsetDays);

  offsets = [...new Set(offsets)].sort((a, b) => a - b);
  if (!user.isPlus) offsets = offsets.slice(0, freeMaxOffsets);

  return offsets
    .map((offsetDays) => ({
      userId: sub.userId,
      subscriptionId: sub.id,
      kind,
      offsetDays,
      dueDate: dueDate!,
      scheduledAt: reminderInstant(
        dueDate!,
        offsetDays,
        user.reminderMinuteOfDay,
        user.timezone,
      ),
    }))
    .filter((r) => r.scheduledAt >= window.from && r.scheduledAt < window.to);
}
