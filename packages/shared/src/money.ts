/**
 * Tiền luôn lưu dạng số nguyên theo đơn vị nhỏ nhất của tiền tệ (VND: đồng, USD: cent).
 * Không bao giờ dùng số thực cho tiền.
 */
import { z } from 'zod';

/** Số chữ số thập phân theo ISO 4217 cho các tiền tệ Subca hỗ trợ. */
export const CURRENCY_DECIMALS = {
  VND: 0,
  USD: 2,
  EUR: 2,
  JPY: 0,
} as const;

export const CurrencyCode = z.enum(['VND', 'USD', 'EUR', 'JPY']);
export type CurrencyCode = z.infer<typeof CurrencyCode>;

export const Money = z.object({
  amountMinor: z.bigint().nonnegative(),
  currency: CurrencyCode,
});
export type Money = z.infer<typeof Money>;

/** Đổi số tiền người dùng nhập (VD "19.99" USD) sang đơn vị nhỏ nhất (1999n). */
export function toMinor(amount: string | number, currency: CurrencyCode): bigint {
  const decimals = CURRENCY_DECIMALS[currency];
  const text = typeof amount === 'number' ? amount.toFixed(decimals) : amount.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`Số tiền không hợp lệ: ${amount}`);
  const [whole = '0', fraction = ''] = text.split('.');
  if (fraction.length > decimals) {
    throw new Error(`${currency} chỉ có ${decimals} chữ số thập phân: ${amount}`);
  }
  return BigInt(whole + fraction.padEnd(decimals, '0'));
}

/** Định dạng để hiển thị, VD 260000n VND → "260.000 ₫", 1999n USD → "$19.99". */
export function formatMoney(amountMinor: bigint, currency: CurrencyCode, locale = 'vi-VN'): string {
  const decimals = CURRENCY_DECIMALS[currency];
  const value = Number(amountMinor) / 10 ** decimals;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Chia đều số tiền cho n người; phần lẻ dồn vào những người đầu tiên để tổng luôn khớp. */
export function splitEvenly(totalMinor: bigint, parts: number): bigint[] {
  if (!Number.isInteger(parts) || parts < 1) throw new Error('Số phần phải là số nguyên ≥ 1');
  const n = BigInt(parts);
  const base = totalMinor / n;
  const remainder = Number(totalMinor % n);
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1n : 0n));
}
