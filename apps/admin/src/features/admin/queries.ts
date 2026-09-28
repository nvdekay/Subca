'use client';

import type {
  AdminOverviewDto,
  AdminQueueDto,
  AdminServiceDto,
  AdminUserDetailDto,
  AdminUsersDto,
  AuditLogsDto,
  BanUser,
  CreateService,
  GrantPlus,
  PriceReportDto,
  PriceReportsDto,
  ReviewPriceReport,
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

export function useAuditLogs(params: { action?: string; severity?: string; page: number }) {
  return useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => api<AuditLogsDto>(`/admin/audit-logs${qs(params)}`),
    placeholderData: (previous) => previous,
  });
}
