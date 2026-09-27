import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  addDays,
  FREE_LIMITS,
  todayInTimeZone,
  type CreateSubscription,
} from '@subca/shared';
import { CatalogService } from '../../src/catalog/catalog.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PlanService } from '../../src/plan/plan.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service.js';

/**
 * Chạy trên database thật: tạo một profile tạm (không cần tài khoản auth), kiểm tra
 * các truy vấn Prisma thật, rồi xóa profile (cascade toàn bộ dữ liệu con).
 */
describe('Subscriptions + Catalog trên database thật', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const db = prisma as unknown as PrismaService;
  const subs = new SubscriptionsService(db, new PlanService(db));
  const catalog = new CatalogService(db);
  const userId = randomUUID();
  const today = todayInTimeZone('Asia/Ho_Chi_Minh');

  const base = (
    over: Partial<CreateSubscription> = {},
  ): CreateSubscription => ({
    customName: 'Phòng gym',
    amountMinor: '550000',
    currency: 'VND',
    intervalUnit: 'MONTH',
    intervalCount: 1,
    billingDate: addDays(today, 10),
    isTrial: false,
    autoRenew: true,
    ...over,
  });

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: userId, email: `int-test-${userId}@subca.test` },
    });
    await prisma.userSettings.create({ data: { userId } });
  });

  afterAll(async () => {
    await prisma.profile
      .delete({ where: { id: userId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('thư viện: có danh mục hệ thống và tìm dịch vụ không phân biệt hoa thường', async () => {
    const categories = await catalog.categories(userId);
    expect(categories.filter((c) => c.isSystem).length).toBeGreaterThanOrEqual(
      11,
    );
    const found = await catalog.services({ q: 'SPOT' });
    expect(found.map((s) => s.slug)).toContain('spotify');
    expect(
      found.find((s) => s.slug === 'spotify')!.plans.length,
    ).toBeGreaterThan(0);
  });

  it('tạo subscription từ thư viện, tính kỳ gia hạn và chi phí tháng', async () => {
    const [netflix] = await catalog.services({ q: 'Netflix' });
    const premium = netflix!.plans.find((p) => p.name === 'Cao cấp')!;
    const created = await subs.create(
      userId,
      base({
        customName: undefined,
        serviceId: netflix!.id,
        servicePlanId: premium.id,
        amountMinor: premium.amountMinor,
        billingDate: addDays(today, 3),
      }),
    );
    expect(created).toMatchObject({
      name: 'Netflix',
      service: { slug: 'netflix' },
      nextRenewalDate: addDays(today, 3),
      daysUntilRenewal: 3,
      monthlyEquivalentMinor: premium.amountMinor,
      status: 'ACTIVE',
    });
  });

  it('gói năm có ngày trừ tiền trong quá khứ → kỳ tới là năm sau', async () => {
    const past = addDays(today, -100);
    const created = await subs.create(
      userId,
      base({
        customName: 'Tên miền',
        amountMinor: '420000',
        intervalUnit: 'YEAR',
        billingDate: past,
      }),
    );
    expect(created.nextRenewalDate! > today).toBe(true);
    expect(created.nextRenewalDate!.slice(5)).toBe(past.slice(5));
    expect(created.monthlyEquivalentMinor).toBe('35000');
  });

  it('trial: trạng thái TRIAL, ngày hết trial = kỳ tính phí đầu', async () => {
    const t = await subs.create(
      userId,
      base({
        customName: 'Notion AI',
        amountMinor: '250000',
        billingDate: addDays(today, 2),
        isTrial: true,
      }),
    );
    expect(t).toMatchObject({
      status: 'TRIAL',
      trialEndDate: addDays(today, 2),
      nextRenewalDate: addDays(today, 2),
    });
  });

  it('danh sách: sắp theo kỳ gần nhất, lọc theo trạng thái, tìm theo tên dịch vụ', async () => {
    const all = await subs.list(userId, {});
    expect(all.items.map((s) => s.name)).toEqual([
      'Notion AI',
      'Netflix',
      'Tên miền',
    ]);
    expect(all).toMatchObject({
      trackedCount: 3,
      limit: FREE_LIMITS.maxSubscriptions,
    });
    expect(
      (await subs.list(userId, { status: 'TRIAL' })).items.map((s) => s.name),
    ).toEqual(['Notion AI']);
    expect(
      (await subs.list(userId, { q: 'netf' })).items.map((s) => s.name),
    ).toEqual(['Netflix']);
  });

  it('hủy → không còn kỳ gia hạn; mở lại → tính lại kỳ tới', async () => {
    const [, netflix] = (await subs.list(userId, {})).items;
    const cancelled = await subs.update(userId, netflix!.id, {
      status: 'CANCELLED',
    });
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      nextRenewalDate: null,
      daysUntilRenewal: null,
    });
    const reopened = await subs.update(userId, netflix!.id, {
      status: 'ACTIVE',
    });
    expect(reopened.nextRenewalDate).toBe(addDays(today, 3));
  });

  it('từ chối gói không thuộc dịch vụ đã chọn', async () => {
    const [netflix] = await catalog.services({ q: 'Netflix' });
    const [spotify] = await catalog.services({ q: 'Spotify' });
    await expect(
      subs.create(
        userId,
        base({
          customName: undefined,
          serviceId: netflix!.id,
          servicePlanId: spotify!.plans[0]!.id,
        }),
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_REFERENCE' } });
  });

  it('chi tiết: kèm thanh toán, danh mục, hướng dẫn hủy và lịch sử trừ tiền', async () => {
    const netflix = (await subs.list(userId, { q: 'netf' })).items[0]!;
    const [category] = await catalog.categories(userId);
    const pm = await prisma.paymentMethod.create({
      data: {
        userId,
        type: 'CARD',
        brand: 'VISA',
        label: 'Visa cá nhân',
        last4: '4821',
      },
    });
    await subs.update(userId, netflix.id, {
      paymentMethodId: pm.id,
      categoryId: category!.id,
    });
    await prisma.renewalCharge.createMany({
      data: [addDays(today, -60), addDays(today, -30)].map((d) => ({
        subscriptionId: netflix.id,
        userId,
        chargedOn: new Date(`${d}T00:00:00.000Z`),
        amountMinor: 260000n,
        currency: 'VND',
      })),
    });

    const detail = await subs.get(userId, netflix.id);
    expect(detail).toMatchObject({
      name: 'Netflix',
      paymentMethod: { label: 'Visa cá nhân', last4: '4821', brand: 'VISA' },
      category: { id: category!.id, name: category!.name },
      cancelGuide: { url: 'https://www.netflix.com/cancelplan' },
    });
    // Mới nhất trước
    expect(detail.charges.map((c) => c.chargedOn)).toEqual([
      addDays(today, -30),
      addDays(today, -60),
    ]);
    expect(detail.charges[0]).toMatchObject({
      amountMinor: '260000',
      currency: 'VND',
    });
  });

  it('giới hạn gói Free: tối đa 8, có Plus thì không giới hạn', async () => {
    const current = (await subs.list(userId, {})).trackedCount;
    for (let i = current; i < FREE_LIMITS.maxSubscriptions; i++) {
      await subs.create(userId, base({ customName: `Gói ${i}` }));
    }
    await expect(
      subs.create(userId, base({ customName: 'Gói thứ 9' })),
    ).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED' },
    });

    await prisma.entitlement.create({
      data: {
        userId,
        product: 'PLUS_YEARLY',
        store: 'PROMO',
        status: 'ACTIVE',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const ninth = await subs.create(userId, base({ customName: 'Gói thứ 9' }));
    expect(ninth.status).toBe('ACTIVE');
    expect((await subs.list(userId, {})).limit).toBeNull();
  });

  it('lưu trữ → biến mất khỏi danh sách và trả 404 khi xem', async () => {
    const { items } = await subs.list(userId, { q: 'Gói thứ 9' });
    await subs.archive(userId, items[0]!.id);
    await expect(subs.get(userId, items[0]!.id)).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_NOT_FOUND' },
    });
    expect((await subs.list(userId, { q: 'Gói thứ 9' })).items).toHaveLength(0);
  });

  it('không xem được subscription của người khác', async () => {
    const { items } = await subs.list(userId, {});
    await expect(subs.get(randomUUID(), items[0]!.id)).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_NOT_FOUND' },
    });
  });

  it('xóa profile → toàn bộ subscription bị xóa theo (cascade)', async () => {
    const tempUser = randomUUID();
    await prisma.profile.create({ data: { id: tempUser } });
    await subs.create(tempUser, base());
    await prisma.profile.delete({ where: { id: tempUser } });
    expect(
      await prisma.subscription.count({ where: { userId: tempUser } }),
    ).toBe(0);
  });
});
