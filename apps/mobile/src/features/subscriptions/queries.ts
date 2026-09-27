import type {
  CatalogServiceDto,
  CreateSubscriptionInput,
  PaymentMethodDto,
  SubscriptionDetailDto,
  SubscriptionDto,
  SubscriptionListDto,
  UpdateSubscriptionInput,
} from '@subca/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const subscriptionKeys = {
  list: ['subscriptions'] as const,
  detail: (id: string) => ['subscription', id] as const,
};

/** Toàn bộ subscription (chưa lưu trữ); lọc và tìm ngay trên máy cho nhanh, danh sách thường chỉ vài chục dòng. */
export function useSubscriptions() {
  return useQuery({
    queryKey: subscriptionKeys.list,
    queryFn: () => api<SubscriptionListDto>('/subscriptions'),
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: subscriptionKeys.detail(id),
    queryFn: () => api<SubscriptionDetailDto>(`/subscriptions/${id}`),
  });
}

/** Thư viện dịch vụ (~50 dịch vụ) ít đổi: tải một lần, tìm trên máy. */
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog', 'services'],
    queryFn: () => api<CatalogServiceDto[]>('/catalog/services'),
    staleTime: 60 * 60 * 1000,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api<PaymentMethodDto[]>('/payment-methods'),
  });
}

/** Mọi thay đổi subscription đều ảnh hưởng Trang chủ, danh sách và chi tiết. */
function invalidateAfterChange(queryClient: QueryClient, id?: string) {
  queryClient.invalidateQueries({ queryKey: ['home'] });
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.list });
  queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
  if (id) queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail(id) });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubscriptionInput) =>
      api<SubscriptionDto>('/subscriptions', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

export function useUpdateSubscription(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSubscriptionInput) =>
      api<SubscriptionDto>(`/subscriptions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    // Cập nhật ngay phần tóm tắt trong màn Chi tiết, chờ server trả phần còn lại.
    onSuccess: (updated) => {
      queryClient.setQueryData<SubscriptionDetailDto>(subscriptionKeys.detail(id), (old) =>
        old ? { ...old, ...updated } : old,
      );
      invalidateAfterChange(queryClient, id);
    },
  });
}

export function useArchiveSubscription(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/subscriptions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: subscriptionKeys.detail(id) });
      invalidateAfterChange(queryClient);
    },
  });
}
