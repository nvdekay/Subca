import { BadRequestException, Injectable } from '@nestjs/common';
import {
  compareIsoDate,
  monthRange,
  renewalsBetween,
  type CalendarDayDto,
  type CalendarDto,
  type CalendarItemDto,
  type CurrencyCode,
} from '@subca/shared';
import { fromDbDate } from '../common/db-date.js';
import { loadUserContext } from '../common/user-context.js';
import { FxService } from '../fx/fx.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  subscriptionInclude,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';

/** Giới hạn tháng xem được so với tháng hiện tại, tránh truy vấn vô nghĩa. */
const MAX_MONTHS_AWAY = 24;

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async month(
    userId: string,
    month: string | undefined,
    now = new Date(),
  ): Promise<CalendarDto> {
    const ctx = await loadUserContext(this.prisma, userId, now);
    const current = ctx.today.slice(0, 7);
    const target = month ?? current;
    const [ty, tm] = target.split('-').map(Number) as [number, number];
    const [cy, cm] = current.split('-').map(Number) as [number, number];
    if (Math.abs((ty - cy) * 12 + (tm - cm)) > MAX_MONTHS_AWAY) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: `Chỉ xem được trong khoảng ${MAX_MONTHS_AWAY} tháng so với hiện tại`,
      });
    }
    const { start, end } = monthRange(target);

    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: TRACKED_STATUSES } },
      include: subscriptionInclude,
    });

    const byDate = new Map<string, CalendarItemDto[]>();
    for (const sub of subs) {
      const startDate = fromDbDate(sub.startDate);
      const schedule = {
        startDate,
        anchorDay: sub.anchorDay,
        intervalUnit: sub.intervalUnit,
        intervalCount: sub.intervalCount,
      };
      // Mọi kỳ trong tháng tính từ ngày bắt đầu lịch; với trial, kỳ đầu chính là ngày hết trial
      const trialEnd =
        sub.status === 'TRIAL' && sub.trialEndDate
          ? fromDbDate(sub.trialEndDate)
          : null;
      for (const date of renewalsBetween(schedule, start, end, 62)) {
        const list = byDate.get(date) ?? [];
        list.push({
          subscriptionId: sub.id,
          name: sub.customName ?? sub.service?.name ?? 'Subscription',
          service: sub.service,
          amountMinor: sub.amountMinor.toString(),
          currency: sub.currency as CurrencyCode,
          kind: trialEnd === date ? 'TRIAL_END' : 'RENEWAL',
        });
        byDate.set(date, list);
      }
    }

    const days: CalendarDayDto[] = [...byDate.entries()]
      .sort(([a], [b]) => compareIsoDate(a, b))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      }));
    const all = days.flatMap((d) => d.items);
    const rates = await this.fx.rateTable(
      ctx.currency,
      all.map((i) => i.currency),
      ctx.today,
    );
    const missing = new Set<CurrencyCode>();
    let total = 0n;
    for (const item of all) {
      if (item.kind === 'TRIAL_END') continue; // ngày hết trial: chưa chắc bị trừ tiền
      const converted = rates.convert(BigInt(item.amountMinor), item.currency);
      if (converted === null) missing.add(item.currency);
      else total += converted;
    }
    return {
      month: target,
      currency: ctx.currency,
      days,
      totalMinor: total.toString(),
      count: all.length,
      missingRates: [...missing].sort(),
    };
  }
}
