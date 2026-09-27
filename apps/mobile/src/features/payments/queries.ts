import type { CreatePaymentMethod, PaymentMethodDto, UpdatePaymentMethod } from '@subca/shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Đổi phương thức ảnh hưởng danh sách thẻ, form subscription và màn Chi tiết (tên thẻ). */
function invalidate(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
  queryClient.invalidateQueries({ queryKey: ['subscription'] });
  queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
}

export function useSavePaymentMethod(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentMethod | UpdatePaymentMethod) =>
      api<PaymentMethodDto>(id ? `/payment-methods/${id}` : '/payment-methods', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/payment-methods/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(queryClient),
  });
}
