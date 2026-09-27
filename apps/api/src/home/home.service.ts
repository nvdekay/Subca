import { Injectable } from '@nestjs/common';
import {
  daysBetween,
  monthlyEquivalentMinor,
  todayInTimeZone,
  type CurrencyCode,
  type HomeDto,
} from '@subca/shared';
import { fromDbDate } from '../common/db-date.js';
import { FxService, type RateTable } from '../fx/fx.service.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TIMEZONE,
  subscriptionInclude,
  TRACKED_STATUSES,
  toDto,
  type SubscriptionRow,
} from '../subscriptions/subscriptions.service.js';

const UPCOMING_LIMIT = 5;
const DUE_SOON_DAYS = 7;

/** Toàn bộ số liệu Trang chủ trong 1 request (nguyên tắc "một màn một request"). */
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly plan: PlanService,
  ) {}

  async getHome(userId: string, now = new Date()): Promise<HomeDto> {
    const [settings, budget, rows, isPlus] = await Promise.all([
      this.prisma.userSettings.findUnique({
        where: { userId },
        select: { currency: true, timezone: true },
      }),
      this.prisma.budget.findUnique({ where: { userId } }),
      this.prisma.subscription.findMany({
        where: { userId, status: { in: TRACKED_STATUSES } },
        include: subscriptionInclude,
        orderBy: [
          { nextRenewalDate: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
      }),
      this.plan.isPlus(userId, now),
    ]);

    const currency = (settings?.currency ?? 'VND') as CurrencyCode;
    const today = todayInTimeZone(settings?.timezone ?? DEFAULT_TIMEZONE, now);
    const rates = await this.fx.rateTable(
      currency,
      [...rows.map((r) => r.currency), ...(budget ? [budget.currency] : [])],
      today,
    );

    const missing = new Set<CurrencyCode>();
    const monthlyIn = (r: SubscriptionRow): bigint => {
      const own = monthlyEquivalentMinor(
        r.amountMinor,
        r.intervalUnit,
        r.intervalCount,
      );
      const converted = rates.convert(own, r.currency as CurrencyCode);
      if (converted === null) missing.add(r.currency as CurrencyCode);
      return converted ?? 0n;
    };

    const paying = rows.filter((r) => r.status !== 'TRIAL');
    const trials = rows
      .filter((r) => r.status === 'TRIAL')
      .sort(
        (a, b) =>
          (a.trialEndDate?.getTime() ?? Infinity) -
          (b.trialEndDate?.getTime() ?? Infinity),
      );
    const monthlyTotal = paying.reduce((sum, r) => sum + monthlyIn(r), 0n);
    const potentialSavings = paying
      .filter((r) => r.status === 'REVIEW')
      .reduce((sum, r) => sum + monthlyIn(r), 0n);
    const dueSoon = paying.filter((r) => {
      if (!r.nextRenewalDate) return false;
      const d = daysBetween(today, fromDbDate(r.nextRenewalDate));
      return d >= 0 && d < DUE_SOON_DAYS;
    }).length;

    return {
      currency,
      monthlyTotalMinor: monthlyTotal.toString(),
      yearlyProjectionMinor: (monthlyTotal * 12n).toString(),
      activeCount: paying.length,
      trialCount: trials.length,
      dueIn7DaysCount: dueSoon,
      potentialSavingsMinor: potentialSavings.toString(),
      budget: budget
        ? budgetStatus(budget, monthlyTotal, currency, rates, missing)
        : null,
      upcoming: paying
        .filter((r) => r.nextRenewalDate)
        .slice(0, UPCOMING_LIMIT)
        .map((r) => toDto(r, today)),
      trials: trials.map((r) => toDto(r, today)),
      missingRates: [...missing].sort(),
      plan: isPlus ? 'PLUS' : 'FREE',
    };
  }
}

function budgetStatus(
  budget: { amountMinor: bigint; currency: string; alertAtPercent: number },
  spentInUserCurrency: bigint,
  userCurrency: CurrencyCode,
  rates: RateTable,
  missing: Set<CurrencyCode>,
): NonNullable<HomeDto['budget']> {
  const budgetCurrency = budget.currency as CurrencyCode;
  // Hạn mức lưu theo tiền tệ riêng; quy về tiền tệ chính để so với chi tiêu
  const limit = rates.convert(budget.amountMinor, budgetCurrency);
  if (limit === null) missing.add(budgetCurrency);
  const percent =
    limit && limit > 0n
      ? Math.round((Number(spentInUserCurrency) / Number(limit)) * 100)
      : 0;
  return {
    amountMinor: budget.amountMinor.toString(),
    currency: budgetCurrency,
    alertAtPercent: budget.alertAtPercent,
    spentMinor: spentInUserCurrency.toString(),
    percent,
    overBudget: limit !== null && spentInUserCurrency > limit,
  };
}
