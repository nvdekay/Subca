'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AdminSessionProvider } from '@/features/auth/session';
import { env } from '@/lib/env';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  if (!env.configured) return <MissingEnv />;
  return (
    <QueryClientProvider client={queryClient}>
      <AdminSessionProvider>{children}</AdminSessionProvider>
    </QueryClientProvider>
  );
}

/** Thiếu .env.local: hướng dẫn ngay trên màn hình thay vì lỗi trắng trang. */
function MissingEnv() {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-[460px] rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-[18px] font-extrabold">Chưa cấu hình Admin Console</h1>
        <p className="mt-2 text-[13.5px] text-ink-2">
          Sao <code>apps/admin/.env.example</code> thành <code>.env.local</code> rồi điền
          <code> NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> và
          <code> NEXT_PUBLIC_API_URL</code>.
        </p>
      </div>
    </main>
  );
}
