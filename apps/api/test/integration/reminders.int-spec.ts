import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { addDays, todayInTimeZone } from '@subca/shared';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { ExpoPushMessage } from 'expo-server-sdk';
import type { ConfigService } from '@nestjs/config';
import { toDbDate } from '../../src/common/db-date.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { PushTokensService } from '../../src/push/push-tokens.service.js';
import { createRedisConnection } from '../../src/queue/redis-connection.js';
import { ReminderSender } from '../../src/reminders/reminder-sender.service.js';
import type { ReminderJobData } from '../../src/reminders/reminders.constants.js';
import { RemindersScheduler } from '../../src/reminders/reminders.scheduler.js';

/**
 * Toàn bộ luồng nhắc nhở trên hạ tầng thật: Supabase (DB) + Redis (docker compose) + BullMQ.
 * Chỉ Expo là giả. Cần: `docker compose up -d` ở thư mục gốc.
 */
describe('Nhắc nhở: DB + Redis + BullMQ thật', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const db = prisma as unknown as PrismaService;
  const connection = createRedisConnection(
    process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  );
  const queueName = `reminders-int-${randomUUID()}`;
  const queue = new Queue<ReminderJobData>(queueName, {
    connection,
    prefix: 'subca-test',
  });
  const events = new QueueEvents(queueName, {
    connection,
    prefix: 'subca-test',
  });
  const sent: ExpoPushMessage[] = [];
  const sender = new ReminderSender(db, {
    send: async (messages) => {
      sent.push(...messages);
      return messages.map((_, i) => ({
        status: 'ok' as const,
        id: `ticket-${sent.length}-${i}`,
      }));
    },
  });
  const worker = new Worker<ReminderJobData>(
    queueName,
    (job) => sender.send(job.data.reminderId),
    {
      connection,
      prefix: 'subca-test',
    },
  );
  const config = { get: () => true } as unknown as ConfigService<never, true>;
  const scheduler = new RemindersScheduler(db, queue as never, config as never);

  const userId = randomUUID();
  const TZ = 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const today = todayInTimeZone(TZ, now);
  // Đặt giờ nhắc = đúng phút hiện tại giờ VN → lượt nhắc "1 ngày trước" đến hạn ngay bây giờ
  const vnParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(now)
    .reduce<Record<string, number>>(
      (acc, p) =>
        p.type === 'literal' ? acc : { ...acc, [p.type]: Number(p.value) },
      {},
    );
  const minuteOfDay = vnParts['hour']! * 60 + vnParts['minute']!;
  const ids = {
    netflix: randomUUID(),
    notion: randomUUID(),
    gym: randomUUID(),
  };

  beforeAll(async () => {
    await events.waitUntilReady();
    await prisma.profile.create({ data: { id: userId } });
    await prisma.userSettings.create({
      data: { userId, timezone: TZ, reminderMinuteOfDay: minuteOfDay },
    });
    await prisma.reminderRule.createMany({
      data: [
        { userId, kind: 'RENEWAL', offsetDays: 30, minInterval: 'YEAR' },
        { userId, kind: 'RENEWAL', offsetDays: 7 },
        { userId, kind: 'RENEWAL', offsetDays: 1 },
        { userId, kind: 'TRIAL_END', offsetDays: 1 },
      ],
    });
    const tomorrow = addDays(today, 1);
    const base = {
      userId,
      currency: 'VND',
      intervalUnit: 'MONTH' as const,
      intervalCount: 1,
    };
    await prisma.subscription.createMany({
      data: [
        {
          ...base,
          id: ids.netflix,
          customName: 'Netflix',
          amountMinor: 260000n,
          startDate: toDbDate(tomorrow),
          anchorDay: Number(tomorrow.slice(8)),
          nextRenewalDate: toDbDate(tomorrow),
        },
        {
          ...base,
          id: ids.notion,
          customName: 'Notion AI',
          amountMinor: 250000n,
          status: 'TRIAL',
          startDate: toDbDate(tomorrow),
          anchorDay: Number(tomorrow.slice(8)),
          nextRenewalDate: toDbDate(tomorrow),
          trialEndDate: toDbDate(tomorrow),
        },
        {
          ...base,
          id: ids.gym,
          customName: 'Gym',
          amountMinor: 550000n,
          startDate: toDbDate(addDays(today, -2)),
          anchorDay: Number(addDays(today, -2).slice(8)),
          nextRenewalDate: toDbDate(addDays(today, -2)),
        },
      ],
    });
    await new PushTokensService(db).register(userId, {
      token: 'ExponentPushToken[int-test-device]',
      platform: 'IOS',
    });
  });

  afterAll(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await events.close();
    connection.disconnect();
    await prisma.profile
      .delete({ where: { id: userId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('lượt chạy: đẩy kỳ đã qua, sinh 2 lượt nhắc, đưa vào hàng đợi và gửi', async () => {
    const result = await scheduler.tick(now);
    expect(result).toMatchObject({ rolled: 1, planned: 2, enqueued: 2 });

    // Gym đã qua ngày gia hạn → ghi khoản trừ tiền, kỳ tới là tháng sau
    const gym = await prisma.subscription.findUniqueOrThrow({
      where: { id: ids.gym },
      include: { renewalCharges: true },
    });
    expect(
      gym.renewalCharges.map((c) => c.chargedOn.toISOString().slice(0, 10)),
    ).toEqual([addDays(today, -2)]);
    expect(gym.nextRenewalDate!.getTime()).toBeGreaterThan(
      toDbDate(today).getTime(),
    );

    // Chờ worker xử lý xong 2 job
    await vi.waitFor(
      async () => {
        const rows = await prisma.reminder.findMany({ where: { userId } });
        expect(rows.map((r) => r.status)).toEqual(['SENT', 'SENT']);
      },
      { timeout: 20_000, interval: 250 },
    );
    const titles = sent.map((m) => m.title).sort();
    expect(titles).toEqual([
      'Netflix gia hạn ngày mai',
      'Notion AI hết dùng thử ngày mai',
    ]);
    expect(
      sent.every((m) => m.to === 'ExponentPushToken[int-test-device]'),
    ).toBe(true);
  });

  it('chạy lại: không sinh lượt nhắc mới, không gửi trùng', async () => {
    const before = sent.length;
    const result = await scheduler.tick(new Date(now.getTime() + 60_000));
    expect(result).toMatchObject({ planned: 0, enqueued: 0 });
    await new Promise((r) => setTimeout(r, 1500));
    expect(sent.length).toBe(before);
    expect(await prisma.reminder.count({ where: { userId } })).toBe(2);
  });

  it('người dùng Free chỉ nhận 1 mốc: không có lượt nhắc 7 ngày cho gói tháng tới', async () => {
    const reminders = await prisma.reminder.findMany({
      where: { userId },
      select: { offsetDays: true },
    });
    expect(reminders.every((r) => r.offsetDays === 1)).toBe(true);
  });
});
