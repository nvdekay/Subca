import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FREE_LIMITS } from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MeService } from './me.service.js';

const user: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'khanh@subca.app',
  aal: 'aal1',
  sessionId: null,
};
const now = new Date('2026-09-27T03:00:00Z');

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: user.id,
    email: 'khanh@subca.app',
    displayName: 'Khánh Nguyễn',
    avatarUrl: null,
    referralCode: 'AB12CD34',
    bannedAt: null,
    lastActiveAt: new Date('2026-09-27T02:30:00Z'),
    createdAt: new Date('2026-09-01T00:00:00Z'),
    settings: {
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      locale: 'vi-VN',
      reminderMinuteOfDay: 510,
      notificationsEnabled: true,
    },
    entitlements: [],
    ...overrides,
  };
}

function setup(p: unknown) {
  const prisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue(p),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { prisma, service: new MeService(prisma as unknown as PrismaService) };
}

describe('MeService', () => {
  it('người dùng Free: trả về giới hạn gói Free', async () => {
    const { service } = setup(profile());
    const me = await service.getMe(user, now);
    expect(me.plan.tier).toBe('FREE');
    expect(me.limits).toEqual(FREE_LIMITS);
    expect(me.settings?.reminderMinuteOfDay).toBe(510);
  });

  it('người dùng Plus: không có giới hạn', async () => {
    const expiresAt = new Date('2027-09-27T00:00:00Z');
    const { service } = setup(
      profile({
        entitlements: [
          {
            product: 'PLUS_YEARLY',
            status: 'TRIAL',
            expiresAt,
            willRenew: true,
          },
        ],
      }),
    );
    const me = await service.getMe(user, now);
    expect(me.plan).toEqual({
      tier: 'PLUS',
      product: 'PLUS_YEARLY',
      status: 'TRIAL',
      expiresAt,
      willRenew: true,
    });
    expect(me.limits).toBeNull();
  });

  it('chỉ lấy quyền Plus còn hiệu lực', async () => {
    const { prisma, service } = setup(profile());
    await service.getMe(user, now);
    const args = prisma.profile.findUnique.mock.calls[0]![0];
    expect(args.include.entitlements.where).toEqual({
      status: { not: 'EXPIRED' },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    });
  });

  it('ghi lại hoạt động gần nhất tối đa 1 lần/giờ', async () => {
    const recent = setup(profile());
    await recent.service.getMe(user, now);
    expect(recent.prisma.profile.update).not.toHaveBeenCalled();

    const stale = setup(
      profile({ lastActiveAt: new Date('2026-09-27T01:00:00Z') }),
    );
    await stale.service.getMe(user, now);
    expect(stale.prisma.profile.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { lastActiveAt: now },
    });
  });

  it('không có profile → 404 PROFILE_NOT_FOUND', async () => {
    const { service } = setup(null);
    await expect(service.getMe(user, now)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('tài khoản bị khóa → 403 ACCOUNT_BANNED', async () => {
    const { service } = setup(profile({ bannedAt: new Date() }));
    await expect(service.getMe(user, now)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
