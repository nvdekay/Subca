import { SupabaseAdminClient } from './supabase-admin.js';

const USER = '11111111-1111-4111-8111-111111111111';

describe('SupabaseAdminClient', () => {
  it('gọi DELETE /auth/v1/admin/users/:id với khóa service_role', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const client = new SupabaseAdminClient(
      'https://x.supabase.co/',
      'service-key',
      fetchFn as unknown as typeof fetch,
    );
    expect(await client.deleteUser(USER)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`https://x.supabase.co/auth/v1/admin/users/${USER}`);
    expect(init).toMatchObject({
      method: 'DELETE',
      headers: { apikey: 'service-key', authorization: 'Bearer service-key' },
    });
  });

  it('404 → false (đã xóa trước đó); lỗi khác → ném lỗi; thiếu khóa → ném lỗi', async () => {
    const notFound = new SupabaseAdminClient(
      'https://x',
      'k',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })) as never,
    );
    expect(await notFound.deleteUser(USER)).toBe(false);
    const broken = new SupabaseAdminClient(
      'https://x',
      'k',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })) as never,
    );
    await expect(broken.deleteUser(USER)).rejects.toThrow(/500/);
    const unconfigured = new SupabaseAdminClient('https://x', undefined);
    expect(unconfigured.configured).toBe(false);
    await expect(unconfigured.deleteUser(USER)).rejects.toThrow(/SERVICE_ROLE/);
  });
});
