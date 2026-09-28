'use client';

import type { Session } from '@supabase/supabase-js';
import type { AdminMeDto, AdminPermission } from '@subca/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface AdminSession {
  /** Đang lấy phiên đăng nhập lần đầu. */
  loading: boolean;
  session: Session | null;
  /** Phiên đã qua MFA (aal2) chưa — admin bắt buộc. */
  mfaDone: boolean;
  /** Thông tin admin từ `/admin/me`; null khi chưa đăng nhập hoặc không có quyền. */
  me: AdminMeDto | null;
  /** Lỗi khi gọi `/admin/me` (VD 403 NOT_ADMIN). */
  error: ApiError | null;
  can: (permission: AdminPermission) => boolean;
  signOut: () => Promise<void>;
}

const Context = createContext<AdminSession | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Đổi phiên (đăng nhập, xong MFA, đăng xuất) thì bỏ hết dữ liệu đã tải của phiên cũ
      queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  // `aal2` nằm trong access token; đọc từ claim để biết đã qua MFA chưa
  const mfaDone = tokenAal(session?.access_token) === 'aal2';

  const meQuery = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => api<AdminMeDto>('/admin/me'),
    enabled: Boolean(session) && mfaDone,
    retry: false,
  });

  const value: AdminSession = {
    loading: loading || (Boolean(session) && mfaDone && meQuery.isLoading),
    session,
    mfaDone,
    me: meQuery.data ?? null,
    error: meQuery.error instanceof ApiError ? meQuery.error : null,
    can: (permission) => meQuery.data?.permissions.includes(permission) ?? false,
    signOut: async () => {
      await supabase.auth.signOut();
      queryClient.clear();
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdminSession(): AdminSession {
  const value = useContext(Context);
  if (!value) throw new Error('useAdminSession phải nằm trong AdminSessionProvider');
  return value;
}

/** Đọc claim `aal` trong access token (không cần xác minh chữ ký — server mới là nơi kiểm tra). */
function tokenAal(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  try {
    const [, payload] = accessToken.split('.');
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      aal?: string;
    };
    return json.aal ?? null;
  } catch {
    return null;
  }
}
