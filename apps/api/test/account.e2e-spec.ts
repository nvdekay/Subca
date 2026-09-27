import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AccountStatusService } from '../src/auth/account-status.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../src/auth/supabase-jwt.verifier.js';
import { HomeController } from '../src/home/home.controller.js';
import { HomeService } from '../src/home/home.service.js';
import { AccountService } from '../src/me/account.service.js';
import { MeController } from '../src/me/me.controller.js';
import { MeService } from '../src/me/me.service.js';
import { PaymentMethodsController } from '../src/payment-methods/payment-methods.controller.js';
import { PaymentMethodsService } from '../src/payment-methods/payment-methods.service.js';
import { createTestAuth, TEST_USER_ID } from './helpers/jwt.js';

describe('Home, phương thức thanh toán, cài đặt (e2e, Fastify)', () => {
  let app: NestFastifyApplication;
  let token: string;
  const home = {
    getHome: vi
      .fn()
      .mockResolvedValue({ currency: 'VND', monthlyTotalMinor: '0' }),
  };
  const methods = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'pm' }),
    update: vi.fn().mockResolvedValue({ id: 'pm' }),
    archive: vi.fn().mockResolvedValue(undefined),
  };
  const account = {
    updateProfile: vi.fn().mockResolvedValue({ displayName: 'Khánh' }),
    updateSettings: vi.fn().mockResolvedValue({}),
    getBudget: vi.fn().mockResolvedValue(null),
    upsertBudget: vi.fn().mockResolvedValue({}),
    deleteBudget: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const auth = await createTestAuth();
    token = await auth.sign();
    const moduleRef = await Test.createTestingModule({
      controllers: [HomeController, PaymentMethodsController, MeController],
      providers: [
        { provide: HomeService, useValue: home },
        { provide: PaymentMethodsService, useValue: methods },
        { provide: AccountService, useValue: account },
        { provide: MeService, useValue: { getMe: vi.fn() } },
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
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload ? { payload } : {}),
    });

  it('GET /home cần đăng nhập và trả về dữ liệu của đúng người dùng', async () => {
    expect((await app.inject({ method: 'GET', url: '/home' })).statusCode).toBe(
      401,
    );
    expect((await call('GET', '/home')).statusCode).toBe(200);
    expect(home.getHome).toHaveBeenLastCalledWith(TEST_USER_ID);
  });

  it('POST /payment-methods từ chối số thẻ đầy đủ', async () => {
    const res = await call('POST', '/payment-methods', {
      type: 'CARD',
      label: 'Visa',
      last4: '4111111111111111',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues[0].path).toBe('last4');
    expect(methods.create).not.toHaveBeenCalled();
  });

  it('POST /payment-methods hợp lệ → 201, brand được chuẩn hóa', async () => {
    const res = await call('POST', '/payment-methods', {
      type: 'CARD',
      brand: 'visa',
      label: 'Visa',
      last4: '4821',
    });
    expect(res.statusCode).toBe(201);
    expect(methods.create).toHaveBeenLastCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ brand: 'VISA', isDefault: false }),
    );
  });

  it('DELETE /payment-methods/:id → 204; ID sai → 400', async () => {
    expect(
      (
        await call(
          'DELETE',
          '/payment-methods/0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        )
      ).statusCode,
    ).toBe(204);
    expect((await call('DELETE', '/payment-methods/abc')).statusCode).toBe(400);
  });

  it('PATCH /me/settings kiểm tra múi giờ', async () => {
    expect(
      (await call('PATCH', '/me/settings', { timezone: 'Mars/Olympus' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call('PATCH', '/me/settings', {
          timezone: 'Asia/Ho_Chi_Minh',
          reminderMinuteOfDay: 510,
        })
      ).statusCode,
    ).toBe(200);
    expect(account.updateSettings).toHaveBeenLastCalledWith(TEST_USER_ID, {
      timezone: 'Asia/Ho_Chi_Minh',
      reminderMinuteOfDay: 510,
    });
  });

  it('PUT /me/budget điền mặc định; DELETE → 204', async () => {
    expect(
      (await call('PUT', '/me/budget', { amountMinor: '0', currency: 'VND' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call('PUT', '/me/budget', {
          amountMinor: '2000000',
          currency: 'VND',
        })
      ).statusCode,
    ).toBe(200);
    expect(account.upsertBudget).toHaveBeenLastCalledWith(TEST_USER_ID, {
      amountMinor: '2000000',
      currency: 'VND',
      alertAtPercent: 90,
    });
    expect((await call('DELETE', '/me/budget')).statusCode).toBe(204);
  });

  it('PATCH /me đổi tên hiển thị', async () => {
    const res = await call('PATCH', '/me', { displayName: '  Khánh  ' });
    expect(res.statusCode).toBe(200);
    expect(account.updateProfile).toHaveBeenLastCalledWith(TEST_USER_ID, {
      displayName: 'Khánh',
    });
  });
});
