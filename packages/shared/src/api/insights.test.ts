import { describe, expect, it } from 'vitest';
import {
  addMonthsToMonth,
  CalendarQuerySchema,
  monthRange,
  SetReviewDecisionSchema,
} from './insights.js';

describe('tháng', () => {
  it('monthRange: tháng 2 năm nhuận và năm thường', () => {
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
  it('addMonthsToMonth qua năm', () => {
    expect(addMonthsToMonth('2026-11', 3)).toBe('2027-02');
    expect(addMonthsToMonth('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToMonth('2026-09', -5)).toBe('2026-04');
  });
  it('kiểm tra định dạng tháng', () => {
    expect(CalendarQuerySchema.safeParse({ month: '2026-10' }).success).toBe(true);
    expect(CalendarQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(CalendarQuerySchema.safeParse({ month: '2026-1' }).success).toBe(false);
    expect(SetReviewDecisionSchema.safeParse({ decision: 'MAYBE' }).success).toBe(false);
  });
});
