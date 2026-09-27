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
