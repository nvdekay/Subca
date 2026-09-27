import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AccountStatusService } from '../src/auth/account-status.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../src/auth/supabase-jwt.verifier.js';
import { AnalyticsService } from '../src/insights/analytics.service.js';
import { CalendarService } from '../src/insights/calendar.service.js';
import { InsightsController } from '../src/insights/insights.controller.js';
import { ReviewsService } from '../src/insights/reviews.service.js';
import { AccountService } from '../src/me/account.service.js';
import { MeController } from '../src/me/me.controller.js';
import { MeService } from '../src/me/me.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RemindersController } from '../src/reminders/reminders.controller.js';
import { createTestAuth, TEST_USER_ID } from './helpers/jwt.js';

describe('Lịch, đánh giá, phân tích, xóa tài khoản, mở thông báo (e2e)', () => {
  let app: NestFastifyApplication;
  let token: string;
  const calendar = { month: vi.fn().mockResolvedValue({ month: '2026-10' }) };
  const reviews = {
    get: vi.fn().mockResolvedValue({}),
    decide: vi.fn().mockResolvedValue({}),
    clear: vi.fn(),
  };
  const analytics = { get: vi.fn().mockResolvedValue({}) };
  const account = { deleteAccount: vi.fn().mockResolvedValue(undefined) };
  const prisma = {
    reminder: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const SUB = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

  beforeAll(async () => {
    const auth = await createTestAuth();
    token = await auth.sign();
    const moduleRef = await Test.createTestingModule({
      controllers: [InsightsController, MeController, RemindersController],
      providers: [
        { provide: CalendarService, useValue: calendar },
        { provide: ReviewsService, useValue: reviews },
        { provide: AnalyticsService, useValue: analytics },
        { provide: AccountService, useValue: account },
        { provide: MeService, useValue: { getMe: vi.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: SupabaseJwtVerifier, useValue: auth.verifier },
        {
          provide: AccountStatusService,
          useValue: { isBanned: vi.fn().mockResolvedValue(false) },
        },
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

  const call = (
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload ? { payload } : {}),
    });

  it('GET /calendar kiểm tra tháng', async () => {
    expect((await call('GET', '/calendar?month=2026-13')).statusCode).toBe(400);
    expect((await call('GET', '/calendar?month=2026-10')).statusCode).toBe(200);
    expect(calendar.month).toHaveBeenLastCalledWith(TEST_USER_ID, '2026-10');
    await call('GET', '/calendar');
    expect(calendar.month).toHaveBeenLastCalledWith(TEST_USER_ID, undefined);
  });

  it('PUT /reviews/:id kiểm tra quyết định', async () => {
    expect(
      (await call('PUT', `/reviews/${SUB}`, { decision: 'MAYBE' })).statusCode,
    ).toBe(400);
    expect(
      (await call('PUT', '/reviews/abc', { decision: 'KEEP' })).statusCode,
    ).toBe(400);
    expect(
      (
        await call('PUT', `/reviews/${SUB}`, {
          decision: 'CANCEL',
          period: '2026-09',
        })
      ).statusCode,
    ).toBe(200);
    expect(reviews.decide).toHaveBeenLastCalledWith(TEST_USER_ID, SUB, {
      decision: 'CANCEL',
      period: '2026-09',
    });
  });

  it('DELETE /reviews/:id → 204', async () => {
    expect(
      (await call('DELETE', `/reviews/${SUB}?period=2026-09`)).statusCode,
    ).toBe(204);
    expect(reviews.clear).toHaveBeenLastCalledWith(
      TEST_USER_ID,
      SUB,
      '2026-09',
    );
  });

  it('GET /analytics', async () => {
    expect((await call('GET', '/analytics')).statusCode).toBe(200);
    expect(analytics.get).toHaveBeenLastCalledWith(TEST_USER_ID);
  });

  it('DELETE /me xóa đúng tài khoản đang đăng nhập → 204', async () => {
    expect((await call('DELETE', '/me')).statusCode).toBe(204);
    expect(account.deleteAccount).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('POST /reminders/:id/opened chỉ ghi cho lượt nhắc của chính mình, lần đầu', async () => {
    expect((await call('POST', `/reminders/${SUB}/opened`)).statusCode).toBe(
      204,
    );
    expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
      where: { id: SUB, userId: TEST_USER_ID, openedAt: null },
      data: { openedAt: expect.any(Date) },
    });
  });
});
