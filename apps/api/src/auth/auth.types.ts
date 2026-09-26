/** Người dùng đã xác thực, lấy từ token đăng nhập của Supabase. */
export interface AuthUser {
  /** = auth.users.id = profiles.id */
  id: string;
  email: string | null;
  /** Mức xác thực: aal1 = mật khẩu/OAuth, aal2 = đã qua MFA. */
  aal: 'aal1' | 'aal2';
  sessionId: string | null;
}

export type AuthErrorCode =
  'UNAUTHENTICATED' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN';
