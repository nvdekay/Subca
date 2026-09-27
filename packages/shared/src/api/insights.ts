/** Hợp đồng API cho Lịch gia hạn, Đánh giá hằng tháng và Phân tích. */
import { z } from 'zod';
import { ReviewDecision, SubscriptionStatus, UsageFrequency } from '../enums.js';
import type { CurrencyCode } from '../money.js';
import type { IsoDate } from '../renewal.js';
import type { ServiceSummaryDto } from './subscription.js';

/** Tháng dạng YYYY-MM. */
export const MonthString = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM');

// ─────────────── Lịch gia hạn ───────────────

export const CalendarQuerySchema = z.object({ month: MonthString.optional() });
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export interface CalendarItemDto {
  subscriptionId: string;
  name: string;
  service: ServiceSummaryDto | null;
  amountMinor: string;
  currency: CurrencyCode;
  /** RENEWAL = ngày gia hạn; TRIAL_END = ngày hết dùng thử (tính phí đầu tiên). */
  kind: 'RENEWAL' | 'TRIAL_END';
}

export interface CalendarDayDto {
  date: IsoDate;
  items: CalendarItemDto[];
}

export interface CalendarDto {
  month: string;
  currency: CurrencyCode;
  /** Chỉ các ngày có gia hạn / hết trial, sắp theo ngày. */
  days: CalendarDayDto[];
  /** Tổng tiền sẽ/đã trừ trong tháng (quy đổi về tiền tệ chính, không tính ngày hết trial). */
  totalMinor: string;
  count: number;
  missingRates: CurrencyCode[];
}

// ─────────────── Đánh giá hằng tháng ───────────────

export const ReviewQuerySchema = z.object({ period: MonthString.optional() });
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;

export const SetReviewDecisionSchema = z.object({
  period: MonthString.optional(),
  decision: ReviewDecision,
});
export type SetReviewDecision = z.infer<typeof SetReviewDecisionSchema>;

export interface ReviewItemDto {
  subscriptionId: string;
  name: string;
  service: ServiceSummaryDto | null;
  status: SubscriptionStatus;
  usageFrequency: UsageFrequency | null;
  /** Chi phí tháng quy đổi về tiền tệ chính. */
  monthlyMinor: string;
  decision: ReviewDecision | null;
}

export interface ReviewDto {
  period: string;
  currency: CurrencyCode;
  items: ReviewItemDto[];
  reviewedCount: number;
  totalCount: number;
  /** Tổng chi phí tháng của các gói được đánh dấu "Hủy". */
  potentialSavingsMinor: string;
  missingRates: CurrencyCode[];
}

// ─────────────── Phân tích ───────────────

export interface AnalyticsSliceDto {
  id: string | null;
  label: string;
  color: string | null;
  monthlyMinor: string;
  /** Phần trăm trên tổng chi phí tháng (0–100, làm tròn). */
  percent: number;
}

export interface AnalyticsSubscriptionDto {
  subscriptionId: string;
  name: string;
  service: ServiceSummaryDto | null;
  monthlyMinor: string;
}

export interface CostPerUseDto extends AnalyticsSubscriptionDto {
  usageFrequency: UsageFrequency;
  /** Số lần dùng ước tính mỗi tháng theo mức độ sử dụng người dùng chọn. */
  usesPerMonth: number;
  costPerUseMinor: string;
}

export interface AnalyticsDto {
  currency: CurrencyCode;
  monthlyTotalMinor: string;
  yearlyProjectionMinor: string;
  dailyAverageMinor: string;
  byPaymentMethod: AnalyticsSliceDto[];
  /** 5 gói đắt nhất theo chi phí tháng. */
  topExpensive: AnalyticsSubscriptionDto[];
  /** Đắt nhất trên mỗi lần dùng trước. Chỉ gồm gói đã chọn mức độ sử dụng. */
  costPerUse: CostPerUseDto[];
  /** Ước tính chi phí 6 tháng gần nhất (tháng cũ → mới) dựa trên các gói đang có ở mỗi tháng. */
  trend: { month: string; totalMinor: string }[];
  missingRates: CurrencyCode[];
}

/** Số lần dùng ước tính mỗi tháng theo mức độ sử dụng. */
export const USES_PER_MONTH: Record<UsageFrequency, number> = {
  NEVER: 0,
  RARELY: 1,
  SOMETIMES: 3,
  WEEKLY: 4,
  SEVERAL_PER_WEEK: 12,
  DAILY: 30,
};

/** Ngày đầu và cuối của tháng YYYY-MM. */
export function monthRange(month: string): { start: IsoDate; end: IsoDate } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
}

/** Cộng/trừ tháng cho chuỗi YYYY-MM. */
export function addMonthsToMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}
