import type {
  BudgetDto,
  SettingsDto,
  UpdateProfile,
  UpdateSettings,
  UpsertBudget,
} from '@subca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfile) =>
      api<{ displayName: string | null }>('/me', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

/** Đổi tiền tệ / múi giờ làm thay đổi mọi số đã quy đổi và "hôm nay" → làm mới toàn bộ dữ liệu. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettings) =>
      api<SettingsDto>('/me/settings', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useBudget() {
  return useQuery({ queryKey: ['budget'], queryFn: () => api<BudgetDto | null>('/me/budget') });
}

export function useSaveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertBudget | null): Promise<BudgetDto | null> =>
      input
        ? api<BudgetDto>('/me/budget', { method: 'PUT', body: JSON.stringify(input) })
        : api<void>('/me/budget', { method: 'DELETE' }).then(() => null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

/** Xóa vĩnh viễn tài khoản (Apple bắt buộc có trong app). Gọi xong thì đăng xuất trên máy. */
export function useDeleteAccount() {
  return useMutation({ mutationFn: () => api<void>('/me', { method: 'DELETE' }) });
}
