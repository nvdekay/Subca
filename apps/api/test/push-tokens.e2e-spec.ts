import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AccountStatusService } from '../src/auth/account-status.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../src/auth/supabase-jwt.verifier.js';
import { PushTokensController } from '../src/push/push-tokens.controller.js';
import { PushTokensService } from '../src/push/push-tokens.service.js';
import { createTestAuth, TEST_USER_ID } from './helpers/jwt.js';

describe('Push tokens (e2e, Fastify)', () => {
  let app: NestFastifyApplication;
  let token: string;
  const service = {
    register: vi.fn().mockResolvedValue(undefined),
    unregister: vi.fn().mockResolvedValue(undefined),
  };
  const DEVICE = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

  beforeAll(async () => {
    const auth = await createTestAuth();
    token = await auth.sign();
    const moduleRef = await Test.createTestingModule({
      controllers: [PushTokensController],
      providers: [
        { provide: PushTokensService, useValue: service },
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

  const call = (method: 'POST' | 'DELETE', payload: object) =>
    app.inject({
      method,
      url: '/push-tokens',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

  it('đăng ký token hợp lệ → 204', async () => {
    const res = await call('POST', {
      token: DEVICE,
      platform: 'IOS',
      deviceName: 'iPhone 15',
      appVersion: '1.0.0',
    });
    expect(res.statusCode).toBe(204);
    expect(service.register).toHaveBeenLastCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ token: DEVICE, platform: 'IOS' }),
    );
  });

  it('token sai định dạng hoặc nền tảng sai → 400', async () => {
    expect(
      (await call('POST', { token: 'abc', platform: 'IOS' })).statusCode,
    ).toBe(400);
    expect(
      (await call('POST', { token: DEVICE, platform: 'WEB' })).statusCode,
    ).toBe(400);
  });

  it('hủy đăng ký khi đăng xuất → 204', async () => {
    expect((await call('DELETE', { token: DEVICE })).statusCode).toBe(204);
    expect(service.unregister).toHaveBeenLastCalledWith(TEST_USER_ID, DEVICE);
  });
});
