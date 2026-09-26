import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from 'jose';
import { SupabaseJwtVerifier } from '../../src/auth/supabase-jwt.verifier.js';

export const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;
export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

/** Cặp khóa ES256 giả lập khóa ký của Supabase + hàm ký token và verifier dùng JWKS cục bộ. */
export async function createTestAuth() {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  });
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'ES256',
    use: 'sig',
  };
  const verifier = new SupabaseJwtVerifier(
    createLocalJWKSet({ keys: [jwk] }),
    TEST_ISSUER,
  );

  const sign = (
    overrides: JWTPayload = {},
    opts: {
      expiresIn?: string | number;
      issuer?: string;
      audience?: string;
      key?: CryptoKey;
    } = {},
  ) =>
    new SignJWT({
      role: 'authenticated',
      email: 'khanh@subca.app',
      aal: 'aal1',
      session_id: 'sess-1',
      ...overrides,
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject((overrides.sub as string | undefined) ?? TEST_USER_ID)
      .setIssuer(opts.issuer ?? TEST_ISSUER)
      .setAudience(opts.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? '1h')
      .sign(opts.key ?? privateKey);

  return { verifier, sign };
}
