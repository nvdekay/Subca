'use client';

import type {
  AdminFeaturesDto,
  AdminOverviewDto,
  AdminSystemDto,
  AdminTeamDto,
  AdminTeamMemberDto,
  AdminQueueDto,
  AdminServiceDto,
  AdminUserDetailDto,
  AdminUsersDto,
  AuditLogsDto,
  BanUser,
  CreateAdmin,
  CreateService,
  FeatureFlagDto,
  GrantPlus,
  PriceReportDto,
  PriceReportsDto,
  ReviewPriceReport,
  SetAdminPassword,
  UpdateAdmin,
  UpdateFeatureFlag,
  UpdateService,
  UpsertServicePlan,
} from '@subca/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export function useOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api<AdminOverviewDto>('/admin/overview'),
  });
}

export function useQueueStats() {
  return useQuery({
    queryKey: ['admin', 'queues'],
    queryFn: () => api<AdminQueueDto>('/admin/queues'),
    refetchInterval: 15_000,
  });
}

export function useUsers(params: { q?: string; status?: string; plan?: string; page: number }) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api<AdminUsersDto>(`/admin/users${qs(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => api<AdminUserDetailDto>(`/admin/users/${id}`),
  });
}

function invalidateUser(queryClient: QueryClient, detail: AdminUserDetailDto) {
  queryClient.setQueryData(['admin', 'user', detail.id], detail);
  queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
}

export function useBanUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BanUser) =>
      api<AdminUserDetailDto>(`/admin/users/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (detail) => invalidateUser(queryClient, detail),
  });
}

export function useUnbanUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<AdminUserDetailDto>(`/admin/users/${id}/unban`, { method: 'POST' }),
    onSuccess: (detail) => invalidateUser(queryClient, detail),
  });
}

export function useGrantPlus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantPlus) =>
      api<AdminUserDetailDto>(`/admin/users/${id}/plus`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (detail) => invalidateUser(queryClient, detail),
  });
}

export function useDeleteUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin', 'user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
}

export function useServices(params: { q?: string; includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'services', params],
    queryFn: () =>
      api<AdminServiceDto[]>(
        `/admin/services${qs({ q: params.q, includeInactive: params.includeInactive ? 'true' : undefined })}`,
      ),
    placeholderData: (previous) => previous,
  });
}

function invalidateCatalog(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'price-reports'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
}

export function useSaveService(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateService | UpdateService) =>
      api<AdminServiceDto>(id ? `/admin/services/${id}` : '/admin/services', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useSavePlan(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, input }: { planId?: string; input: UpsertServicePlan }) =>
      api<AdminServiceDto>(
        planId
          ? `/admin/services/${serviceId}/plans/${planId}`
          : `/admin/services/${serviceId}/plans`,
        { method: planId ? 'PATCH' : 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function usePriceReports(status: string) {
  return useQuery({
    queryKey: ['admin', 'price-reports', status],
    queryFn: () => api<PriceReportsDto>(`/admin/price-reports${qs({ status })}`),
  });
}

export function useReviewPriceReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewPriceReport }) =>
      api<PriceReportDto>(`/admin/price-reports/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useSystem() {
  return useQuery({
    queryKey: ['admin', 'system'],
    queryFn: () => api<AdminSystemDto>('/admin/system'),
    refetchInterval: 30_000,
  });
}

export function useFeatures() {
  return useQuery({
    queryKey: ['admin', 'features'],
    queryFn: () => api<AdminFeaturesDto>('/admin/features'),
  });
}

export function useSetFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: UpdateFeatureFlag }) =>
      api<FeatureFlagDto>(`/admin/flags/${key}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'features'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ['admin', 'team'],
    queryFn: () => api<AdminTeamDto>('/admin/team'),
  });
}

function invalidateTeam(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdmin) =>
      api<AdminTeamMemberDto>('/admin/team', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateTeam(queryClient),
  });
}

export function useUpdateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAdmin }) =>
      api<AdminTeamMemberDto>(`/admin/team/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTeam(queryClient),
  });
}

export function useSetAdminPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SetAdminPassword }) =>
      api<void>(`/admin/team/${id}/password`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateTeam(queryClient),
  });
}

export function useRemoveAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/team/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateTeam(queryClient),
  });
}

export function useAuditLogs(params: { action?: string; severity?: string; page: number }) {
  return useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => api<AuditLogsDto>(`/admin/audit-logs${qs(params)}`),
    placeholderData: (previous) => previous,
  });
}
