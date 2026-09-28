'use client';

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

async function send(path: string, init: RequestInit, forceRefresh: boolean): Promise<Response> {
  const { data } = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const token = data.session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(`${env.apiUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được API. Kiểm tra API có đang chạy.');
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

/** Gọi API kèm access token Supabase; TOKEN_EXPIRED thì làm mới phiên rồi gọi lại đúng 1 lần. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init, false);
  if (res.status === 401) {
    const error = await toApiError(res);
    if (error.code !== 'TOKEN_EXPIRED') throw error;
    res = await send(path, init, true);
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
