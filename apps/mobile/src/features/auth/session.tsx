import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { queryPersister } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { passwordFlow } from './password';

type SessionState = {
  session: Session | null;
  ready: boolean;
  needsPassword: boolean;
  completePasswordSetup: () => void;
};

const SessionContext = createContext<SessionState>({
  session: null,
  ready: false,
  needsPassword: false,
  completePasswordSetup: () => {},
});

/** Theo dõi phiên Supabase; `ready` = đã đọc xong phiên lưu trên máy (trước đó giữ màn splash). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({
    session: null as Session | null,
    ready: false,
    needsPassword: false,
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted)
          setState({
            session: data.session,
            ready: true,
            needsPassword: passwordFlow.pending(data.session?.user.email),
          });
      })
      .catch(() => {
        if (mounted) setState({ session: null, ready: true, needsPassword: false });
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // Đổi người dùng thì bỏ toàn bộ cache của người trước.
      if (event === 'SIGNED_OUT') {
        passwordFlow.clear();
        queryClient.clear();
        // Xóa luôn bản lưu trên máy để người đăng nhập sau không thấy dữ liệu của người trước.
        queryPersister.removeClient();
      }
      setState({ session, ready: true, needsPassword: passwordFlow.pending(session?.user.email) });
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return (
    <SessionContext.Provider
      value={{
        ...state,
        completePasswordSetup: () => setState((current) => ({ ...current, needsPassword: false })),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
