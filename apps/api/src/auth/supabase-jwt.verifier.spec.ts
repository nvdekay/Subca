import { generateKeyPair, SignJWT, UnsecuredJWT } from 'jose';
import {
  createTestAuth,
  TEST_ISSUER,
  TEST_USER_ID,
} from '../../test/helpers/jwt.js';
import { AuthTokenError } from './supabase-jwt.verifier.js';

describe('SupabaseJwtVerifier', () => {
  let auth: Awaited<ReturnType<typeof createTestAuth>>;
  beforeAll(async () => {
    auth = await createTestAuth();
  });

  const expectCode = async (token: string, code: string) => {
    const error = await auth.verifier.verify(token).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthTokenError);
    expect((error as AuthTokenError).code).toBe(code);
  };

  it('chấp nhận token hợp lệ và trả về thông tin người dùng', async () => {
    const user = await auth.verifier.verify(await auth.sign({ aal: 'aal2' }));
    expect(user).toEqual({
      id: TEST_USER_ID,
      email: 'khanh@subca.app',
      aal: 'aal2',
      sessionId: 'sess-1',
    });
  });

  it('email rỗng (đăng nhập bằng số điện thoại) → null', async () => {
    const user = await auth.verifier.verify(await auth.sign({ email: '' }));
    expect(user.email).toBeNull();
    expect(user.aal).toBe('aal1');
  });

  it('token hết hạn → TOKEN_EXPIRED', async () => {
    await expectCode(
      await auth.sign({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 }),
      'TOKEN_EXPIRED',
    );
  });

  it('sai issuer (token của project Supabase khác) → INVALID_TOKEN', async () => {
    await expectCode(
      await auth.sign({}, { issuer: 'https://other.supabase.co/auth/v1' }),
      'INVALID_TOKEN',
    );
  });

  it('sai audience → INVALID_TOKEN', async () => {
    await expectCode(
      await auth.sign({}, { audience: 'service' }),
      'INVALID_TOKEN',
    );
  });

  it('ký bằng khóa khác (giả mạo) → INVALID_TOKEN', async () => {
    const { privateKey } = await generateKeyPair('ES256');
    await expectCode(await auth.sign({}, { key: privateKey }), 'INVALID_TOKEN');
  });

  it('token không ký (alg: none) → INVALID_TOKEN', async () => {
    const unsigned = new UnsecuredJWT({ role: 'authenticated' })
      .setSubject(TEST_USER_ID)
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .encode();
    await expectCode(unsigned, 'INVALID_TOKEN');
  });

  it('token HS256 (khóa bí mật kiểu cũ) → INVALID_TOKEN', async () => {
    const hs = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(TEST_USER_ID)
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(
        new TextEncoder().encode(
          'super-secret-jwt-token-with-at-least-32-characters',
        ),
      );
    await expectCode(hs, 'INVALID_TOKEN');
  });

  it('role khác authenticated (VD anon, service_role) → INVALID_TOKEN', async () => {
    await expectCode(await auth.sign({ role: 'anon' }), 'INVALID_TOKEN');
    await expectCode(
      await auth.sign({ role: 'service_role' }),
      'INVALID_TOKEN',
    );
  });

  it('sub không phải UUID → INVALID_TOKEN', async () => {
    await expectCode(await auth.sign({ sub: 'not-a-uuid' }), 'INVALID_TOKEN');
  });

  it('chuỗi rác → INVALID_TOKEN', async () => {
    await expectCode('abc.def.ghi', 'INVALID_TOKEN');
  });
});
