import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountStatusService } from './account-status.service.js';
import type { AuthErrorCode, AuthUser } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import {
  AuthTokenError,
  SupabaseJwtVerifier,
} from './supabase-jwt.verifier.js';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

/**
 * Guard toàn cục: mọi endpoint bắt buộc có header `Authorization: Bearer <access token Supabase>`,
 * trừ endpoint gắn @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: SupabaseJwtVerifier,
    private readonly accountStatus: AccountStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestLike>();
    const token = extractBearer(request.headers['authorization']);
    if (!token) throw unauthorized('UNAUTHENTICATED', 'Chưa đăng nhập');

    try {
      request.user = await this.verifier.verify(token);
    } catch (error) {
      if (error instanceof AuthTokenError)
        throw unauthorized(error.code, error.message);
      throw error;
    }

    if (await this.accountStatus.isBanned(request.user.id)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ACCOUNT_BANNED',
        message: 'Tài khoản đã bị khóa',
      });
    }
    return true;
  }
}

function extractBearer(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0)
    return null;
  return token;
}

function unauthorized(
  code: AuthErrorCode,
  message: string,
): UnauthorizedException {
  // `code` giúp app phân biệt: TOKEN_EXPIRED → làm mới token rồi gọi lại; còn lại → đăng nhập lại
  return new UnauthorizedException({ statusCode: 401, code, message });
}
