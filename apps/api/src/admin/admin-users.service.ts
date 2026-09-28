import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  monthlyEquivalentMinor,
  todayInTimeZone,
  type AdminUserDetailDto,
  type AdminUserRowDto,
  type AdminUsersDto,
  type AdminUsersQuery,
  type BanUser,
  type CurrencyCode,
  type GrantPlus,
  type IsoDate,
} from '@subca/shared';
import { AccountStatusService } from '../auth/account-status.service.js';
import { fromDbDate } from '../common/db-date.js';
import { FxService } from '../fx/fx.service.js';
import type { AdminUser, Prisma } from '../generated/prisma/client.js';
import { AccountService } from '../me/account.service.js';
import { activeEntitlementWhere } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TIMEZONE,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';
import { AuditService } from './audit.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trang Người dùng của admin: tìm kiếm, xem chi tiết, khóa, tặng Plus, xóa dữ liệu. */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly audit: AuditService,
    private readonly accountStatus: AccountStatusService,
    private readonly account: AccountService,
  ) {}

  async list(query: AdminUsersQuery, now = new Date()): Promise<AdminUsersDto> {
    const where: Prisma.ProfileWhereInput = {
      ...(query.status === 'BANNED'
        ? { bannedAt: { not: null } }
        : query.status === 'ACTIVE'
          ? { bannedAt: null }
          : {}),
      ...(query.plan === 'PLUS'
        ? { entitlements: { some: activeEntitlementWhere(now) } }
        : query.plan === 'FREE'
          ? { entitlements: { none: activeEntitlementWhere(now) } }
          : {}),
      ...(query.q
        ? UUID_RE.test(query.q)
          ? { id: query.q }
          : {
              OR: [
                { email: { contains: query.q, mode: 'insensitive' } },
                { displayName: { contains: query.q, mode: 'insensitive' } },
              ],
            }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.profile.count({ where }),
      this.prisma.profile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
          lastActiveAt: true,
          bannedAt: true,
          entitlements: {
            where: activeEntitlementWhere(now),
            select: { id: true },
            take: 1,
          },
          subscriptions: {
            where: { status: { in: TRACKED_STATUSES } },
            select: {
              amountMinor: true,
              currency: true,
              intervalUnit: true,
              intervalCount: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const today = todayInTimeZone(DEFAULT_TIMEZONE, now);
    const rates = await this.fx.rateTable(
      'VND',
      rows.flatMap((r) => r.subscriptions.map((s) => s.currency)),
      today,
    );

    const items: AdminUserRowDto[] = rows.map((row) => {
      let monthly = 0n;
      for (const s of row.subscriptions) {
        if (s.status === 'TRIAL') continue;
        monthly +=
          rates.convert(
            monthlyEquivalentMinor(
              s.amountMinor,
              s.intervalUnit,
              s.intervalCount,
            ),
            s.currency as CurrencyCode,
          ) ?? 0n;
      }
      return {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        plan: row.entitlements.length > 0 ? 'PLUS' : 'FREE',
        subscriptionCount: row.subscriptions.length,
        monthlyMinor: monthly.toString(),
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
        bannedAt: row.bannedAt?.toISOString() ?? null,
      };
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(userId: string, now = new Date()): Promise<AdminUserDetailDto> {
    const row = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: {
        settings: true,
        pushTokens: { orderBy: { lastSeenAt: 'desc' }, take: 10 },
        entitlements: {
          where: activeEntitlementWhere(now),
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        subscriptions: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { nextRenewalDate: { sort: 'asc', nulls: 'last' } },
          include: {
            service: {
              select: {
                id: true,
                slug: true,
                name: true,
                logoKey: true,
                brandColor: true,
              },
            },
          },
        },
        groupMemberships: {
          where: { status: { not: 'LEFT' } },
          include: {
            group: { include: { _count: { select: { members: true } } } },
          },
        },
      },
    });
    if (!row) throw userNotFound();

    const [sent, failed, opened] = await Promise.all([
      this.prisma.reminder.count({ where: { userId, status: 'SENT' } }),
      this.prisma.reminder.count({ where: { userId, status: 'FAILED' } }),
      this.prisma.reminder.count({
        where: { userId, openedAt: { not: null } },
      }),
    ]);

    const today = todayInTimeZone(
      row.settings?.timezone ?? DEFAULT_TIMEZONE,
      now,
    );
    const rates = await this.fx.rateTable(
      'VND',
      row.subscriptions.map((s) => s.currency),
      today,
    );
    let monthly = 0n;
    let trackedCount = 0;
    for (const s of row.subscriptions) {
      if (!TRACKED_STATUSES.includes(s.status)) continue;
      trackedCount++;
      if (s.status === 'TRIAL') continue;
      monthly +=
        rates.convert(
          monthlyEquivalentMinor(
            s.amountMinor,
            s.intervalUnit,
            s.intervalCount,
          ),
          s.currency as CurrencyCode,
        ) ?? 0n;
    }
    const entitlement = row.entitlements[0] ?? null;

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      plan: entitlement ? 'PLUS' : 'FREE',
      subscriptionCount: trackedCount,
      monthlyMinor: monthly.toString(),
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
      bannedAt: row.bannedAt?.toISOString() ?? null,
      banReason: row.banReason,
      referralCode: row.referralCode,
      settings: row.settings
        ? {
            currency: row.settings.currency as CurrencyCode,
            timezone: row.settings.timezone,
            notificationsEnabled: row.settings.notificationsEnabled,
          }
        : null,
      entitlement: entitlement
        ? {
            product: entitlement.product,
            store: entitlement.store,
            status: entitlement.status,
            startedAt: entitlement.startedAt.toISOString(),
            expiresAt: entitlement.expiresAt?.toISOString() ?? null,
          }
        : null,
      devices: row.pushTokens.map((t) => ({
        platform: t.platform,
        deviceName: t.deviceName,
        lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
      })),
      subscriptions: row.subscriptions.map((s) => ({
        id: s.id,
        name: s.customName ?? s.service?.name ?? 'Subscription',
        service: s.service,
        status: s.status,
        amountMinor: s.amountMinor.toString(),
        currency: s.currency as CurrencyCode,
        nextRenewalDate: (s.nextRenewalDate
          ? fromDbDate(s.nextRenewalDate)
          : null) as IsoDate | null,
      })),
      reminders: { sent, failed, opened },
      groups: row.groupMemberships.map((m) => ({
        id: m.groupId,
        name: m.group.name,
        isOwner: m.role === 'OWNER',
        memberCount: m.group._count.members,
      })),
    };
  }

  async ban(
    admin: AdminUser,
    userId: string,
    input: BanUser,
    ip: string | null,
  ): Promise<AdminUserDetailDto> {
    await this.assertExists(userId);
    await this.prisma.profile.update({
      where: { id: userId },
      data: { bannedAt: new Date(), banReason: input.reason },
    });
    this.accountStatus.invalidate(userId);
    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.userBan,
      targetType: 'profile',
      targetId: userId,
      metadata: { reason: input.reason },
      severity: 'SENSITIVE',
      ip,
    });
    return this.get(userId);
  }

  async unban(
    admin: AdminUser,
    userId: string,
    ip: string | null,
  ): Promise<AdminUserDetailDto> {
    await this.assertExists(userId);
    await this.prisma.profile.update({
      where: { id: userId },
      data: { bannedAt: null, banReason: null },
    });
    this.accountStatus.invalidate(userId);
    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.userUnban,
      targetType: 'profile',
      targetId: userId,
      severity: 'SENSITIVE',
      ip,
    });
    return this.get(userId);
  }

  /**
   * Tặng Plus: tạo quyền với store `PROMO` (không đi qua RevenueCat). Nếu đang có quyền tặng
   * còn hạn thì cộng thêm thời gian vào quyền đó thay vì tạo quyền chồng nhau.
   */
  async grantPlus(
    admin: AdminUser,
    userId: string,
    input: GrantPlus,
    ip: string | null,
    now = new Date(),
  ): Promise<AdminUserDetailDto> {
    await this.assertExists(userId);
    const lifetime = input.months === undefined;
    const existing = await this.prisma.entitlement.findFirst({
      where: { userId, store: 'PROMO', ...activeEntitlementWhere(now) },
      orderBy: { startedAt: 'desc' },
    });

    if (existing) {
      const base =
        existing.expiresAt && existing.expiresAt > now
          ? existing.expiresAt
          : now;
      await this.prisma.entitlement.update({
        where: { id: existing.id },
        data: lifetime
          ? {
              product: 'PLUS_LIFETIME',
              status: 'ACTIVE',
              expiresAt: null,
              willRenew: false,
            }
          : { status: 'ACTIVE', expiresAt: addMonths(base, input.months!) },
      });
    } else {
      await this.prisma.entitlement.create({
        data: {
          userId,
          product: lifetime ? 'PLUS_LIFETIME' : 'PLUS_MONTHLY',
          store: 'PROMO',
          status: 'ACTIVE',
          willRenew: false,
          startedAt: now,
          expiresAt: lifetime ? null : addMonths(now, input.months!),
        },
      });
    }

    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.userGrantPlus,
      targetType: 'profile',
      targetId: userId,
      metadata: { months: input.months ?? null, reason: input.reason },
      severity: 'SENSITIVE',
      ip,
    });
    return this.get(userId);
  }

  /** Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu (cần `SUPABASE_SERVICE_ROLE_KEY`). */
  async deleteUser(
    admin: AdminUser,
    userId: string,
    ip: string | null,
  ): Promise<void> {
    const user = await this.assertExists(userId);
    await this.account.deleteAccount(userId);
    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.userDelete,
      targetType: 'profile',
      targetId: userId,
      metadata: { email: user.email },
      severity: 'CRITICAL',
      ip,
    });
  }

  private async assertExists(
    userId: string,
  ): Promise<{ email: string | null }> {
    const user = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw userNotFound();
    return user;
  }
}

/** Cộng tháng cho mốc thời gian, giữ ngày trong tháng (31/01 + 1 tháng = 28/02). */
function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

function userNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'USER_NOT_FOUND',
    message: 'Không tìm thấy người dùng',
  });
}
