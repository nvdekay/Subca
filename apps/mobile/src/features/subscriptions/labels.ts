import type {
  IntervalUnit,
  PaymentMethodType,
  SubscriptionStatus,
  UsageFrequency,
} from '@subca/shared';
import type { PillTone } from '@/components/ui/pill';

export const STATUS_LABEL: Record<
  Exclude<SubscriptionStatus, 'ARCHIVED'>,
  { label: string; tone: PillTone }
> = {
  ACTIVE: { label: 'Đang hoạt động', tone: 'active' },
  TRIAL: { label: 'Dùng thử', tone: 'trial' },
  REVIEW: { label: 'Cần xem lại', tone: 'review' },
  CANCELLED: { label: 'Đã hủy', tone: 'cancel' },
};

export function statusLabel(status: SubscriptionStatus) {
  return status === 'ARCHIVED' ? STATUS_LABEL.CANCELLED : STATUS_LABEL[status];
}

/** "Hằng tháng", "Mỗi 3 tháng", "Hằng năm"… */
export function intervalLabel(unit: IntervalUnit, count: number): string {
  const name = { DAY: 'ngày', WEEK: 'tuần', MONTH: 'tháng', YEAR: 'năm' }[unit];
  if (count === 1) return `Hằng ${name}`;
  if (unit === 'MONTH' && count === 3) return 'Mỗi quý';
  return `Mỗi ${count} ${name}`;
}

/** Thứ tự từ ít đến nhiều, dùng cho thanh 5 nấc ở màn Chi tiết. */
export const USAGE_LEVELS: { value: UsageFrequency; label: string }[] = [
  { value: 'NEVER', label: 'Chưa dùng' },
  { value: 'RARELY', label: 'Hiếm khi' },
  { value: 'SOMETIMES', label: 'Thỉnh thoảng' },
  { value: 'WEEKLY', label: 'Hằng tuần' },
  { value: 'SEVERAL_PER_WEEK', label: 'Vài lần/tuần' },
  { value: 'DAILY', label: 'Hằng ngày' },
];

export const PAYMENT_TYPE_LABEL: Record<PaymentMethodType, string> = {
  CARD: 'Thẻ',
  PAYPAL: 'PayPal',
  APP_STORE: 'App Store',
  GOOGLE_PLAY: 'Google Play',
  E_WALLET: 'Ví điện tử',
  BANK_TRANSFER: 'Chuyển khoản',
  OTHER: 'Khác',
};

export function paymentMethodLabel(pm: { label: string; last4: string | null }): string {
  return pm.last4 ? `${pm.label} •• ${pm.last4}` : pm.label;
}

/** Mốc nhắc: [] = theo cài đặt chung. */
export function reminderLabel(offsets: number[]): string {
  if (offsets.length === 0) return 'Theo cài đặt chung';
  const sorted = [...offsets].sort((a, b) => b - a);
  return `${sorted.map((d) => (d === 0 ? 'Đúng ngày' : `${d}`)).join(' & ')}${
    sorted.some((d) => d > 0) ? ' ngày trước' : ''
  }`;
}
