import { formatAmountVi, type CurrencyCode, type IntervalUnit } from '@subca/shared';

// Đổi sang Number trước khi format: Intl của Hermes chưa chắc nhận BigInt; số VND còn rất xa giới hạn 2^53.
const vndNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** Tiền đầy đủ: "260.000đ", "$19.99" (dùng chung cách hiển thị với nội dung push ở server). */
export function formatAmount(amountMinor: string | bigint, currency: CurrencyCode): string {
  return formatAmountVi(BigInt(amountMinor), currency);
}

/** Tách số và ký hiệu để hiện số lớn, ký hiệu nhỏ (thẻ tổng chi phí ở Trang chủ). */
export function splitAmount(
  amountMinor: string,
  currency: CurrencyCode,
): { value: string; unit: string } {
  if (currency === 'VND') return { value: vndNumber.format(Number(amountMinor)), unit: 'đ' };
  return { value: formatAmount(amountMinor, currency), unit: '' };
}

/** Dạng rút gọn cho ô thống kê: 1.250.000đ → "1,25tr", 374.000đ → "374K". */
export function formatShort(amountMinor: string, currency: CurrencyCode): string {
  if (currency !== 'VND') return formatAmount(amountMinor, currency);
  const n = Number(BigInt(amountMinor));
  if (n >= 1_000_000) {
    const millions = (n / 1_000_000)
      .toFixed(2)
      .replace(/\.?0+$/, '')
      .replace('.', ',');
    return `${millions}tr`;
  }
  if (n === 0) return '0đ';
  return `${Math.round(n / 1000)}K`;
}

/** "2026-09-30" → "30/09/2026". Tách chuỗi, không qua Date để khỏi lệch múi giờ. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Như formatDate nhưng bỏ năm nếu là năm nay: "29/09" (dòng danh sách chật chỗ). */
export function formatShortDate(iso: string, currentYear = new Date().getFullYear()): string {
  const [y, m, d] = iso.split('-');
  return Number(y) === currentYear ? `${d}/${m}` : `${d}/${m}/${y}`;
}

export function relativeDay(days: number): string {
  if (days < 0) return 'Đã qua';
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return `${days} ngày nữa`;
}

const UNIT_LABEL: Record<IntervalUnit, string> = {
  DAY: 'ngày',
  WEEK: 'tuần',
  MONTH: 'tháng',
  YEAR: 'năm',
};

/** "/tháng", "/năm", "/3 tháng". */
export function perInterval(unit: IntervalUnit, count: number): string {
  return count === 1 ? `/${UNIT_LABEL[unit]}` : `/${count} ${UNIT_LABEL[unit]}`;
}

export function greeting(hour = new Date().getHours()): string {
  if (hour < 11) return 'Chào buổi sáng,';
  if (hour < 14) return 'Chào buổi trưa,';
  if (hour < 18) return 'Chào buổi chiều,';
  return 'Chào buổi tối,';
}
