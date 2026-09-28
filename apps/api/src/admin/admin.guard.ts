import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { adminCan, type AdminPermission } from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import type { Env } from '../config/env.js';
import type { AdminUser } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const ADMIN_PERMISSION_KEY = 'adminPermission';

/**
 * Đánh dấu endpoint admin và quyền cần có. Mặc định `read` (mọi vai trò admin xem được).
 * Dùng kèm `@UseGuards(AdminGuard)` ở controller.
 */
export const RequireAdmin = (permission: AdminPermission = 'read') =>
  SetMetadata(ADMIN_PERMISSION_KEY, permission);

/** Lấy admin hiện tại trong controller (AdminGuard đã nạp). */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminUser => {
    const request = ctx.switchToHttp().getRequest<{ admin?: AdminUser }>();
    if (!request.admin)
      throw new Error(
        'CurrentAdmin dùng trên endpoint không đi qua AdminGuard',
      );
    return request.admin;
  },
);

/** Địa chỉ IP của request, để ghi vào nhật ký thao tác. */
export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<{ ip?: string }>();
    return request.ip ?? null;
  },
);

/** Cập nhật `last_active_at` của admin nhiều nhất 1 lần mỗi giờ. */
const ACTIVE_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Chặn mọi endpoint `/admin/*`:
 * 1. Tài khoản phải có trong `admin_users` và đang bật.
 * 2. Vai trò phải có quyền mà endpoint yêu cầu.
 * 3. Khi bật `ADMIN_REQUIRE_MFA`, phiên còn phải qua xác thực hai bước (`aal2`).
 *    Mặc định tắt vì admin đăng nhập bằng email + mật khẩu.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; admin?: AdminUser }>();
    const user = request.user;
    if (!user)
      throw forbidden('NOT_ADMIN', 'Không có quyền truy cập trang quản trị');

    if (
      this.config.get('ADMIN_REQUIRE_MFA', { infer: true }) &&
      user.aal !== 'aal2'
    ) {
      throw forbidden(
        'MFA_REQUIRED',
        'Trang quản trị bắt buộc xác thực hai bước. Bật và xác thực TOTP rồi thử lại.',
      );
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: user.id },
    });
    if (!admin || !admin.isActive) {
      // Không nói rõ tài khoản có trong danh sách admin hay không
      throw forbidden('NOT_ADMIN', 'Không có quyền truy cập trang quản trị');
    }

    const permission =
      this.reflector.getAllAndOverride<AdminPermission>(ADMIN_PERMISSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'read';
    if (!adminCan(admin.role, permission)) {
      throw forbidden(
        'ADMIN_FORBIDDEN',
        `Vai trò ${admin.role} không được phép làm việc này`,
      );
    }

    request.admin = admin;
    const stale =
      !admin.lastActiveAt ||
      Date.now() - admin.lastActiveAt.getTime() > ACTIVE_THROTTLE_MS;
    if (stale) {
      await this.prisma.adminUser
        .update({ where: { id: admin.id }, data: { lastActiveAt: new Date() } })
        .catch(() => undefined);
    }
    return true;
  }
}

function forbidden(code: string, message: string): ForbiddenException {
  return new ForbiddenException({ statusCode: 403, code, message });
}
