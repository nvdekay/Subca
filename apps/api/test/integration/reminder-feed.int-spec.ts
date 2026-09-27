import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { addDays, reminderInstant, todayInTimeZone } from '@subca/shared';
import { toDbDate } from '../../src/common/db-date.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PlanService } from '../../src/plan/plan.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { ReminderFeedService } from '../../src/reminders/reminder-feed.service.js';

/** Màn Thông báo trên database thật: quy tắc nhắc, nhắc sắp tới (planner) và lịch sử đã gửi. */
describe('Lịch sử & nhắc sắp tới trên database thật', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const db = prisma as unknown as PrismaService;
  const feed = new ReminderFeedService(db, new PlanService(db));
  const userId = randomUUID();
  const tz = 'Asia/Ho_Chi_Minh';
  const today = todayInTimeZone(tz);
  let subId = '';

  beforeAll(async () => {
    await prisma.profile.create({ data: { id: userId } });
    await prisma.userSettings.create({
      data: { userId, timezone: tz, reminderMinuteOfDay: 510 },
    });
    const due = addDays(today, 10);
    const sub = await prisma.subscription.create({
      data: {
        userId,
        customName: 'Phòng gym',
        amountMinor: 550_000n,
        currency: 'VND',
        intervalUnit: 'MONTH',
        intervalCount: 1,
        anchorDay: Number(due.slice(8)),
        startDate: toDbDate(due),
        nextRenewalDate: toDbDate(due),
        status: 'ACTIVE',
      },
    });
    subId = sub.id;
  });

  afterAll(async () => {
    await prisma.profile
      .delete({ where: { id: userId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('thay toàn bộ quy tắc nhắc và đọc lại', async () => {
    const saved = await feed.replaceRules(userId, {
      rules: [
        { kind: 'RENEWAL', offsetDays: 7, minInterval: null, enabled: true },
        { kind: 'RENEWAL', offsetDays: 1, minInterval: null, enabled: true },
        {
          kind: 'RENEWAL',
          offsetDays: 30,
          minInterval: 'YEAR',
          enabled: false,
        },
        { kind: 'TRIAL_END', offsetDays: 1, minInterval: null, enabled: true },
      ],
    });
    expect(saved).toHaveLength(4);
    expect(saved.find((r) => r.offsetDays === 30)).toMatchObject({
      minInterval: 'YEAR',
      enabled: false,
    });
  });

  it('nhắc sắp tới: gói Free chỉ giữ mốc gần ngày gia hạn nhất, đúng giờ nhắc', async () => {
    const { upcoming, notificationsEnabled } = await feed.feed(userId);
    expect(notificationsEnabled).toBe(true);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({
      id: null,
      subscriptionId: subId,
      kind: 'RENEWAL',
      offsetDays: 1,
      dueDate: addDays(today, 10),
      at: reminderInstant(addDays(today, 10), 1, 510, tz).toISOString(),
      title: 'Phòng gym gia hạn ngày mai',
    });
  });

  it('lịch sử: chỉ lượt đã gửi, kèm nội dung như push', async () => {
    const due = addDays(today, 2);
    await prisma.reminder.create({
      data: {
        userId,
        subscriptionId: subId,
        kind: 'RENEWAL',
        offsetDays: 3,
        dueDate: toDbDate(due),
        scheduledAt: new Date(Date.now() - 3_600_000),
        status: 'SENT',
        sentAt: new Date(Date.now() - 3_600_000),
      },
    });
    const { history } = await feed.feed(userId);
    expect(history).toHaveLength(1);
    expect(history[0]!.title).toBe('Phòng gym gia hạn sau 3 ngày');
    expect(history[0]!.id).not.toBeNull();
  });

  it('tắt thông báo → không còn nhắc sắp tới', async () => {
    await prisma.userSettings.update({
      where: { userId },
      data: { notificationsEnabled: false },
    });
    const { upcoming, notificationsEnabled } = await feed.feed(userId);
    expect(notificationsEnabled).toBe(false);
    expect(upcoming).toHaveLength(0);
  });
});
