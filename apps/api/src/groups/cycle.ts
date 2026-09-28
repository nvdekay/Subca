import type { IsoDate } from '@subca/shared';

/**
 * Nhóm thu tiền theo tháng: mỗi tháng một `GroupCycle`. `period` trong DB là ngày đầu tháng,
 * còn API dùng chuỗi YYYY-MM cho gọn.
 */
export const periodOf = (today: IsoDate): string => today.slice(0, 7);

export const periodStart = (period: string): IsoDate => `${period}-01`;

/** Hạn chuyển tiền của kỳ. `dueDay` luôn 1–28 nên tháng nào cũng có ngày này. */
export const dueDateOf = (period: string, dueDay: number): IsoDate =>
  `${period}-${String(dueDay).padStart(2, '0')}`;

/** Hạn chuyển tiền mặc định khi tạo nhóm từ một gói: theo ngày gia hạn, tối đa 28. */
export const dueDayFromDate = (date: IsoDate): number =>
  Math.min(Number(date.slice(8, 10)), 28);
