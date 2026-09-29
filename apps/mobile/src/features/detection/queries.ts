import type {
  ConnectionsDto,
  DiscoverySummaryDto,
  InboxDto,
  ResolveInboxItem,
  StartConnectionDto,
  SyncRunDto,
} from '@subca/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';

export const detectionKeys = {
  connections: ['connections'] as const,
  summary: ['connections', 'summary'] as const,
  inbox: ['inbox'] as const,
};

export function useConnections() {
  return useQuery({
    queryKey: detectionKeys.connections,
    queryFn: () => api<ConnectionsDto>('/connections'),
    refetchInterval: (query) =>
      query.state.data?.accounts.some((account) => account.sync?.status === 'RUNNING')
        ? 3000
        : false,
  });
}

/** Tiến độ quét — hỏi lại mỗi 3 giây khi đang chạy để màn "đang tìm" nhúc nhích. */
export function useDiscoverySummary(enabled = true) {
  return useQuery({
    queryKey: detectionKeys.summary,
    queryFn: () => api<DiscoverySummaryDto>('/connections/summary'),
    enabled,
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' ? 3000 : false),
  });
}

function invalidateAll(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: detectionKeys.connections });
  queryClient.invalidateQueries({ queryKey: detectionKeys.summary });
  queryClient.invalidateQueries({ queryKey: detectionKeys.inbox });
  // Phát hiện mới ảnh hưởng mọi màn có subscription
  queryClient.invalidateQueries({ queryKey: ['home'] });
  queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
  queryClient.invalidateQueries({ queryKey: ['analytics'] });
  queryClient.invalidateQueries({ queryKey: ['reviews'] });
}

/**
 * Kết nối Gmail: xin URL đồng ý từ API rồi mở trình duyệt hệ thống.
 * Token do máy chủ giữ — app không bao giờ thấy access token hay refresh token.
 */
export function useConnectGmail(redirectPath = 'connections') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const redirectTo = Linking.createURL(`/${redirectPath}`, {
        ...(redirectPath === 'welcome' ? { queryParams: { connected: '1' } } : {}),
      });
      const { authorizeUrl } = await api<StartConnectionDto>('/connections/gmail/start', {
        method: 'POST',
        body: JSON.stringify({ redirectTo }),
      });
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectTo);
      return result.type === 'success';
    },
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSyncConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, windowMonths }: { accountId: string; windowMonths?: number }) =>
      api<SyncRunDto>(`/connections/${accountId}/sync`, {
        method: 'POST',
        body: JSON.stringify(windowMonths ? { windowMonths } : {}),
      }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api<void>(`/connections/${accountId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useInbox() {
  return useQuery({
    queryKey: detectionKeys.inbox,
    queryFn: () => api<InboxDto>('/inbox'),
  });
}

export function useResolveInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string } & ResolveInboxItem) =>
      api<InboxDto>(`/inbox/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: (inbox) => {
      queryClient.setQueryData(detectionKeys.inbox, inbox);
      invalidateAll(queryClient);
    },
  });
}
