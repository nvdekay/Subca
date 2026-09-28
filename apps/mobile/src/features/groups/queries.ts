import type {
  AddGroupMember,
  CreateGroupInput,
  GroupDetailDto,
  GroupsOverviewDto,
  JoinGroup,
  SetSplit,
  UpdateGroup,
} from '@subca/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const groupKeys = {
  list: ['groups'] as const,
  detail: (id: string) => ['group', id] as const,
};

/** Màn Chia tiền nhóm: 1 request cho cả màn (nhóm làm chủ, nhóm tham gia, tổng sẽ nhận / cần trả). */
export function useGroups() {
  return useQuery({
    queryKey: groupKeys.list,
    queryFn: () => api<GroupsOverviewDto>('/groups'),
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => api<GroupDetailDto>(`/groups/${id}`),
  });
}

function invalidate(queryClient: QueryClient, detail?: GroupDetailDto) {
  queryClient.invalidateQueries({ queryKey: groupKeys.list });
  if (detail) {
    // Mọi endpoint nhóm đều trả về chi tiết mới nhất → cập nhật ngay, không chờ tải lại
    queryClient.setQueryData(groupKeys.detail(detail.id), detail);
  }
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) =>
      api<GroupDetailDto>('/groups', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (detail) => invalidate(queryClient, detail),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: JoinGroup) =>
      api<GroupDetailDto>('/groups/join', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (detail) => invalidate(queryClient, detail),
  });
}

export function useUpdateGroup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGroup) =>
      api<GroupDetailDto>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: (detail) => invalidate(queryClient, detail),
  });
}

export function useSetSplit(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetSplit) =>
      api<GroupDetailDto>(`/groups/${id}/split`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (detail) => invalidate(queryClient, detail),
  });
}

export function useAddGroupMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddGroupMember) =>
      api<GroupDetailDto>(`/groups/${id}/members`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (detail) => invalidate(queryClient, detail),
  });
}

/** Chủ nhóm gỡ thành viên, hoặc chính mình rời nhóm. */
export function useRemoveGroupMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      api<void>(`/groups/${id}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list });
    },
  });
}

export function useArchiveGroup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: groupKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: groupKeys.list });
    },
  });
}

export type PaymentAction = 'claim' | 'confirm' | 'waive' | 'reopen' | 'remind';

/** Một thao tác trên khoản phải trả: báo đã chuyển, xác nhận, miễn, mở lại, nhắc. */
export function usePaymentAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, action }: { paymentId: string; action: PaymentAction }) =>
      api<GroupDetailDto>(`/groups/${id}/payments/${paymentId}/${action}`, { method: 'POST' }),
    onSuccess: (detail) => invalidate(queryClient, detail),
  });
}

export function useRemindAll(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ reminded: number; skipped: number }>(`/groups/${id}/remind-all`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
    },
  });
}
