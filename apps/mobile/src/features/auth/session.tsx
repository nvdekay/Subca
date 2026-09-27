import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

type SessionState = { session: Session | null; ready: boolean };

const SessionContext = createContext<SessionState>({ session: null, ready: false });

/** Theo dõi phiên Supabase; `ready` = đã đọc xong phiên lưu trên máy (trước đó giữ màn splash). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ session: null, ready: false });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session, ready: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Đổi người dùng thì bỏ toàn bộ cache của người trước.
      if (event === 'SIGNED_OUT') queryClient.clear();
      setState({ session, ready: true });
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
