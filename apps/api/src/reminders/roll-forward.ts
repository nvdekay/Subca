import {
  addDays,
  compareIsoDate,
  nextRenewalOnOrAfter,
  renewalsBetween,
  type IsoDate,
} from '@subca/shared';
import type {
  IntervalUnit,
  SubscriptionStatus,
} from '../generated/prisma/client.js';

export interface RollableSubscription {
  status: SubscriptionStatus;
  startDate: IsoDate;
  anchorDay: number | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  nextRenewalDate: IsoDate | null;
  trialEndDate: IsoDate | null;
  autoRenew: boolean;
}

export interface RollForwardResult {
  status: SubscriptionStatus;
  nextRenewalDate: IsoDate | null;
  /** Các ngày đã bị trừ tiền kể từ lần cập nhật trước (ghi vào lịch sử gia hạn). */
  charges: IsoDate[];
  cancelled: boolean;
}

/**
 * Cập nhật subscription khi ngày gia hạn (hoặc ngày hết trial) đã qua so với `today` của người dùng.
 * - Tự gia hạn: ghi các kỳ đã qua vào lịch sử, tính kỳ tiếp theo; trial chuyển sang ACTIVE.
 * - Không tự gia hạn: gói kết thúc → CANCELLED, không ghi khoản trừ tiền.
 * Trả về null nếu chưa có gì cần cập nhật.
 */
export function rollForward(
  sub: RollableSubscription,
  today: IsoDate,
): RollForwardResult | null {
  const isTrial = sub.status === 'TRIAL';
  if (!isTrial && sub.status !== 'ACTIVE' && sub.status !== 'REVIEW')
    return null;

  const due = isTrial
    ? (sub.trialEndDate ?? sub.nextRenewalDate)
    : sub.nextRenewalDate;
  if (!due || compareIsoDate(due, today) >= 0) return null;

  if (!sub.autoRenew) {
    return {
      status: 'CANCELLED',
      nextRenewalDate: null,
      charges: [],
      cancelled: true,
    };
  }

  const schedule = {
    startDate: sub.startDate,
    anchorDay: sub.anchorDay,
    intervalUnit: sub.intervalUnit,
    intervalCount: sub.intervalCount,
  };
  return {
    status: isTrial ? 'ACTIVE' : sub.status,
    nextRenewalDate: nextRenewalOnOrAfter(schedule, today),
    // Tối đa 400 kỳ để tránh ghi quá nhiều khi dữ liệu nhập sai (VD gói ngày bắt đầu từ rất lâu)
    charges: renewalsBetween(schedule, due, addDays(today, -1), 400),
    cancelled: false,
  };
}
