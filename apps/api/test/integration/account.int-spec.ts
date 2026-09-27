import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  addDays,
  todayInTimeZone,
  type CreateSubscription,
} from '@subca/shared';
import { toDbDate } from '../../src/common/db-date.js';
import { FxService } from '../../src/fx/fx.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { HomeService } from '../../src/home/home.service.js';
import { AccountService } from '../../src/me/account.service.js';
import { PaymentMethodsService } from '../../src/payment-methods/payment-methods.service.js';
import { PlanService } from '../../src/plan/plan.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service.js';

/** Trang chủ, phương thức thanh toán, cài đặt, ngân sách trên database thật. Tự dọn dữ liệu. */
describe('Home + phương thức thanh toán + cài đặt trên database thật', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const db = prisma as unknown as PrismaService;
  const plan = new PlanService(db);
  const fx = new FxService(db);
  const subs = new SubscriptionsService(db, plan);
  const home = new HomeService(db, fx, plan);
  const methods = new PaymentMethodsService(db, fx);
  const account = new AccountService(db);
  const userId = randomUUID();
  const RATE_SOURCE = `int-test-${userId}`;
  const today = todayInTimeZone('Asia/Ho_Chi_Minh');

  const sub = (over: Partial<CreateSubscription>): CreateSubscription => ({
    customName: 'X',
    amountMinor: '100000',
    currency: 'VND',
    intervalUnit: 'MONTH',
    intervalCount: 1,
    billingDate: addDays(today, 20),
    isTrial: false,
    autoRenew: true,
    ...over,
  });

  beforeAll(async () => {
    await prisma.profile.create({ data: { id: userId } });
    await prisma.userSettings.create({ data: { userId } });
  });

  afterAll(async () => {
    await prisma.exchangeRate.deleteMany({ where: { source: RATE_SOURCE } });
    await prisma.profile
      .delete({ where: { id: userId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('phương thức thanh toán: cái đầu tiên tự là mặc định, đổi mặc định chỉ còn 1', async () => {
    const visa = await methods.create(userId, {
      type: 'CARD',
      brand: 'VISA',
      label: 'Visa',
      last4: '4821',
      isDefault: false,
    });
    expect(visa.isDefault).toBe(true);
    const master = await methods.create(userId, {
      type: 'CARD',
      brand: 'MASTERCARD',
      label: 'Mastercard',
      last4: '7703',
      isDefault: true,
    });
    expect(master.isDefault).toBe(true);
    const list = await methods.list(userId);
    expect(list.filter((m) => m.isDefault).map((m) => m.label)).toEqual([
      'Mastercard',
    ]);
  });

  it('Trang chủ: tổng tháng, trial, sắp gia hạn, có thể tiết kiệm; báo thiếu tỷ giá USD', async () => {
    const [master, visa] = await methods.list(userId);
    await subs.create(
      userId,
      sub({
        customName: 'Netflix',
        amountMinor: '260000',
        billingDate: addDays(today, 3),
        paymentMethodId: visa!.id,
      }),
    );
    await subs.create(
      userId,
      sub({
        customName: 'Gym',
        amountMinor: '550000',
        billingDate: addDays(today, 6),
        paymentMethodId: master!.id,
      }),
    );
    await subs.create(
      userId,
      sub({
        customName: 'Hosting',
        amountMinor: '1800000',
        intervalUnit: 'YEAR',
        billingDate: addDays(today, 40),
      }),
    );
    const yt = await subs.create(
      userId,
      sub({
        customName: 'YouTube',
        amountMinor: '79000',
        billingDate: addDays(today, 12),
      }),
    );
    await subs.update(userId, yt.id, { status: 'REVIEW' });
    await subs.create(
      userId,
      sub({
        customName: 'Notion',
        amountMinor: '250000',
        isTrial: true,
        billingDate: addDays(today, 2),
      }),
    );
    await subs.create(
      userId,
      sub({
        customName: 'ChatGPT',
        amountMinor: '2000',
        currency: 'USD',
        billingDate: addDays(today, 5),
        paymentMethodId: visa!.id,
      }),
    );

    const h = await home.getHome(userId);
    // 260.000 + 550.000 + 150.000 (1,8tr/năm) + 79.000 = 1.039.000; ChatGPT USD chưa có tỷ giá
    expect(h).toMatchObject({
      currency: 'VND',
      monthlyTotalMinor: '1039000',
      yearlyProjectionMinor: '12468000',
      activeCount: 5,
      trialCount: 1,
      dueIn7DaysCount: 3,
      potentialSavingsMinor: '79000',
      missingRates: ['USD'],
      plan: 'FREE',
      budget: null,
    });
    expect(h.upcoming.map((s) => s.name)).toEqual([
      'Netflix',
      'ChatGPT',
      'Gym',
      'YouTube',
      'Hosting',
    ]);
    expect(h.trials.map((s) => s.name)).toEqual(['Notion']);
  });

  it('có tỷ giá USD → quy đổi vào tổng; ngân sách báo vượt hạn mức', async () => {
    await prisma.exchangeRate.create({
      data: {
        base: 'USD',
        quote: 'VND',
        rate: '26000',
        date: toDbDate(addDays(today, -1)),
        source: RATE_SOURCE,
      },
    });
    await account.upsertBudget(userId, {
      amountMinor: '1500000',
      currency: 'VND',
      alertAtPercent: 90,
    });
    const h = await home.getHome(userId);
    expect(h.missingRates).toEqual([]);
    expect(h.monthlyTotalMinor).toBe('1559000'); // + 20 USD × 26.000
    expect(h.budget).toMatchObject({
      amountMinor: '1500000',
      spentMinor: '1559000',
      percent: 104,
      overBudget: true,
    });
  });

  it('phương thức thanh toán: số subscription và tổng tháng đã quy đổi', async () => {
    const list = await methods.list(userId);
    const visa = list.find((m) => m.label === 'Visa')!;
    expect(visa).toMatchObject({
      subscriptionCount: 2,
      monthlyTotalMinor: '780000',
    }); // 260.000 + 520.000
  });

  it('lưu trữ phương thức mặc định → gỡ khỏi subscription và chọn mặc định mới', async () => {
    const master = (await methods.list(userId)).find(
      (m) => m.label === 'Mastercard',
    )!;
    await methods.archive(userId, master.id);
    const list = await methods.list(userId);
    expect(list.map((m) => [m.label, m.isDefault])).toEqual([['Visa', true]]);
    expect(
      await prisma.subscription.count({
        where: { userId, paymentMethodId: master.id },
      }),
    ).toBe(0);
  });

  it('cài đặt và hồ sơ', async () => {
    const s = await account.updateSettings(userId, {
      timezone: 'Asia/Bangkok',
      reminderMinuteOfDay: 1200,
    });
    expect(s).toMatchObject({
      timezone: 'Asia/Bangkok',
      reminderMinuteOfDay: 1200,
      currency: 'VND',
    });
    expect(
      await account.updateProfile(userId, { displayName: 'Khánh' }),
    ).toEqual({ displayName: 'Khánh' });
    await expect(
      account.updateSettings(randomUUID(), { locale: 'en-US' }),
    ).rejects.toMatchObject({
      response: { code: 'PROFILE_NOT_FOUND' },
    });
  });

  it('xóa ngân sách', async () => {
    await account.deleteBudget(userId);
    expect(await account.getBudget(userId)).toBeNull();
    expect((await home.getHome(userId)).budget).toBeNull();
  });
});
