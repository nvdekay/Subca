import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  addMonthsToMonth,
  todayInTimeZone,
  type CreateSubscription,
} from '@subca/shared';
import { FxService } from '../../src/fx/fx.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AnalyticsService } from '../../src/insights/analytics.service.js';
import { CalendarService } from '../../src/insights/calendar.service.js';
import { ReviewsService } from '../../src/insights/reviews.service.js';
import { PaymentMethodsService } from '../../src/payment-methods/payment-methods.service.js';
import { PlanService } from '../../src/plan/plan.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service.js';

/** Lịch, đánh giá tháng, phân tích trên database thật. Tự dọn dữ liệu. */
describe('Lịch + Đánh giá + Phân tích trên database thật', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const db = prisma as unknown as PrismaService;
  const fx = new FxService(db);
  const subs = new SubscriptionsService(db, new PlanService(db));
  const methods = new PaymentMethodsService(db, fx);
  const calendar = new CalendarService(db, fx);
  const reviews = new ReviewsService(db, fx);
  const analytics = new AnalyticsService(db, fx);
  const userId = randomUUID();
  const today = todayInTimeZone('Asia/Ho_Chi_Minh');
  const thisMonth = today.slice(0, 7);
  const nextMonth = addMonthsToMonth(thisMonth, 1);
  const ids: Record<string, string> = {};
  const usdInVnd = async (amount: bigint) =>
    (await fx.rateTable('VND', ['USD'], today)).convert(amount, 'USD') ?? 0n;

  const base = (over: Partial<CreateSubscription>): CreateSubscription => ({
    customName: 'X',
    amountMinor: '100000',
    currency: 'VND',
    intervalUnit: 'MONTH',
    intervalCount: 1,
    billingDate: `${nextMonth}-15`,
    isTrial: false,
    autoRenew: true,
    ...over,
  });

  beforeAll(async () => {
    await prisma.profile.create({ data: { id: userId } });
    await prisma.userSettings.create({ data: { userId } });
    const cats = Object.fromEntries(
      (
        await prisma.category.findMany({
          where: { userId: null },
          select: { id: true, slug: true },
        })
      ).map((c) => [c.slug, c.id]),
    );
    const visa = await methods.create(userId, {
      type: 'CARD',
      brand: 'VISA',
      label: 'Visa',
      last4: '4821',
      isDefault: true,
    });
    const mk = async (key: string, over: Partial<CreateSubscription>) => {
      ids[key] = (
        await subs.create(userId, base({ customName: key, ...over }))
      ).id;
    };
    await mk('Netflix', {
      amountMinor: '260000',
      billingDate: `${nextMonth}-05`,
      categoryId: cats['giai-tri'],
      paymentMethodId: visa.id,
      usageFrequency: 'SEVERAL_PER_WEEK',
    });
    await mk('Gym', {
      amountMinor: '550000',
      billingDate: `${nextMonth}-05`,
      categoryId: cats['suc-khoe'],
      usageFrequency: 'WEEKLY',
    });
    await mk('Hosting', {
      amountMinor: '1800000',
      intervalUnit: 'YEAR',
      billingDate: `${nextMonth}-20`,
      categoryId: cats['web-hosting'],
    });
    await mk('ChatGPT', {
      amountMinor: '2000',
      currency: 'USD',
      billingDate: `${nextMonth}-10`,
      categoryId: cats['ai-cong-viec'],
      paymentMethodId: visa.id,
      usageFrequency: 'DAILY',
    });
    await mk('Lightroom', {
      amountMinor: '250000',
      billingDate: `${nextMonth}-18`,
      categoryId: cats['ai-cong-viec'],
      usageFrequency: 'RARELY',
    });
    await mk('Notion', {
      amountMinor: '250000',
      isTrial: true,
      billingDate: `${nextMonth}-02`,
    });
  });

  afterAll(async () => {
    await prisma.profile
      .delete({ where: { id: userId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('lịch tháng sau: đúng ngày, gộp theo ngày, trial đánh dấu TRIAL_END, tổng không tính trial', async () => {
    const cal = await calendar.month(userId, nextMonth);
    expect(
      cal.days.map((d) => [
        d.date.slice(8),
        d.items.map((i) => `${i.name}:${i.kind}`),
      ]),
    ).toEqual([
      ['02', ['Notion:TRIAL_END']],
      ['05', ['Gym:RENEWAL', 'Netflix:RENEWAL']],
      ['10', ['ChatGPT:RENEWAL']],
      ['18', ['Lightroom:RENEWAL']],
      ['20', ['Hosting:RENEWAL']],
    ]);
    const usd = await usdInVnd(2000n);
    expect(cal.totalMinor).toBe(
      String(260_000n + 550_000n + 250_000n + 1_800_000n + usd),
    );
    expect(cal.count).toBe(6);
  });

  it('lịch 2 tháng sau: gói năm không xuất hiện, trial đã thành kỳ gia hạn', async () => {
    const cal = await calendar.month(userId, addMonthsToMonth(thisMonth, 2));
    const names = cal.days
      .flatMap((d) => d.items.map((i) => `${i.name}:${i.kind}`))
      .sort();
    expect(names).toEqual([
      'ChatGPT:RENEWAL',
      'Gym:RENEWAL',
      'Lightroom:RENEWAL',
      'Netflix:RENEWAL',
      'Notion:RENEWAL',
    ]);
  });

  it('lịch quá xa (> 24 tháng) → 400', async () => {
    await expect(
      calendar.month(userId, addMonthsToMonth(thisMonth, 30)),
    ).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR' },
    });
  });

  it('đánh giá tháng: Xem lại → gói chuyển REVIEW; Hủy → tính vào tiết kiệm; Giữ → về ACTIVE', async () => {
    let r = await reviews.get(userId, undefined);
    expect(r).toMatchObject({
      period: thisMonth,
      reviewedCount: 0,
      totalCount: 6,
      potentialSavingsMinor: '0',
    });

    r = await reviews.decide(userId, ids['Lightroom']!, { decision: 'CANCEL' });
    r = await reviews.decide(userId, ids['Gym']!, { decision: 'REVIEW' });
    expect(r.reviewedCount).toBe(2);
    expect(r.potentialSavingsMinor).toBe('250000');
    expect(r.items.slice(0, 4).every((i) => i.decision === null)).toBe(true); // chưa đánh giá lên trước
    expect(
      (
        await prisma.subscription.findUniqueOrThrow({
          where: { id: ids['Gym'] },
        })
      ).status,
    ).toBe('REVIEW');

    await reviews.decide(userId, ids['Gym']!, { decision: 'KEEP' });
    expect(
      (
        await prisma.subscription.findUniqueOrThrow({
          where: { id: ids['Gym'] },
        })
      ).status,
    ).toBe('ACTIVE');

    await reviews.clear(userId, ids['Lightroom']!, undefined);
    expect((await reviews.get(userId, undefined)).potentialSavingsMinor).toBe(
      '0',
    );
    await expect(
      reviews.decide(userId, randomUUID(), { decision: 'KEEP' }),
    ).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_NOT_FOUND' },
    });
  });

  it('phân tích: tổng, theo danh mục, theo phương thức, top đắt nhất, chi phí mỗi lần dùng, xu hướng', async () => {
    const a = await analytics.get(userId);
    const usd = await usdInVnd(2000n);
    // Không tính trial Notion; Hosting 1,8tr/năm = 150.000/tháng
    const total = 260_000n + 550_000n + 150_000n + usd + 250_000n;
    expect(a.monthlyTotalMinor).toBe(String(total));
    expect(a.yearlyProjectionMinor).toBe(String(total * 12n));

    const cat = Object.fromEntries(
      a.byCategory.map((c) => [c.label, c.monthlyMinor]),
    );
    expect(cat['AI & Công việc']).toBe(String(250_000n + usd));
    expect(cat['Sức khỏe & Thể thao']).toBe('550000');
    expect(
      a.byCategory.reduce((s, c) => s + c.percent, 0),
    ).toBeGreaterThanOrEqual(99);

    const pm = Object.fromEntries(
      a.byPaymentMethod.map((p) => [p.label, p.monthlyMinor]),
    );
    expect(pm['Visa •• 4821']).toBe(String(260_000n + usd));
    expect(pm['Chưa chọn phương thức']).toBe(
      String(550_000n + 150_000n + 250_000n),
    );

    expect(a.topExpensive[0]!.name).toBe('Gym');
    // Lightroom 250.000 / 1 lần > Gym 550.000 / 4 lần > Netflix 260.000 / 12 lần > ChatGPT / 30 lần
    expect(a.costPerUse.map((c) => [c.name, c.costPerUseMinor])).toEqual([
      ['Lightroom', '250000'],
      ['Gym', '137500'],
      ['Netflix', '21667'],
      ['ChatGPT', String((usd + 15n) / 30n)],
    ]);
    expect(a.trend).toHaveLength(6);
    expect(a.trend.at(-1)).toEqual({
      month: thisMonth,
      totalMinor: String(total),
    });
    expect(a.trend[0]!.totalMinor).toBe('0'); // gói vừa tạo, 5 tháng trước chưa có
  });

  it('gói đã hủy vẫn được tính vào xu hướng tháng nó còn hoạt động', async () => {
    await subs.update(userId, ids['Lightroom']!, { status: 'CANCELLED' });
    const a = await analytics.get(userId);
    expect(a.topExpensive.map((t) => t.name)).not.toContain('Lightroom');
    expect(BigInt(a.trend.at(-1)!.totalMinor)).toBe(
      BigInt(a.monthlyTotalMinor) + 250_000n,
    );
  });
});
