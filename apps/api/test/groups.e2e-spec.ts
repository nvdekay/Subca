import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AccountStatusService } from '../src/auth/account-status.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../src/auth/supabase-jwt.verifier.js';
import { GroupPaymentsService } from '../src/groups/group-payments.service.js';
import { GroupsController } from '../src/groups/groups.controller.js';
import { GroupsService } from '../src/groups/groups.service.js';
import { createTestAuth } from './helpers/jwt.js';

describe('Chia tiền nhóm (e2e)', () => {
  let app: NestFastifyApplication;
  let token: string;
  const GROUP = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
  const MEMBER = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';
  const PAYMENT = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d';
  const SUB = '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e';

  const groups = {
    overview: vi.fn().mockResolvedValue({ owned: [], joined: [] }),
    get: vi.fn().mockResolvedValue({ id: GROUP }),
    create: vi.fn().mockResolvedValue({ id: GROUP }),
    update: vi.fn().mockResolvedValue({ id: GROUP }),
    archive: vi.fn().mockResolvedValue(undefined),
    setSplit: vi.fn().mockResolvedValue({ id: GROUP }),
    addMember: vi.fn().mockResolvedValue({ id: GROUP }),
    updateMember: vi.fn().mockResolvedValue({ id: GROUP }),
    removeMember: vi.fn().mockResolvedValue(undefined),
    join: vi.fn().mockResolvedValue({ id: GROUP }),
  };
  const payments = {
    claim: vi.fn().mockResolvedValue({ id: GROUP }),
    confirm: vi.fn().mockResolvedValue({ id: GROUP }),
    waive: vi.fn().mockResolvedValue({ id: GROUP }),
    reopen: vi.fn().mockResolvedValue({ id: GROUP }),
    remind: vi.fn().mockResolvedValue({ id: GROUP }),
    remindAll: vi.fn().mockResolvedValue({ reminded: 2, skipped: 1 }),
  };

  beforeAll(async () => {
    const auth = await createTestAuth();
    token = await auth.sign();
    const moduleRef = await Test.createTestingModule({
      controllers: [GroupsController],
      providers: [
        { provide: GroupsService, useValue: groups },
        { provide: GroupPaymentsService, useValue: payments },
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
    payload?: unknown,
    withToken = true,
  ) =>
    app.inject({
      method,
      url,
      ...(payload === undefined ? {} : { payload: payload as object }),
      ...(withToken ? { headers: { authorization: `Bearer ${token}` } } : {}),
    });

  it('bắt buộc đăng nhập', async () => {
    const res = await call('GET', '/groups', undefined, false);
    expect(res.statusCode).toBe(401);
  });

  it('GET /groups trả tổng quan', async () => {
    const res = await call('GET', '/groups');
    expect(res.statusCode).toBe(200);
    expect(groups.overview).toHaveBeenCalled();
  });

  it('POST /groups tạo nhóm từ một gói đang trả', async () => {
    const res = await call('POST', '/groups', {
      subscriptionId: SUB,
      memberCount: 4,
    });
    expect(res.statusCode).toBe(201);
    expect(groups.create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ subscriptionId: SUB, memberCount: 4 }),
    );
  });

  it('POST /groups từ chối số người ngoài 2–6 và thiếu giá gói', async () => {
    const tooMany = await call('POST', '/groups', {
      subscriptionId: SUB,
      memberCount: 9,
    });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    const noPrice = await call('POST', '/groups', {
      name: 'Netflix',
      memberCount: 3,
    });
    expect(noPrice.statusCode).toBe(400);
  });

  it('POST /groups/join nhận mã mời viết thường', async () => {
    const res = await call('POST', '/groups/join', { inviteCode: 'abcd2345' });
    expect(res.statusCode).toBe(201);
    expect(groups.join).toHaveBeenCalledWith(expect.any(String), {
      inviteCode: 'ABCD2345',
    });
  });

  it('PUT /groups/:id/split kiểm tra dữ liệu chia tùy chỉnh', async () => {
    const ok = await call('PUT', `/groups/${GROUP}/split`, {
      splitMode: 'CUSTOM',
      shares: [
        { memberId: MEMBER, amountMinor: '100000' },
        { memberId: PAYMENT, amountMinor: '160000' },
      ],
    });
    expect(ok.statusCode).toBe(200);
    const bad = await call('PUT', `/groups/${GROUP}/split`, {
      splitMode: 'HALF',
    });
    expect(bad.statusCode).toBe(400);
  });

  it('thao tác khoản phải trả và nhắc thành viên', async () => {
    for (const action of [
      'claim',
      'confirm',
      'waive',
      'reopen',
      'remind',
    ] as const) {
      const res = await call(
        'POST',
        `/groups/${GROUP}/payments/${PAYMENT}/${action}`,
      );
      expect(res.statusCode).toBe(201);
      expect(payments[action]).toHaveBeenCalledWith(
        expect.any(String),
        GROUP,
        PAYMENT,
      );
    }
    const all = await call('POST', `/groups/${GROUP}/remind-all`);
    expect(all.json()).toEqual({ reminded: 2, skipped: 1 });
  });

  it('thêm / đổi tên / gỡ thành viên', async () => {
    const added = await call('POST', `/groups/${GROUP}/members`, {
      displayName: 'Thùy Linh',
    });
    expect(added.statusCode).toBe(201);
    const renamed = await call('PATCH', `/groups/${GROUP}/members/${MEMBER}`, {
      displayName: 'Linh',
    });
    expect(renamed.statusCode).toBe(200);
    const removed = await call('DELETE', `/groups/${GROUP}/members/${MEMBER}`);
    expect(removed.statusCode).toBe(204);
    const empty = await call('POST', `/groups/${GROUP}/members`, {
      displayName: ' ',
    });
    expect(empty.statusCode).toBe(400);
  });

  it('xóa nhóm trả 204 và ID sai định dạng trả 400', async () => {
    expect((await call('DELETE', `/groups/${GROUP}`)).statusCode).toBe(204);
    expect((await call('GET', '/groups/khong-phai-uuid')).statusCode).toBe(400);
  });
});
