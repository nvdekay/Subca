import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AccountStatusService } from '../src/auth/account-status.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { SupabaseAdminClient } from '../src/auth/supabase-admin.js';
import type { AuthUser } from '../src/auth/auth.types.js';
import { CurrentUser } from '../src/auth/current-user.decorator.js';
import { SupabaseJwtVerifier } from '../src/auth/supabase-jwt.verifier.js';
import { HealthController } from '../src/health/health.controller.js';
import { AccountService } from '../src/me/account.service.js';
import { MeController } from '../src/me/me.controller.js';
import { MeService } from '../src/me/me.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestAuth, TEST_USER_ID } from './helpers/jwt.js';

@Controller('whoami')
class WhoAmIController {
  @Get()
  whoami(@CurrentUser() user: AuthUser) {
    return user;
  }
}

describe('Xác thực (e2e, Fastify)', () => {
  let app: NestFastifyApplication;
  let sign: Awaited<ReturnType<typeof createTestAuth>>['sign'];
  const accountStatus = { isBanned: vi.fn().mockResolvedValue(false) };
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    profile: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };

  beforeAll(async () => {
    const auth = await createTestAuth();
    sign = auth.sign;
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, MeController, WhoAmIController],
      providers: [
        MeService,
        AccountService,
        {
          provide: SupabaseAdminClient,
          useValue: new SupabaseAdminClient('http://localhost', undefined),
        },
        { provide: PrismaService, useValue: prisma },
        { provide: SupabaseJwtVerifier, useValue: auth.verifier },
        { provide: AccountStatusService, useValue: accountStatus },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (url: string, token?: string) =>
    app.inject({
      method: 'GET',
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  it('/health không cần đăng nhập', async () => {
    expect((await get('/health')).statusCode).toBe(200);
  });

  it('thiếu token → 401 UNAUTHENTICATED', async () => {
    const res = await get('/whoami');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('header sai định dạng → 401 UNAUTHENTICATED', async () => {
    for (const header of ['Basic abc', 'Bearer', 'Bearer a b', 'token-only']) {
      const res = await app.inject({
        method: 'GET',
        url: '/whoami',
        headers: { authorization: header },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  it('token hết hạn → 401 TOKEN_EXPIRED', async () => {
    const res = await get(
      '/whoami',
      await sign({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 }),
    );
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('token giả → 401 INVALID_TOKEN', async () => {
    const res = await get('/whoami', 'eyJhbGciOiJub25lIn0.e30.');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('token hợp lệ → có người dùng hiện tại (không phân biệt hoa thường "bearer")', async () => {
    const token = await sign();
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: TEST_USER_ID,
      email: 'khanh@subca.app',
    });
  });

  it('tài khoản bị khóa → 403 ACCOUNT_BANNED ở mọi endpoint', async () => {
    accountStatus.isBanned.mockResolvedValueOnce(true);
    const res = await get('/whoami', await sign());
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_BANNED' });
    expect(accountStatus.isBanned).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('GET /me trả về hồ sơ và gói Free', async () => {
    prisma.profile.findUnique.mockResolvedValueOnce({
      id: TEST_USER_ID,
      email: 'khanh@subca.app',
      displayName: 'Khánh Nguyễn',
      avatarUrl: null,
      referralCode: 'AB12CD34',
      bannedAt: null,
      lastActiveAt: new Date(),
      createdAt: new Date('2026-09-01T00:00:00Z'),
      settings: {
        currency: 'VND',
        timezone: 'Asia/Ho_Chi_Minh',
        locale: 'vi-VN',
        reminderMinuteOfDay: 510,
        notificationsEnabled: true,
      },
      entitlements: [],
    });
    const res = await get('/me', await sign());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: TEST_USER_ID,
      displayName: 'Khánh Nguyễn',
      plan: { tier: 'FREE' },
      limits: { maxSubscriptions: 8 },
    });
    expect(prisma.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TEST_USER_ID } }),
    );
  });

  it('GET /me khi chưa có profile → 404 PROFILE_NOT_FOUND', async () => {
    prisma.profile.findUnique.mockResolvedValueOnce(null);
    const res = await get('/me', await sign());
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'PROFILE_NOT_FOUND' });
  });
});
