import type { CalendarDto } from '@subca/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Lịch gia hạn một tháng ("YYYY-MM"); giữ dữ liệu tháng cũ khi chuyển tháng để lưới không nháy. */
export function useCalendar(month: string) {
  return useQuery({
    queryKey: ['calendar', month],
    queryFn: () => api<CalendarDto>(`/calendar?month=${month}`),
    placeholderData: keepPreviousData,
  });
}
