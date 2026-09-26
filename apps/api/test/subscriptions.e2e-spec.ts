import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AccountStatusService } from '../src/auth/account-status.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../src/auth/supabase-jwt.verifier.js';
import { SubscriptionsController } from '../src/subscriptions/subscriptions.controller.js';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service.js';
import { createTestAuth, TEST_USER_ID } from './helpers/jwt.js';

describe('Subscriptions HTTP (e2e, Fastify)', () => {
  let app: NestFastifyApplication;
  let token: string;
  const service = {
    list: vi.fn().mockResolvedValue({ items: [], trackedCount: 0, limit: 8 }),
    get: vi.fn().mockResolvedValue({ id: 'x' }),
    create: vi.fn().mockResolvedValue({ id: 'new' }),
    update: vi.fn().mockResolvedValue({ id: 'x' }),
    archive: vi.fn().mockResolvedValue(undefined),
  };
  const ID = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

  beforeAll(async () => {
    const auth = await createTestAuth();
    token = await auth.sign();
    const moduleRef = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: service },
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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload ? { payload } : {}),
    });

  it('bắt buộc đăng nhập', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/subscriptions' })).statusCode,
    ).toBe(401);
  });

  it('GET /subscriptions truyền bộ lọc đã kiểm tra cho service', async () => {
    const res = await call('GET', '/subscriptions?status=TRIAL&q=%20notion%20');
    expect(res.statusCode).toBe(200);
    expect(service.list).toHaveBeenLastCalledWith(TEST_USER_ID, {
      status: 'TRIAL',
      q: 'notion',
    });
  });

  it('GET /subscriptions với trạng thái sai → 400', async () => {
    const res = await call('GET', '/subscriptions?status=ARCHIVED');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('POST điền mặc định rồi mới gọi service → 201', async () => {
    const res = await call('POST', '/subscriptions', {
      customName: 'Phòng gym',
      amountMinor: '550000',
      currency: 'VND',
      billingDate: '2026-10-01',
    });
    expect(res.statusCode).toBe(201);
    expect(service.create).toHaveBeenLastCalledWith(
      TEST_USER_ID,
      expect.objectContaining({
        intervalUnit: 'MONTH',
        intervalCount: 1,
        isTrial: false,
        autoRenew: true,
      }),
    );
  });

  it('POST dữ liệu sai → 400 kèm danh sách lỗi theo trường', async () => {
    const res = await call('POST', '/subscriptions', {
      amountMinor: 'abc',
      currency: 'VND',
      billingDate: '2026-02-30',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['amountMinor', 'billingDate']),
    );
  });

  it('ID không phải UUID → 400', async () => {
    const res = await call('GET', '/subscriptions/abc');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('PATCH body rỗng → 400; PATCH hợp lệ → gọi service', async () => {
    expect((await call('PATCH', `/subscriptions/${ID}`, {})).statusCode).toBe(
      400,
    );
    const res = await call('PATCH', `/subscriptions/${ID}`, {
      status: 'CANCELLED',
    });
    expect(res.statusCode).toBe(200);
    expect(service.update).toHaveBeenLastCalledWith(TEST_USER_ID, ID, {
      status: 'CANCELLED',
    });
  });

  it('DELETE → 204 và lưu trữ', async () => {
    const res = await call('DELETE', `/subscriptions/${ID}`);
    expect(res.statusCode).toBe(204);
    expect(service.archive).toHaveBeenLastCalledWith(TEST_USER_ID, ID);
  });
});
