/**
 * Gọi Supabase Auth Admin API bằng khóa service_role (CHỈ dùng ở backend).
 * https://supabase.com/docs/reference/api (endpoint /auth/v1/admin/users/{id})
 */
export class SupabaseAdminClient {
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string | undefined,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get configured(): boolean {
    return Boolean(this.serviceRoleKey);
  }

  /** Tạo tài khoản đăng nhập bằng email + mật khẩu (dùng khi thêm admin). Trả về id. */
  async createUser(email: string, password: string): Promise<string> {
    const body = (await this.request('POST', '/auth/v1/admin/users', {
      email,
      password,
      email_confirm: true,
    })) as { id?: string };
    if (!body.id)
      throw new Error('Supabase Admin API không trả về id tài khoản');
    return body.id;
  }

  /** Đặt lại mật khẩu cho một tài khoản. */
  async setPassword(userId: string, password: string): Promise<void> {
    await this.request('PUT', `/auth/v1/admin/users/${userId}`, { password });
  }

  private async request(
    method: 'POST' | 'PUT',
    path: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.serviceRoleKey)
      throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY');
    const res = await this.fetchFn(
      `${this.supabaseUrl.replace(/\/+$/, '')}${path}`,
      {
        method,
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (json as { msg?: string; message?: string } | null)?.msg ??
        (json as { message?: string } | null)?.message ??
        `HTTP ${res.status}`;
      throw new Error(`Supabase Admin API: ${message}`);
    }
    return json;
  }

  /** Xóa tài khoản đăng nhập. Trả về false nếu tài khoản không tồn tại (đã xóa trước đó). */
  async deleteUser(userId: string): Promise<boolean> {
    if (!this.serviceRoleKey)
      throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY');
    const res = await this.fetchFn(
      `${this.supabaseUrl.replace(/\/+$/, '')}/auth/v1/admin/users/${userId}`,
      {
        method: 'DELETE',
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (res.status === 404) return false;
    if (!res.ok)
      throw new Error(`Supabase Admin API trả về HTTP ${res.status}`);
    return true;
  }
}
