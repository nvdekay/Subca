import {
  CONFIDENCE,
  addDays,
  compareIsoDate,
  daysBetween,
  type DetectionState,
  type IntervalUnit,
  type IsoDate,
  type SubscriptionEventType,
} from '@subca/shared';

/**
 * Suy luận thuần: từ chuỗi sự kiện của một merchant, ra trạng thái + độ tin cậy + số liệu
 * để tạo/cập nhật subscription. Không đụng database nên test được trực tiếp.
 */

export interface EventFacts {
  eventType: SubscriptionEventType;
  occurredAt: Date;
  amountMinor?: bigint | null;
  currency?: string | null;
  intervalUnit?: IntervalUnit | null;
  intervalCount?: number | null;
  planName?: string | null;
  renewalDate?: IsoDate | null;
  trialEndDate?: IsoDate | null;
  accessUntil?: IsoDate | null;
  confidence: number;
}

export interface ReconcileResult {
  state: DetectionState;
  confidence: number;
  /** Giá mới nhất đọc được. */
  amountMinor: bigint | null;
  currency: string | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  planName: string | null;
  /** Ngày bị trừ tiền gần nhất (gốc để tính kỳ tiếp theo). */
  lastChargedOn: IsoDate | null;
  /** Ngày gia hạn tiếp theo nếu suy ra được. */
  nextRenewalDate: IsoDate | null;
  trialEndDate: IsoDate | null;
  /** Đúng khi Subca chưa đủ chắc và cần người dùng xác nhận. */
  needsReview: boolean;
  reviewReason: string | null;
  /** Giá cũ → giá mới khi phát hiện đổi giá (để báo cho người dùng). */
  priceChange: { fromMinor: bigint; toMinor: bigint; currency: string } | null;
}

const PAYMENT_EVENTS: SubscriptionEventType[] = [
  'PAYMENT_SUCCESS',
  'RENEWAL',
  'SUBSCRIPTION_STARTED',
];
const ENDING_EVENTS: SubscriptionEventType[] = [
  'SUBSCRIPTION_CANCELLED',
  'SUBSCRIPTION_EXPIRED',
  'CANCELLATION_REQUESTED',
];

/** Quá hạn gia hạn dự kiến bao nhiêu ngày thì coi là "im lặng", giảm tin cậy chứ không kết luận hủy. */
const SILENCE_GRACE_DAYS = 45;

export function reconcile(
  events: readonly EventFacts[],
  today: IsoDate,
): ReconcileResult {
  // Cũ → mới để lần theo diễn biến
  const ordered = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const latest = ordered.at(-1)!;
  const payments = ordered.filter((e) => PAYMENT_EVENTS.includes(e.eventType));
  const lastPayment = payments.at(-1) ?? null;

  const interval = inferInterval(ordered, payments);
  const amount = lastValue(ordered, (e) => e.amountMinor ?? null);
  const currency = lastValue(ordered, (e) => e.currency ?? null);
  const planName = lastValue(ordered, (e) => e.planName ?? null);
  const trialEndDate = lastValue(ordered, (e) => e.trialEndDate ?? null);
  const lastChargedOn = lastPayment ? isoOf(lastPayment.occurredAt) : null;
  const explicitRenewal = lastValue(ordered, (e) => e.renewalDate ?? null);

  const state = inferState(ordered, latest, trialEndDate, today);
  const nextRenewalDate =
    state === 'CANCELLED' || state === 'EXPIRED'
      ? null
      : (explicitRenewal ?? projectNextRenewal(lastChargedOn, interval, today));

  let confidence = scoreConfidence(ordered, payments, state, interval.inferred);
  let reviewReason: string | null = null;

  // Im lặng quá lâu so với chu kỳ: không khẳng định đã hủy, chỉ hạ tin cậy
  if (state === 'POSSIBLY_ACTIVE') {
    reviewReason = 'Lâu rồi không thấy email gia hạn';
  }
  if (!amount) {
    confidence -= 10;
    reviewReason ??= 'Không đọc được số tiền trong email';
  }
  confidence = clamp(confidence);

  const priceChange = detectPriceChange(payments, currency);
  if (priceChange) reviewReason ??= 'Giá vừa thay đổi';

  return {
    state,
    confidence,
    amountMinor: amount,
    currency,
    intervalUnit: interval.intervalUnit,
    intervalCount: interval.intervalCount,
    planName,
    lastChargedOn,
    nextRenewalDate,
    trialEndDate: state === 'TRIAL' ? trialEndDate : null,
    needsReview: confidence < CONFIDENCE.high,
    reviewReason:
      confidence < CONFIDENCE.high
        ? (reviewReason ?? 'Cần xác nhận lại')
        : null,
    priceChange,
  };
}

/** Máy trạng thái: sự kiện mới nhất quyết định, trừ khi trial/hết hạn đã qua. */
function inferState(
  ordered: readonly EventFacts[],
  latest: EventFacts,
  trialEndDate: IsoDate | null,
  today: IsoDate,
): DetectionState {
  if (ENDING_EVENTS.includes(latest.eventType)) {
    const accessUntil = latest.accessUntil ?? null;
    // Đã hủy nhưng còn dùng được đến hết kỳ → vẫn coi là đang dùng cho tới ngày đó
    if (accessUntil && compareIsoDate(accessUntil, today) > 0)
      return 'CANCELLED';
    return latest.eventType === 'SUBSCRIPTION_EXPIRED'
      ? 'EXPIRED'
      : 'CANCELLED';
  }
  if (latest.eventType === 'PAYMENT_FAILED') return 'PAYMENT_ISSUE';
  if (latest.eventType === 'SUBSCRIPTION_RESUMED') return 'ACTIVE';

  if (
    latest.eventType === 'TRIAL_STARTED' ||
    latest.eventType === 'TRIAL_ENDING'
  ) {
    // Trial đã qua ngày kết thúc mà không có email nào khác → không dám khẳng định
    if (trialEndDate && compareIsoDate(trialEndDate, today) < 0)
      return 'POSSIBLY_ACTIVE';
    return 'TRIAL';
  }

  const payments = ordered.filter((e) => PAYMENT_EVENTS.includes(e.eventType));
  const lastPayment = payments.at(-1);
  if (!lastPayment) return 'UNKNOWN';

  const silentDays = daysBetween(isoOf(lastPayment.occurredAt), today);
  const interval = inferInterval(ordered, payments);
  const expectedDays = approxDays(
    interval.intervalUnit,
    interval.intervalCount,
  );
  if (silentDays > expectedDays + SILENCE_GRACE_DAYS) return 'POSSIBLY_ACTIVE';
  return 'ACTIVE';
}

interface InferredInterval {
  intervalUnit: IntervalUnit;
  intervalCount: number;
  /** true khi phải đoán vì email không nói và không đủ mốc thanh toán. */
  inferred: boolean;
}

/**
 * Chu kỳ lấy theo thứ tự: email nói rõ → khoảng cách giữa các lần thanh toán → mặc định tháng.
 */
function inferInterval(
  ordered: readonly EventFacts[],
  payments: readonly EventFacts[],
): InferredInterval {
  const stated = [...ordered].reverse().find((e) => e.intervalUnit);
  if (stated?.intervalUnit) {
    return {
      intervalUnit: stated.intervalUnit,
      intervalCount: stated.intervalCount ?? 1,
      inferred: false,
    };
  }
  if (payments.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < payments.length; i++) {
      gaps.push(
        daysBetween(
          isoOf(payments[i - 1]!.occurredAt),
          isoOf(payments[i]!.occurredAt),
        ),
      );
    }
    const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!;
    if (median >= 320)
      return { intervalUnit: 'YEAR', intervalCount: 1, inferred: false };
    if (median >= 75)
      return { intervalUnit: 'MONTH', intervalCount: 3, inferred: false };
    if (median >= 20)
      return { intervalUnit: 'MONTH', intervalCount: 1, inferred: false };
    if (median >= 5)
      return { intervalUnit: 'WEEK', intervalCount: 1, inferred: false };
  }
  return { intervalUnit: 'MONTH', intervalCount: 1, inferred: true };
}

/** Kỳ kế tiếp = lần trừ tiền gần nhất + n chu kỳ, đẩy tới khi vượt hôm nay. */
function projectNextRenewal(
  lastChargedOn: IsoDate | null,
  interval: InferredInterval,
  today: IsoDate,
): IsoDate | null {
  if (!lastChargedOn) return null;
  const step = approxDays(interval.intervalUnit, interval.intervalCount);
  let next = addDays(lastChargedOn, step);
  let guard = 0;
  while (compareIsoDate(next, today) < 0 && guard++ < 60)
    next = addDays(next, step);
  return next;
}

/** Đổi chu kỳ ra số ngày xấp xỉ (chỉ để ước lượng và so sánh khoảng cách). */
function approxDays(unit: IntervalUnit, count: number): number {
  const perUnit = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[unit];
  return perUnit * Math.max(count, 1);
}

/** Giá lần thanh toán gần nhất khác giá lần trước đó (cùng tiền tệ) → có đổi giá. */
function detectPriceChange(
  payments: readonly EventFacts[],
  currency: string | null,
): ReconcileResult['priceChange'] {
  const withAmount = payments.filter(
    (p) => p.amountMinor && p.currency === currency,
  );
  if (withAmount.length < 2) return null;
  const last = withAmount.at(-1)!;
  const previous = withAmount.at(-2)!;
  if (!last.amountMinor || !previous.amountMinor) return null;
  if (last.amountMinor === previous.amountMinor) return null;
  return {
    fromMinor: previous.amountMinor,
    toMinor: last.amountMinor,
    currency: currency ?? 'VND',
  };
}

/**
 * Điểm tin cậy: nhiều lần thanh toán đều đặn thì chắc chắn; chỉ một email cũ thì thấp.
 */
function scoreConfidence(
  ordered: readonly EventFacts[],
  payments: readonly EventFacts[],
  state: DetectionState,
  intervalGuessed: boolean,
): number {
  const best = Math.max(...ordered.map((e) => e.confidence));
  let score = best * 0.6;
  score += Math.min(payments.length, 4) * 9;
  if (ordered.length >= 3) score += 5;
  if (intervalGuessed) score -= 8;
  if (state === 'POSSIBLY_ACTIVE') score -= 25;
  if (state === 'UNKNOWN') score -= 35;
  if (state === 'CANCELLED' || state === 'EXPIRED') score += 5;
  return clamp(Math.round(score));
}

function lastValue<T>(
  events: readonly EventFacts[],
  pick: (event: EventFacts) => T | null,
): T | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const value = pick(events[i]!);
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

const isoOf = (date: Date): IsoDate => date.toISOString().slice(0, 10);
const clamp = (value: number): number => Math.max(0, Math.min(100, value));
