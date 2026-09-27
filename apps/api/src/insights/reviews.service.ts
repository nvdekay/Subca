import { Injectable, NotFoundException } from '@nestjs/common';
import {
  monthlyEquivalentMinor,
  type CurrencyCode,
  type ReviewDecision,
  type ReviewDto,
  type SetReviewDecision,
} from '@subca/shared';
import { toDbDate } from '../common/db-date.js';
import { loadUserContext } from '../common/user-context.js';
import { FxService } from '../fx/fx.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  subscriptionInclude,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';

/**
 * Đánh giá hằng tháng: mỗi gói đang theo dõi được đánh dấu Giữ / Xem lại / Hủy cho một tháng.
 * Đồng bộ trạng thái: "Xem lại" → gói chuyển REVIEW; "Giữ" với gói đang REVIEW → ACTIVE.
 * "Hủy" không tự hủy gói: người dùng vẫn phải hủy ở nhà cung cấp rồi đánh dấu đã hủy.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async get(
    userId: string,
    period: string | undefined,
    now = new Date(),
  ): Promise<ReviewDto> {
    const ctx = await loadUserContext(this.prisma, userId, now);
    const month = period ?? ctx.today.slice(0, 7);
    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: TRACKED_STATUSES } },
      include: {
        ...subscriptionInclude,
        monthlyReviews: {
          where: { period: toDbDate(`${month}-01`) },
          select: { decision: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const rates = await this.fx.rateTable(
      ctx.currency,
      subs.map((s) => s.currency),
      ctx.today,
    );
    const missing = new Set<CurrencyCode>();

    const items = subs.map((s) => {
      const own = monthlyEquivalentMinor(
        s.amountMinor,
        s.intervalUnit,
        s.intervalCount,
      );
      const monthly = rates.convert(own, s.currency as CurrencyCode);
      if (monthly === null) missing.add(s.currency as CurrencyCode);
      return {
        subscriptionId: s.id,
        name: s.customName ?? s.service?.name ?? 'Subscription',
        service: s.service,
        status: s.status,
        usageFrequency: s.usageFrequency,
        monthlyMinor: (monthly ?? 0n).toString(),
        decision: (s.monthlyReviews[0]?.decision ??
          null) as ReviewDecision | null,
      };
    });
    // Gói chưa đánh giá lên trước, sau đó theo chi phí giảm dần
    items.sort(
      (a, b) =>
        Number(a.decision !== null) - Number(b.decision !== null) ||
        Number(BigInt(b.monthlyMinor) - BigInt(a.monthlyMinor)),
    );

    const savings = items
      .filter((i) => i.decision === 'CANCEL')
      .reduce((sum, i) => sum + BigInt(i.monthlyMinor), 0n);
    return {
      period: month,
      currency: ctx.currency,
      items,
      reviewedCount: items.filter((i) => i.decision !== null).length,
      totalCount: items.length,
      potentialSavingsMinor: savings.toString(),
      missingRates: [...missing].sort(),
    };
  }

  async decide(
    userId: string,
    subscriptionId: string,
    input: SetReviewDecision,
    now = new Date(),
  ): Promise<ReviewDto> {
    const ctx = await loadUserContext(this.prisma, userId, now);
    const month = input.period ?? ctx.today.slice(0, 7);
    const sub = await this.findTracked(userId, subscriptionId);
    const period = toDbDate(`${month}-01`);

    const statusUpdate =
      input.decision === 'REVIEW' && sub.status === 'ACTIVE'
        ? 'REVIEW'
        : input.decision === 'KEEP' && sub.status === 'REVIEW'
          ? 'ACTIVE'
          : null;
    await this.prisma.$transaction([
      this.prisma.monthlyReview.upsert({
        where: { subscriptionId_period: { subscriptionId, period } },
        create: {
          userId,
          subscriptionId,
          period,
          decision: input.decision,
          decidedAt: now,
        },
        update: { decision: input.decision, decidedAt: now },
      }),
      ...(statusUpdate
        ? [
            this.prisma.subscription.update({
              where: { id: subscriptionId },
              data: { status: statusUpdate },
            }),
          ]
        : []),
    ]);
    return this.get(userId, month, now);
  }

  async clear(
    userId: string,
    subscriptionId: string,
    period: string | undefined,
    now = new Date(),
  ): Promise<void> {
    const ctx = await loadUserContext(this.prisma, userId, now);
    await this.findTracked(userId, subscriptionId);
    await this.prisma.monthlyReview.deleteMany({
      where: {
        userId,
        subscriptionId,
        period: toDbDate(`${period ?? ctx.today.slice(0, 7)}-01`),
      },
    });
  }

  private async findTracked(userId: string, id: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId, status: { in: TRACKED_STATUSES } },
      select: { id: true, status: true },
    });
    if (!sub)
      throw new NotFoundException({
        statusCode: 404,
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Không tìm thấy subscription',
      });
    return sub;
  }
}
