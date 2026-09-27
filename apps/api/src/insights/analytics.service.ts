import { Injectable } from '@nestjs/common';
import {
  addMonthsToMonth,
  monthlyEquivalentMinor,
  monthRange,
  USES_PER_MONTH,
  type AnalyticsDto,
  type AnalyticsSliceDto,
  type CostPerUseDto,
  type CurrencyCode,
} from '@subca/shared';
import { toDbDate } from '../common/db-date.js';
import { loadUserContext } from '../common/user-context.js';
import { FxService } from '../fx/fx.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { subscriptionInclude } from '../subscriptions/subscriptions.service.js';

const TREND_MONTHS = 6;
const TOP_N = 5;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async get(userId: string, now = new Date()): Promise<AnalyticsDto> {
    const ctx = await loadUserContext(this.prisma, userId, now);
    const currentMonth = ctx.today.slice(0, 7);
    const trendStart = monthRange(
      addMonthsToMonth(currentMonth, -(TREND_MONTHS - 1)),
    ).start;

    // Gồm cả gói đã hủy/lưu trữ gần đây để ước tính xu hướng các tháng trước
    const subs = await this.prisma.subscription.findMany({
      where: {
        userId,
        OR: [
          { status: { in: ['ACTIVE', 'REVIEW'] } },
          { cancelledAt: { gte: toDbDate(trendStart) } },
          { archivedAt: { gte: toDbDate(trendStart) } },
        ],
      },
      include: {
        ...subscriptionInclude,
        paymentMethod: {
          select: { id: true, label: true, last4: true, archivedAt: true },
        },
      },
    });
    const rates = await this.fx.rateTable(
      ctx.currency,
      subs.map((s) => s.currency),
      ctx.today,
    );
    const missing = new Set<CurrencyCode>();
    const monthlyOf = (s: (typeof subs)[number]): bigint => {
      const converted = rates.convert(
        monthlyEquivalentMinor(s.amountMinor, s.intervalUnit, s.intervalCount),
        s.currency as CurrencyCode,
      );
      if (converted === null) missing.add(s.currency as CurrencyCode);
      return converted ?? 0n;
    };

    const paying = subs.filter(
      (s) => s.status === 'ACTIVE' || s.status === 'REVIEW',
    );
    const monthly = new Map(paying.map((s) => [s.id, monthlyOf(s)]));
    const total = [...monthly.values()].reduce((a, b) => a + b, 0n);
    const nameOf = (s: (typeof subs)[number]) =>
      s.customName ?? s.service?.name ?? 'Subscription';

    const slices = (
      keyOf: (s: (typeof paying)[number]) => {
        id: string | null;
        label: string;
        color: string | null;
      },
    ) => {
      const groups = new Map<string, AnalyticsSliceDto & { sum: bigint }>();
      for (const s of paying) {
        const key = keyOf(s);
        const g = groups.get(key.id ?? '∅') ?? {
          ...key,
          monthlyMinor: '0',
          percent: 0,
          sum: 0n,
        };
        g.sum += monthly.get(s.id)!;
        groups.set(key.id ?? '∅', g);
      }
      return [...groups.values()]
        .sort((a, b) => Number(b.sum - a.sum))
        .map(({ sum, ...g }) => ({
          ...g,
          monthlyMinor: sum.toString(),
          percent:
            total > 0n ? Math.round((Number(sum) / Number(total)) * 100) : 0,
        }));
    };

    const costPerUse: CostPerUseDto[] = paying
      .filter((s) => s.usageFrequency && USES_PER_MONTH[s.usageFrequency] > 0)
      .map((s) => {
        const uses = USES_PER_MONTH[s.usageFrequency!];
        const m = monthly.get(s.id)!;
        return {
          subscriptionId: s.id,
          name: nameOf(s),
          service: s.service,
          monthlyMinor: m.toString(),
          usageFrequency: s.usageFrequency!,
          usesPerMonth: uses,
          costPerUseMinor: ((m + BigInt(uses) / 2n) / BigInt(uses)).toString(),
        };
      })
      .sort((a, b) =>
        Number(BigInt(b.costPerUseMinor) - BigInt(a.costPerUseMinor)),
      );

    // Xu hướng: tổng chi phí tháng của các gói đã tồn tại và chưa kết thúc trong từng tháng (ước tính)
    const trend = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const month = addMonthsToMonth(currentMonth, i - (TREND_MONTHS - 1));
      const { start, end } = monthRange(month);
      const startAt = toDbDate(start);
      const endAt = new Date(toDbDate(end).getTime() + 86_400_000);
      const sum = subs
        .filter((s) => s.status !== 'TRIAL')
        .filter((s) => s.createdAt < endAt)
        .filter((s) => !s.cancelledAt || s.cancelledAt >= startAt)
        .filter((s) => !s.archivedAt || s.archivedAt >= startAt)
        .reduce((acc, s) => acc + (monthly.get(s.id) ?? monthlyOf(s)), 0n);
      return { month, totalMinor: sum.toString() };
    });

    return {
      currency: ctx.currency,
      monthlyTotalMinor: total.toString(),
      yearlyProjectionMinor: (total * 12n).toString(),
      dailyAverageMinor: ((total * 12n + 182n) / 365n).toString(),
      byPaymentMethod: slices((s) =>
        s.paymentMethod && !s.paymentMethod.archivedAt
          ? {
              id: s.paymentMethod.id,
              label: s.paymentMethod.last4
                ? `${s.paymentMethod.label} •• ${s.paymentMethod.last4}`
                : s.paymentMethod.label,
              color: null,
            }
          : { id: null, label: 'Chưa chọn phương thức', color: null },
      ),
      topExpensive: [...paying]
        .sort((a, b) => Number(monthly.get(b.id)! - monthly.get(a.id)!))
        .slice(0, TOP_N)
        .map((s) => ({
          subscriptionId: s.id,
          name: nameOf(s),
          service: s.service,
          monthlyMinor: monthly.get(s.id)!.toString(),
        })),
      costPerUse,
      trend,
      missingRates: [...missing].sort(),
    };
  }
}
