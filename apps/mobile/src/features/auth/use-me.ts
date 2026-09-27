import type { MeDto } from '@subca/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Hồ sơ + cài đặt + gói; ít đổi nên để cache lâu. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDto>('/me'),
    staleTime: 5 * 60 * 1000,
  });
}
