import { env } from './env';
import { supabase } from './supabase';

/** Lỗi API theo định dạng chung `{ statusCode, code, message, issues? }` của backend. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function accessToken(forceRefresh: boolean): Promise<string | null> {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  // getSession tự làm mới nếu token sắp hết hạn.
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(path: string, init: RequestInit, forceRefresh: boolean): Promise<Response> {
  const token = await accessToken(forceRefresh);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(`${env.apiUrl}${path}`, { ...init, headers });
  } catch {
    // fetch chỉ ném lỗi khi không tới được máy chủ (mất mạng, sai EXPO_PUBLIC_API_URL, API chưa chạy).
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    );
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    code?: string;
    message?: string | string[];
    issues?: unknown;
  } | null;
  const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
  return new ApiError(
    res.status,
    body?.code ?? `HTTP_${res.status}`,
    message ?? res.statusText,
    body?.issues,
  );
}

/**
 * Gọi API kèm access token Supabase.
 * TOKEN_EXPIRED → làm mới phiên rồi gọi lại đúng 1 lần; ACCOUNT_BANNED / token hỏng → đăng xuất.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init, false);
  if (res.status === 401) {
    const error = await toApiError(res);
    if (error.code !== 'TOKEN_EXPIRED') {
      await supabase.auth.signOut({ scope: 'local' });
      throw error;
    }
    res = await send(path, init, true);
  }
  if (!res.ok) {
    const error = await toApiError(res);
    if (error.code === 'ACCOUNT_BANNED' || res.status === 401) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
