import { formatAmountVi, type CurrencyCode } from '@subca/shared';

/** Tiền: "260.000đ", "$19.99" — dùng chung cách hiển thị với app. */
export function formatAmount(amountMinor: string | bigint, currency: CurrencyCode = 'VND'): string {
  return formatAmountVi(BigInt(amountMinor), currency);
}

const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** Số lớn cho ô thống kê: 9.420.000.000 → "9,42 tỷ", 1.250.000 → "1,25 tr". */
export function formatShortAmount(amountMinor: string): string {
  const n = Number(BigInt(amountMinor));
  if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000)} tỷ`;
  if (n >= 1_000_000) return `${trim(n / 1_000_000)} tr`;
  if (n >= 1_000) return `${trim(n / 1_000)}K`;
  return `${vnd.format(n)}đ`;
}

const trim = (value: number) =>
  value
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .replace('.', ',');

export const formatNumber = (value: number): string => vnd.format(value);

/** "2026-09-28T02:00:00Z" → "28/09/2026 09:00" theo giờ Việt Nam. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));
}

/** "vừa xong", "3 giờ trước", "5 ngày trước". */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return 'chưa bao giờ';
  const diff = now - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(iso);
}
