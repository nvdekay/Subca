/**
 * Bộ tính ngày gia hạn của Subca.
 *
 * Nguyên tắc:
 * - Ngày gia hạn là NGÀY LỊCH (không có giờ), biểu diễn bằng chuỗi ISO `YYYY-MM-DD`.
 *   Tránh dùng `Date` cho ngày lịch vì `Date` luôn gắn múi giờ và dễ lệch 1 ngày.
 * - Kỳ thứ k luôn tính từ ngày bắt đầu (startDate + k chu kỳ), KHÔNG cộng dồn từ kỳ trước.
 *   Nhờ vậy gói ngày 31 đi qua tháng 2 (28/29) vẫn quay lại ngày 31 ở tháng sau.
 * - `anchorDay` (1–31) cho phép giữ ngày gốc khi ngày bắt đầu đã bị lùi (VD bắt đầu 28/02
 *   nhưng thực chất là gói ngày 31).
 * - Chỉ phần quy đổi sang thời điểm gửi nhắc (`reminderInstant`) mới dùng múi giờ.
 *
 * Server là nguồn chính của ngày gia hạn; app dùng cùng các hàm này để xem trước khi nhập liệu.
 */
import { z } from 'zod';
import type { IntervalUnit } from './enums.js';

export type IsoDate = string;

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .refine((s) => isValidIsoDate(s), 'Ngày không tồn tại');

interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

const MS_PER_DAY = 86_400_000;

function parse(date: IsoDate): Ymd {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Ngày không hợp lệ: ${date}`);
  const ymd = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  if (ymd.m < 1 || ymd.m > 12 || ymd.d < 1 || ymd.d > daysInMonth(ymd.y, ymd.m)) {
    throw new Error(`Ngày không tồn tại: ${date}`);
  }
  return ymd;
}

function format({ y, m, d }: Ymd): IsoDate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Số ngày kể từ 1970-01-01 (không phụ thuộc múi giờ). */
function toDayNumber(date: IsoDate): number {
  const { y, m, d } = parse(date);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function fromDayNumber(n: number): IsoDate {
  const dt = new Date(n * MS_PER_DAY);
  return format({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
}

export function isValidIsoDate(date: string): boolean {
  try {
    parse(date);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Số ngày từ `from` đến `to` (âm nếu `to` ở trước). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function compareIsoDate(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0; // chuỗi YYYY-MM-DD so sánh được theo thứ tự từ điển
}

/** Cộng `months` tháng, kẹp ngày về cuối tháng nếu tháng đích ngắn hơn. */
export function addMonths(date: IsoDate, months: number, anchorDay?: number): IsoDate {
  const { y, m, d } = parse(date);
  const index = y * 12 + (m - 1) + months;
  const ty = Math.floor(index / 12);
  const tm = (index % 12) + 1;
  const wanted = anchorDay ?? d;
  return format({ y: ty, m: tm, d: Math.min(wanted, daysInMonth(ty, tm)) });
}

export interface RenewalSchedule {
  /** Kỳ đầu tiên bị tính tiền (với trial: ngày hết trial). */
  startDate: IsoDate;
  intervalUnit: IntervalUnit;
  /** Số đơn vị mỗi chu kỳ, ≥ 1 (VD: 3 tháng = MONTH × 3). */
  intervalCount: number;
  /** Ngày gốc trong tháng (1–31) cho chu kỳ tháng / năm. Mặc định: ngày của startDate. */
  anchorDay?: number | null;
}

function assertSchedule(s: RenewalSchedule): void {
  if (!Number.isInteger(s.intervalCount) || s.intervalCount < 1) {
    throw new Error(`intervalCount phải là số nguyên ≥ 1, nhận ${s.intervalCount}`);
  }
  if (
    s.anchorDay != null &&
    (!Number.isInteger(s.anchorDay) || s.anchorDay < 1 || s.anchorDay > 31)
  ) {
    throw new Error(`anchorDay phải trong khoảng 1–31, nhận ${s.anchorDay}`);
  }
  parse(s.startDate);
}

/** Ngày gia hạn thứ k (k = 0 là startDate). */
export function nthRenewal(s: RenewalSchedule, k: number): IsoDate {
  assertSchedule(s);
  if (!Number.isInteger(k) || k < 0) throw new Error(`k phải là số nguyên ≥ 0, nhận ${k}`);
  const anchor = s.anchorDay ?? parse(s.startDate).d;
  switch (s.intervalUnit) {
    case 'DAY':
      return addDays(s.startDate, k * s.intervalCount);
    case 'WEEK':
      return addDays(s.startDate, k * 7 * s.intervalCount);
    case 'MONTH':
      return addMonths(s.startDate, k * s.intervalCount, anchor);
    case 'YEAR':
      return addMonths(s.startDate, k * 12 * s.intervalCount, anchor);
  }
}

/** Ước lượng chỉ số kỳ gần `target` (có thể lệch 1), để tránh lặp từng kỳ. */
function estimateIndex(s: RenewalSchedule, target: IsoDate): number {
  const start = parse(s.startDate);
  const t = parse(target);
  let k: number;
  switch (s.intervalUnit) {
    case 'DAY':
      k = daysBetween(s.startDate, target) / s.intervalCount;
      break;
    case 'WEEK':
      k = daysBetween(s.startDate, target) / (7 * s.intervalCount);
      break;
    case 'MONTH':
      k = ((t.y - start.y) * 12 + (t.m - start.m)) / s.intervalCount;
      break;
    case 'YEAR':
      k = (t.y - start.y) / s.intervalCount;
      break;
  }
  return Math.max(0, Math.floor(k) - 1);
}

/**
 * Kỳ gia hạn gần nhất vào hoặc sau ngày `from`.
 * Nếu `from` đúng ngày gia hạn thì trả về chính ngày đó (hôm nay bị trừ tiền).
 */
export function nextRenewalOnOrAfter(s: RenewalSchedule, from: IsoDate): IsoDate {
  if (compareIsoDate(from, s.startDate) <= 0) return nthRenewal(s, 0);
  let k = estimateIndex(s, from);
  let date = nthRenewal(s, k);
  while (compareIsoDate(date, from) < 0) date = nthRenewal(s, ++k);
  return date;
}

/** Kỳ gia hạn gần nhất trước ngày `before` (không tính chính ngày đó), hoặc null nếu chưa có kỳ nào. */
export function previousRenewalBefore(s: RenewalSchedule, before: IsoDate): IsoDate | null {
  if (compareIsoDate(before, s.startDate) <= 0) return null;
  let k = estimateIndex(s, before);
  while (compareIsoDate(nthRenewal(s, k + 1), before) < 0) k++;
  return nthRenewal(s, k);
}

/** Tất cả ngày gia hạn trong khoảng [from, to] (gồm cả 2 đầu), VD để vẽ lịch tháng. */
export function renewalsBetween(
  s: RenewalSchedule,
  from: IsoDate,
  to: IsoDate,
  limit = 1000,
): IsoDate[] {
  const result: IsoDate[] = [];
  let k = compareIsoDate(from, s.startDate) <= 0 ? 0 : estimateIndex(s, from);
  let date = nthRenewal(s, k);
  while (compareIsoDate(date, from) < 0) date = nthRenewal(s, ++k);
  while (compareIsoDate(date, to) <= 0 && result.length < limit) {
    result.push(date);
    date = nthRenewal(s, ++k);
  }
  return result;
}

// ─────────────────────────────────────────────
// Trial
// ─────────────────────────────────────────────

/**
 * Ngày hết dùng thử = ngày bắt đầu + số ngày trial. Đây cũng là ngày tính phí đầu tiên
 * và là startDate của lịch gia hạn sau trial.
 * VD: bắt đầu 15/09, trial 14 ngày → hết trial và bị trừ tiền ngày 29/09.
 */
export function trialEndDate(trialStart: IsoDate, trialDays: number): IsoDate {
  if (!Number.isInteger(trialDays) || trialDays < 1) {
    throw new Error(`trialDays phải là số nguyên ≥ 1, nhận ${trialDays}`);
  }
  return addDays(trialStart, trialDays);
}

// ─────────────────────────────────────────────
// Múi giờ & thời điểm nhắc
// ─────────────────────────────────────────────

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function partsIn(timeZone: string, instant: Date): Record<string, number> {
  let fmt = dateFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dateFormatters.set(timeZone, fmt);
  }
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(instant))
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

/** Ngày hôm nay theo múi giờ của người dùng (VD 2026-09-26T18:30Z → "2026-09-27" ở Việt Nam). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): IsoDate {
  const p = partsIn(timeZone, now);
  return format({ y: p['year']!, m: p['month']!, d: p['day']! });
}

/** Độ lệch (phút) của múi giờ so với UTC tại một thời điểm. */
function offsetMinutes(timeZone: string, instant: Date): number {
  const p = partsIn(timeZone, instant);
  const asUtc = Date.UTC(
    p['year']!,
    p['month']! - 1,
    p['day']!,
    p['hour']!,
    p['minute']!,
    p['second']!,
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Đổi "ngày + giờ địa phương" sang thời điểm UTC, có xử lý giờ mùa hè. */
export function zonedTimeToUtc(date: IsoDate, minuteOfDay: number, timeZone: string): Date {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= 1440) {
    throw new Error(`minuteOfDay phải trong khoảng 0–1439, nhận ${minuteOfDay}`);
  }
  const { y, m, d } = parse(date);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  // Hai lượt: lấy độ lệch tại thời điểm ước lượng, rồi kiểm tra lại (đúng cả khi đổi giờ mùa hè)
  const first = naive - offsetMinutes(timeZone, new Date(naive)) * 60_000;
  const second = naive - offsetMinutes(timeZone, new Date(first)) * 60_000;
  return new Date(second);
}

/**
 * Thời điểm gửi nhắc: (dueDate − offsetDays) lúc `minuteOfDay` theo múi giờ người dùng.
 * VD: gia hạn 30/09, nhắc trước 3 ngày lúc 08:30 giờ Việt Nam → 2026-09-27T01:30:00Z.
 */
export function reminderInstant(
  dueDate: IsoDate,
  offsetDays: number,
  minuteOfDay: number,
  timeZone: string,
): Date {
  return zonedTimeToUtc(addDays(dueDate, -offsetDays), minuteOfDay, timeZone);
}

// ─────────────────────────────────────────────
// Quy đổi chi phí
// ─────────────────────────────────────────────

/**
 * Chi phí quy đổi về 1 tháng (đơn vị nhỏ nhất, làm tròn), dùng cho tổng tiền hằng tháng.
 * Năm = 12 tháng; tuần = 52/12 tháng; ngày = 365/12 tháng.
 */
export function monthlyEquivalentMinor(amountMinor: bigint, unit: IntervalUnit, count = 1): bigint {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`count phải là số nguyên ≥ 1, nhận ${count}`);
  const c = BigInt(count);
  // Chia có làm tròn nửa lên: (a * num + den/2) / den
  const div = (num: bigint, den: bigint) => (amountMinor * num + den / 2n) / den;
  switch (unit) {
    case 'DAY':
      return div(365n, 12n * c);
    case 'WEEK':
      return div(52n, 12n * c);
    case 'MONTH':
      return div(1n, c);
    case 'YEAR':
      return div(1n, 12n * c);
  }
}
