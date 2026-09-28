import { Injectable } from '@nestjs/common';
import {
  addDays,
  monthlyEquivalentMinor,
  todayInTimeZone,
  type AdminOverviewDto,
  type CurrencyCode,
  type IsoDate,
} from '@subca/shared';
import { FxService } from '../fx/fx.service.js';
import { activeEntitlementWhere } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TIMEZONE,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';

/** Trang Tổng quan của admin: số liệu lấy từ database của Subca (PostHog để sau). */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async get(now = new Date()): Promise<AdminOverviewDto> {
    const today = todayInTimeZone(DEFAULT_TIMEZONE, now);
    const since30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [
      total,
      new30d,
      active7d,
      banned,
      plus,
      tracked,
      trial,
      cancelled30d,
      sent7d,
      failed7d,
      opened7d,
      pending,
      groups,
      members,
      signupRows,
      trackedSubs,
      cancelledSubs,
      topServiceRows,
    ] = await Promise.all([
      this.prisma.profile.count(),
      this.prisma.profile.count({ where: { createdAt: { gte: since30d } } }),
      this.prisma.profile.count({ where: { lastActiveAt: { gte: since7d } } }),
      this.prisma.profile.count({ where: { bannedAt: { not: null } } }),
      this.prisma.entitlement
        .findMany({
          where: activeEntitlementWhere(now),
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length),
      this.prisma.subscription.count({
        where: { status: { in: TRACKED_STATUSES } },
      }),
      this.prisma.subscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.subscription.count({
        where: { status: 'CANCELLED', cancelledAt: { gte: since30d } },
      }),
      this.prisma.reminder.count({
        where: { status: 'SENT', sentAt: { gte: since7d } },
      }),
      this.prisma.reminder.count({
        where: { status: 'FAILED', scheduledAt: { gte: since7d } },
      }),
      this.prisma.reminder.count({
        where: { openedAt: { not: null }, sentAt: { gte: since7d } },
      }),
      this.prisma.reminder.count({ where: { status: 'PENDING' } }),
      this.prisma.group.count({ where: { archivedAt: null } }),
      this.prisma.groupMember.count({ where: { status: 'ACTIVE' } }),
      this.prisma.profile.findMany({
        where: { createdAt: { gte: since30d } },
        select: { createdAt: true },
      }),
      this.prisma.subscription.findMany({
        where: { status: { in: TRACKED_STATUSES } },
        select: {
          amountMinor: true,
          currency: true,
          intervalUnit: true,
          intervalCount: true,
          status: true,
        },
      }),
      this.prisma.subscription.findMany({
        where: { status: 'CANCELLED', cancelledAt: { gte: since30d } },
        select: {
          amountMinor: true,
          currency: true,
          intervalUnit: true,
          intervalCount: true,
        },
      }),
      this.prisma.subscription.groupBy({
        by: ['serviceId'],
        where: { status: { in: TRACKED_STATUSES }, serviceId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 6,
      }),
    ]);

    const currency: CurrencyCode = 'VND';
    const rates = await this.fx.rateTable(
      currency,
      [...trackedSubs, ...cancelledSubs].map((s) => s.currency),
      today,
    );
    const missing = new Set<CurrencyCode>();
    const sumMonthly = (
      rows: {
        amountMinor: bigint;
        currency: string;
        intervalUnit: string;
        intervalCount: number;
      }[],
      skipTrial = false,
    ): bigint => {
      let total = 0n;
      for (const row of rows) {
        if (skipTrial && 'status' in row && row.status === 'TRIAL') continue;
        const monthly = monthlyEquivalentMinor(
          row.amountMinor,
          row.intervalUnit as never,
          row.intervalCount,
        );
        const converted = rates.convert(monthly, row.currency as CurrencyCode);
        if (converted === null) missing.add(row.currency as CurrencyCode);
        else total += converted;
      }
      return total;
    };

    const services = await this.prisma.service.findMany({
      where: {
        id: { in: topServiceRows.map((r) => r.serviceId!).filter(Boolean) },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        logoKey: true,
        brandColor: true,
      },
    });
    const serviceById = new Map(services.map((s) => [s.id, s]));

    return {
      currency,
      users: { total, new30d, active7d, banned, plus },
      subscriptions: {
        tracked,
        trial,
        cancelled30d,
        trackedMonthlyMinor: sumMonthly(trackedSubs, true).toString(),
        savedMonthlyMinor: sumMonthly(cancelledSubs).toString(),
      },
      reminders: {
        sent7d,
        failed7d,
        openRate7d: sent7d > 0 ? Math.round((opened7d / sent7d) * 100) : 0,
        pending,
      },
      groups: { total: groups, members },
      signups: dailyCounts(
        signupRows.map((r) => r.createdAt),
        today,
        30,
      ),
      topServices: topServiceRows.map((row) => {
        const service = row.serviceId
          ? (serviceById.get(row.serviceId) ?? null)
          : null;
        return {
          service,
          name: service?.name ?? 'Tự nhập',
          count: row._count._all,
        };
      }),
      missingRates: [...missing],
    };
  }
}

/** Đếm số bản ghi theo từng ngày trong `days` ngày gần nhất (cũ → mới), kể cả ngày không có ai. */
function dailyCounts(
  dates: Date[],
  today: IsoDate,
  days: number,
): { date: IsoDate; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    // Gom theo ngày giờ Việt Nam để khớp với cách đọc số liệu của đội ngũ
    const key = todayInTimeZone(DEFAULT_TIMEZONE, d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, count: counts.get(date) ?? 0 };
  });
}
