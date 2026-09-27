import { formatMoney, type CurrencyCode, type IsoDate } from '@subca/shared';
import type { IntervalUnit, ReminderKind } from '../generated/prisma/client.js';

export interface ReminderMessageInput {
  kind: ReminderKind;
  offsetDays: number;
  dueDate: IsoDate;
  name: string;
  amountMinor: bigint;
  currency: CurrencyCode;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  /** VD "Visa •• 4821"; null nếu không có phương thức thanh toán. */
  paymentLabel: string | null;
}

const PER: Record<IntervalUnit, string> = {
  DAY: 'ngày',
  WEEK: 'tuần',
  MONTH: 'tháng',
  YEAR: 'năm',
};

function when(offsetDays: number): string {
  if (offsetDays === 0) return 'hôm nay';
  if (offsetDays === 1) return 'ngày mai';
  return `sau ${offsetDays} ngày`;
}

const ddmm = (date: IsoDate) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Nội dung thông báo push bằng tiếng Việt. */
export function buildReminderMessage(m: ReminderMessageInput): {
  title: string;
  body: string;
} {
  const money = formatMoney(m.amountMinor, m.currency);
  const cycle =
    m.intervalCount === 1
      ? PER[m.intervalUnit]
      : `${m.intervalCount} ${PER[m.intervalUnit]}`;

  if (m.kind === 'TRIAL_END') {
    return {
      title:
        m.offsetDays === 0
          ? `${m.name} hết dùng thử hôm nay`
          : `${m.name} hết dùng thử ${when(m.offsetDays)}`,
      body: `Từ ${ddmm(m.dueDate)} bạn sẽ bị trừ ${money}/${cycle}. Hủy trước nếu không dùng nữa.`,
    };
  }
  const via = m.paymentLabel ? ` từ ${m.paymentLabel}` : '';
  return {
    title:
      m.offsetDays === 0
        ? `Hôm nay ${m.name} gia hạn`
        : `${m.name} gia hạn ${when(m.offsetDays)}`,
    body:
      m.offsetDays === 0
        ? `${money} sẽ được trừ${via} hôm nay.`
        : `${money} sẽ được trừ${via} vào ${ddmm(m.dueDate)}.`,
  };
}
