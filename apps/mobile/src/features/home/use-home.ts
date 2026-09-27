import type { HomeDto } from '@subca/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Toàn bộ dữ liệu Trang chủ trong 1 request (`GET /home`). */
export function useHome() {
  return useQuery({ queryKey: ['home'], queryFn: () => api<HomeDto>('/home') });
}
