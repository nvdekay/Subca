import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AuthErrorCode, AuthUser } from './auth.types.js';

export class AuthTokenError extends Error {
  constructor(
    readonly code: Exclude<AuthErrorCode, 'UNAUTHENTICATED'>,
    message: string,
  ) {
    super(message);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Xác minh access token (JWT) do Supabase Auth cấp.
 *
 * - Chữ ký kiểm tra bằng khóa công khai lấy từ JWKS của project (ES256), không cần bí mật.
 * - Bắt buộc đúng issuer (`<SUPABASE_URL>/auth/v1`), audience `authenticated`, còn hạn.
 * - Chỉ chấp nhận thuật toán bất đối xứng; token `alg: none` hoặc HS256 bị từ chối.
 */
export class SupabaseJwtVerifier {
  static readonly ALGORITHMS = ['ES256', 'RS256'];

  constructor(
    private readonly keys: JWTVerifyGetKey,
    private readonly issuer: string,
    private readonly clockToleranceSec = 5,
  ) {}

  async verify(token: string): Promise<AuthUser> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: SupabaseJwtVerifier.ALGORITHMS,
        clockTolerance: this.clockToleranceSec,
        requiredClaims: ['sub', 'exp'],
      }));
    } catch (error) {
      if (error instanceof errors.JWTExpired)
        throw new AuthTokenError('TOKEN_EXPIRED', 'Token đã hết hạn');
      throw new AuthTokenError('INVALID_TOKEN', 'Token không hợp lệ');
    }

    if (typeof payload.sub !== 'string' || !UUID_RE.test(payload.sub)) {
      throw new AuthTokenError('INVALID_TOKEN', 'Token thiếu mã người dùng');
    }
    // Chặn token của vai trò khác (VD anon key, service_role) dùng làm token người dùng
    if (payload['role'] !== 'authenticated') {
      throw new AuthTokenError(
        'INVALID_TOKEN',
        'Token không phải của người dùng đã đăng nhập',
      );
    }

    return {
      id: payload.sub,
      email:
        typeof payload['email'] === 'string' && payload['email']
          ? payload['email']
          : null,
      aal: payload['aal'] === 'aal2' ? 'aal2' : 'aal1',
      sessionId:
        typeof payload['session_id'] === 'string'
          ? payload['session_id']
          : null,
    };
  }
}
