import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { AdminPermission } from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { Env } from '../config/env.js';
import { AdminGuard } from './admin.guard.js';

/** ConfigService giả: chỉ trả về cờ ADMIN_REQUIRE_MFA. */
const configWith = (requireMfa: boolean) =>
  ({ get: () => requireMfa }) as unknown as ConfigService<Env, true>;

const ADMIN_ID = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

function makeContext(user: AuthUser | undefined, permission?: AdminPermission) {
  const request: { user?: AuthUser; admin?: unknown } = user ? { user } : {};
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permission);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { request, reflector, context };
}

const authUser = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: ADMIN_ID,
  email: 'admin@subca.app',
  aal: 'aal2',
  sessionId: 's1',
  ...over,
});

function makePrisma(admin: unknown) {
  const update = vi.fn().mockResolvedValue({});
  return {
    prisma: {
      adminUser: { findUnique: vi.fn().mockResolvedValue(admin), update },
    } as unknown as PrismaService,
    update,
  };
}

const adminRow = (over: Record<string, unknown> = {}) => ({
  id: ADMIN_ID,
  email: 'admin@subca.app',
  name: 'Khánh',
  role: 'OWNER',
  isActive: true,
  lastActiveAt: new Date(),
  createdAt: new Date(),
  ...over,
});

describe('AdminGuard', () => {
  it('mặc định (đăng nhập bằng mật khẩu) phiên aal1 vẫn vào được', async () => {
    const { reflector, context } = makeContext(authUser({ aal: 'aal1' }));
    const { prisma } = makePrisma(adminRow());
    await expect(
      new AdminGuard(reflector, prisma, configWith(false)).canActivate(context),
    ).resolves.toBe(true);
  });

  it('bật ADMIN_REQUIRE_MFA thì phiên chưa qua xác thực hai bước bị chặn', async () => {
    const { reflector, context } = makeContext(authUser({ aal: 'aal1' }));
    const { prisma } = makePrisma(adminRow());
    await expect(
      new AdminGuard(reflector, prisma, configWith(true)).canActivate(context),
    ).rejects.toMatchObject({ response: { code: 'MFA_REQUIRED' } });
  });

  it('người dùng không có trong admin_users bị chặn', async () => {
    const { reflector, context } = makeContext(authUser());
    const { prisma } = makePrisma(null);
    await expect(
      new AdminGuard(reflector, prisma, configWith(false)).canActivate(context),
    ).rejects.toMatchObject({
      response: { code: 'NOT_ADMIN' },
    });
  });

  it('tài khoản admin đã tắt bị chặn', async () => {
    const { reflector, context } = makeContext(authUser());
    const { prisma } = makePrisma(adminRow({ isActive: false }));
    await expect(
      new AdminGuard(reflector, prisma, configWith(false)).canActivate(context),
    ).rejects.toMatchObject({
      response: { code: 'NOT_ADMIN' },
    });
  });

  it('vai trò không đủ quyền bị chặn, nhưng vẫn xem được', async () => {
    const viewer = adminRow({ role: 'VIEWER' });
    const denied = makeContext(authUser(), 'manageUsers');
    await expect(
      new AdminGuard(
        denied.reflector,
        makePrisma(viewer).prisma,
        configWith(false),
      ).canActivate(denied.context),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_FORBIDDEN' } });

    const allowed = makeContext(authUser(), 'read');
    await expect(
      new AdminGuard(
        allowed.reflector,
        makePrisma(viewer).prisma,
        configWith(false),
      ).canActivate(allowed.context),
    ).resolves.toBe(true);
  });

  it('cho qua và gắn admin vào request; chỉ ghi last_active_at khi đã cũ hơn 1 giờ', async () => {
    const fresh = makeContext(authUser(), 'manageUsers');
    const freshPrisma = makePrisma(adminRow({ lastActiveAt: new Date() }));
    await expect(
      new AdminGuard(
        fresh.reflector,
        freshPrisma.prisma,
        configWith(false),
      ).canActivate(fresh.context),
    ).resolves.toBe(true);
    expect(fresh.request.admin).toMatchObject({ id: ADMIN_ID, role: 'OWNER' });
    expect(freshPrisma.update).not.toHaveBeenCalled();

    const stale = makeContext(authUser(), 'manageUsers');
    const stalePrisma = makePrisma(
      adminRow({ lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
    );
    await new AdminGuard(
      stale.reflector,
      stalePrisma.prisma,
      configWith(false),
    ).canActivate(stale.context);
    expect(stalePrisma.update).toHaveBeenCalled();
  });
});
