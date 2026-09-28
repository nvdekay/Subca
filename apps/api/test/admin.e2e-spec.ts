import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AdminCatalogService } from '../src/admin/admin-catalog.service.js';
import { AdminOverviewService } from '../src/admin/admin-overview.service.js';
import { AdminQueueService } from '../src/admin/admin-queue.service.js';
import { AdminUsersService } from '../src/admin/admin-users.service.js';
import { AdminController } from '../src/admin/admin.controller.js';
import { AdminGuard } from '../src/admin/admin.guard.js';
import { AccountStatusService } from '../src/auth/account-status.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../src/auth/supabase-jwt.verifier.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestAuth, TEST_USER_ID } from './helpers/jwt.js';

describe('Admin Console (e2e)', () => {
  let app: NestFastifyApplication;
  /** Token của phiên đã qua MFA (aal2) và phiên chưa qua MFA. */
  let token: string;
  let tokenNoMfa: string;
  const USER = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';
  const SERVICE = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d';

  const adminRow = {
    id: TEST_USER_ID,
    email: 'admin@subca.app',
    name: 'Khánh',
    role: 'OWNER' as const,
    isActive: true,
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };
  const prisma = {
    adminUser: {
      findUnique: vi.fn(async () => adminRow),
      update: vi.fn(async () => adminRow),
    },
  };
  const overview = { get: vi.fn().mockResolvedValue({ users: { total: 12 } }) };
  const users = {
    list: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    get: vi.fn().mockResolvedValue({ id: USER }),
    ban: vi.fn().mockResolvedValue({ id: USER }),
    unban: vi.fn().mockResolvedValue({ id: USER }),
    grantPlus: vi.fn().mockResolvedValue({ id: USER }),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  };
  const catalog = {
    services: vi.fn().mockResolvedValue([]),
    createService: vi.fn().mockResolvedValue({ id: SERVICE }),
    updateService: vi.fn().mockResolvedValue({ id: SERVICE }),
    upsertPlan: vi.fn().mockResolvedValue({ id: SERVICE }),
    priceReports: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    reviewPriceReport: vi.fn().mockResolvedValue({ id: 'r1' }),
    auditLogs: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 }),
  };
  const queue = {
    get: vi.fn().mockResolvedValue({ name: 'reminders', connected: true }),
  };

  beforeAll(async () => {
    const auth = await createTestAuth();
    token = await auth.sign({ aal: 'aal2' });
    tokenNoMfa = await auth.sign();
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminOverviewService, useValue: overview },
        { provide: AdminUsersService, useValue: users },
        { provide: AdminCatalogService, useValue: catalog },
        { provide: AdminQueueService, useValue: queue },
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

  beforeEach(() => {
    prisma.adminUser.findUnique.mockResolvedValue(adminRow);
  });

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown,
    bearer: string | null = token,
  ) =>
    app.inject({
      method,
      url,
      ...(payload === undefined ? {} : { payload: payload as object }),
      ...(bearer ? { headers: { authorization: `Bearer ${bearer}` } } : {}),
    });

  it('chưa đăng nhập → 401', async () => {
    expect(
      (await call('GET', '/admin/overview', undefined, null)).statusCode,
    ).toBe(401);
  });

  it('phiên chưa qua MFA → 403 MFA_REQUIRED', async () => {
    const res = await call('GET', '/admin/overview', undefined, tokenNoMfa);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'MFA_REQUIRED' });
  });

  it('không phải admin → 403 NOT_ADMIN', async () => {
    prisma.adminUser.findUnique.mockResolvedValueOnce(null as never);
    const res = await call('GET', '/admin/overview');
    expect(res.json()).toMatchObject({ code: 'NOT_ADMIN' });
  });

  it('GET /admin/me trả vai trò và quyền', async () => {
    const res = await call('GET', '/admin/me');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      role: 'OWNER',
      permissions: expect.arrayContaining([
        'read',
        'manageUsers',
        'deleteUsers',
      ]),
    });
  });

  it('tổng quan và hàng đợi', async () => {
    expect((await call('GET', '/admin/overview')).statusCode).toBe(200);
    expect((await call('GET', '/admin/queues')).json()).toMatchObject({
      connected: true,
    });
  });

  it('danh sách người dùng nhận tham số lọc dạng chuỗi', async () => {
    const res = await call(
      'GET',
      '/admin/users?q=linh&plan=PLUS&page=2&pageSize=50',
    );
    expect(res.statusCode).toBe(200);
    expect(users.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'linh',
        plan: 'PLUS',
        page: 2,
        pageSize: 50,
      }),
    );
    expect((await call('GET', '/admin/users?plan=GOLD')).statusCode).toBe(400);
  });

  it('khóa tài khoản bắt buộc có lý do', async () => {
    const ok = await call('POST', `/admin/users/${USER}/ban`, {
      reason: 'Spam nhóm',
    });
    expect(ok.statusCode).toBe(201);
    expect(users.ban).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEST_USER_ID }),
      USER,
      { reason: 'Spam nhóm' },
      expect.anything(),
    );
    expect(
      (await call('POST', `/admin/users/${USER}/ban`, {})).statusCode,
    ).toBe(400);
  });

  it('vai trò SUPPORT tặng được Plus nhưng không xóa được dữ liệu', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      ...adminRow,
      role: 'SUPPORT',
    } as never);
    const grant = await call('POST', `/admin/users/${USER}/plus`, {
      months: 1,
      reason: 'Đền bù lỗi nhắc',
    });
    expect(grant.statusCode).toBe(201);
    const remove = await call('DELETE', `/admin/users/${USER}`);
    expect(remove.statusCode).toBe(403);
    expect(remove.json()).toMatchObject({ code: 'ADMIN_FORBIDDEN' });
    expect(users.deleteUser).not.toHaveBeenCalled();
  });

  it('vai trò MARKETING sửa được thư viện, không khóa được tài khoản', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      ...adminRow,
      role: 'MARKETING',
    } as never);
    const created = await call('POST', '/admin/services', {
      slug: 'fptplay',
      name: 'FPT Play',
    });
    expect(created.statusCode).toBe(201);
    const banned = await call('POST', `/admin/users/${USER}/ban`, {
      reason: 'Thử',
    });
    expect(banned.statusCode).toBe(403);
  });

  it('OWNER xóa được dữ liệu người dùng (204) và duyệt đề xuất giá', async () => {
    expect((await call('DELETE', `/admin/users/${USER}`)).statusCode).toBe(204);
    const review = await call(
      'POST',
      `/admin/price-reports/${SERVICE}/review`,
      {
        decision: 'APPROVE',
      },
    );
    expect(review.statusCode).toBe(201);
    const bad = await call('POST', `/admin/price-reports/${SERVICE}/review`, {
      decision: 'MAYBE',
    });
    expect(bad.statusCode).toBe(400);
  });

  it('nhật ký thao tác lọc theo mức độ', async () => {
    const res = await call('GET', '/admin/audit-logs?severity=CRITICAL');
    expect(res.statusCode).toBe(200);
    expect(catalog.auditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'CRITICAL', page: 1 }),
    );
  });
});
