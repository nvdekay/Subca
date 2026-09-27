import type { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

/**
 * Smoke test: khởi động TOÀN BỘ AppModule thật (DI, BullMQ + Redis, cron) để bắt lỗi nối module
 * mà các test khai báo thủ công không thấy. Cần Redis (local: docker compose; CI: service redis).
 * Không cần database: Prisma chỉ kết nối khi truy vấn.
 */
describe('AppModule khởi động được (smoke)', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgresql://smoke:smoke@127.0.0.1:1/smoke',
      SUPABASE_URL: process.env['SUPABASE_URL'] ?? 'https://smoke.supabase.co',
      REDIS_URL: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      FX_SYNC_ENABLED: 'false',
      REMINDERS_ENABLED: 'false',
    });
    // Import sau khi đặt biến môi trường: ConfigModule đọc env khi module được nạp
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('đăng ký đủ các route chính', async () => {
    const fastify = (app as NestFastifyApplication)
      .getHttpAdapter()
      .getInstance();
    const routes = fastify.printRoutes({ commonPrefix: false });
    for (const path of [
      'health',
      'me',
      'subscriptions',
      'home',
      'calendar',
      'reviews',
      'analytics',
      'payment-methods',
      'push-tokens',
      'catalog',
    ]) {
      expect(routes).toContain(path);
    }
  });

  it('endpoint cần đăng nhập trả 401 khi thiếu token', async () => {
    const res = await (app as NestFastifyApplication).inject({
      method: 'GET',
      url: '/home',
    });
    expect(res.statusCode).toBe(401);
  });
});
