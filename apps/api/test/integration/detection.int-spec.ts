import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { todayInTimeZone } from '@subca/shared';
import { DetectionService } from '../../src/detection/detection.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import type { EmailCandidate } from '../../src/integrations/mail/mail-provider.js';
import { InboxService } from '../../src/inbox/inbox.service.js';
import { PlanService } from '../../src/plan/plan.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

/**
 * Cả luồng tự phát hiện trên database thật, dùng email mẫu thay Gmail:
 * lọc ứng viên → parse → ghi sự kiện → đối soát → subscription + Subca Inbox.
 */
describe('Tự phát hiện subscription từ email (database thật)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const db = prisma as unknown as PrismaService;
  const detection = new DetectionService(db, new PlanService(db));
  const inbox = new InboxService(db);

  const userId = randomUUID();
  const accountId = randomUUID();
  const today = todayInTimeZone('Asia/Ho_Chi_Minh');
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

  const email = (
    over: Partial<EmailCandidate> & { messageId: string },
  ): EmailCandidate => ({
    threadId: null,
    sender: 'Netflix <info@account.netflix.com>',
    senderEmail: 'info@account.netflix.com',
    senderDomain: 'netflix.com',
    subject: '',
    receivedAt: new Date(),
    textContent: '',
    ...over,
  });

  /** Hộp thư mẫu: Netflix trả đều 3 tháng, ChatGPT dùng thử, Spotify đã hủy, 1 thư rác. */
  const mailbox: EmailCandidate[] = [
    ...[90, 60, 30].map((days, i) =>
      email({
        messageId: `netflix-${i}`,
        subject: 'Your Netflix receipt',
        receivedAt: daysAgo(days),
        textContent:
          'Thank you for your payment. Netflix Premium. Total: 260.000₫ monthly. Next billing date: 2026-12-18.',
      }),
    ),
    email({
      messageId: 'openai-trial',
      sender: 'OpenAI <billing@openai.com>',
      senderEmail: 'billing@openai.com',
      senderDomain: 'openai.com',
      subject: 'Your free trial has started',
      receivedAt: daysAgo(3),
      textContent:
        'Welcome to ChatGPT Plus. Your free trial ends on 2026-12-01. Then $20.00 monthly.',
    }),
    email({
      messageId: 'spotify-cancel',
      sender: 'Spotify <no-reply@spotify.com>',
      senderEmail: 'no-reply@spotify.com',
      senderDomain: 'spotify.com',
      subject: 'Your subscription has been cancelled',
      receivedAt: daysAgo(10),
      textContent:
        'Your Spotify Premium subscription has been cancelled. Last invoice 59.000₫ monthly. You can still use it until 2026-12-30.',
    }),
    email({
      messageId: 'junk',
      senderDomain: 'news.example.com',
      sender: 'Tin tức <news@news.example.com>',
      senderEmail: 'news@news.example.com',
      subject: 'Bản tin tuần này',
      receivedAt: daysAgo(2),
      textContent: 'Vài tin hay cho bạn. Unsubscribe from this newsletter.',
    }),
  ];

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: userId, email: `detect-${userId}@subca.test` },
    });
    await prisma.userSettings.create({ data: { userId } });
    await prisma.connectedAccount.create({
      data: {
        id: accountId,
        userId,
        provider: 'GMAIL',
        providerEmail: `detect-${userId}@gmail.com`,
        encryptedRefreshToken: 'test.test.test',
        scope: 'gmail.readonly',
      },
    });
  });

  afterAll(async () => {
    await prisma.profile
      .delete({ where: { id: userId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('quét hộp thư mẫu: nhận đúng ứng viên và ghi sự kiện, bỏ qua thư rác', async () => {
    const result = await detection.processCandidates(
      userId,
      accountId,
      mailbox,
    );
    expect(result).toMatchObject({ scanned: 6, candidates: 5, events: 5 });

    const processed = await prisma.processedEmail.count({
      where: { accountId },
    });
    expect(processed).toBe(6);
    const junk = await prisma.processedEmail.findFirst({
      where: { accountId, providerMessageId: 'junk' },
    });
    expect(junk?.parseStatus).toBe('NO_MATCH');
    // Không lưu nội dung thư: chỉ có băm tiêu đề
    expect(junk?.subjectHash).toHaveLength(32);
  });

  it('quét lại cùng hộp thư không sinh thêm sự kiện (idempotent)', async () => {
    const again = await detection.processCandidates(userId, accountId, mailbox);
    expect(again.events).toBe(0);
    expect(await prisma.subscriptionEvent.count({ where: { userId } })).toBe(5);
  });

  it('đối soát: tạo subscription tự động với trạng thái và số tiền đúng', async () => {
    const summary = await detection.reconcileUser(userId);
    expect(summary.created).toBeGreaterThanOrEqual(3);

    const subs = await prisma.subscription.findMany({
      where: { userId },
      include: { service: { select: { slug: true } } },
    });
    expect(subs).toHaveLength(3);

    const netflix = subs.find((s) => s.merchantKey === 'netflix')!;
    expect(netflix).toMatchObject({
      source: 'EMAIL',
      status: 'ACTIVE',
      detectionState: 'ACTIVE',
      amountMinor: 260000n,
      currency: 'VND',
      intervalUnit: 'MONTH',
      needsReview: false,
    });
    expect(netflix.confidence!).toBeGreaterThanOrEqual(75);
    expect(netflix.service?.slug).toBe('netflix');
    expect(netflix.nextRenewalDate).not.toBeNull();

    const openai = subs.find((s) => s.merchantKey === 'openai')!;
    expect(openai).toMatchObject({
      status: 'TRIAL',
      detectionState: 'TRIAL',
      currency: 'USD',
    });
    expect(openai.trialEndDate).not.toBeNull();

    const spotify = subs.find((s) => s.merchantKey === 'spotify')!;
    expect(spotify).toMatchObject({
      status: 'CANCELLED',
      detectionState: 'CANCELLED',
    });
    expect(spotify.nextRenewalDate).toBeNull();
  });

  it('mọi sự kiện đều được gắn vào subscription tương ứng', async () => {
    const orphan = await prisma.subscriptionEvent.count({
      where: { userId, subscriptionId: null },
    });
    expect(orphan).toBe(0);
  });

  it('đối soát lại không tạo trùng subscription', async () => {
    const before = await prisma.subscription.count({ where: { userId } });
    await detection.reconcileUser(userId);
    expect(await prisma.subscription.count({ where: { userId } })).toBe(before);
  });

  it('gói người dùng nhập tay được gộp bằng chứng thay vì tạo bản sao', async () => {
    const manual = await prisma.subscription.create({
      data: {
        userId,
        customName: 'Canva',
        amountMinor: 120000n,
        currency: 'VND',
        intervalUnit: 'MONTH',
        intervalCount: 1,
        startDate: new Date(`${today}T00:00:00Z`),
        status: 'ACTIVE',
      },
    });

    await detection.processCandidates(userId, accountId, [
      email({
        messageId: 'canva-1',
        sender: 'Canva <no-reply@canva.com>',
        senderEmail: 'no-reply@canva.com',
        senderDomain: 'canva.com',
        subject: 'Your Canva receipt',
        receivedAt: daysAgo(5),
        textContent: 'Payment received for Canva Pro. Total: 120.000₫ monthly.',
      }),
    ]);
    await detection.reconcileUser(userId);

    const canvas = await prisma.subscription.findMany({
      where: { userId, customName: 'Canva' },
    });
    expect(canvas).toHaveLength(1);
    const merged = canvas[0]!;
    expect(merged.id).toBe(manual.id);
    // Gói nhập tay giữ nguyên nguồn MANUAL nhưng được gắn bằng chứng từ email
    expect(merged.source).toBe('MANUAL');
    expect(merged.merchantKey).toBe('canva');
    expect(merged.lastDetectedAt).not.toBeNull();
  });

  it('bằng chứng yếu thì hỏi người dùng qua Subca Inbox thay vì tự thêm', async () => {
    await detection.processCandidates(userId, accountId, [
      email({
        messageId: 'weak-1',
        sender: 'Billing <billing@obscureapp.io>',
        senderEmail: 'billing@obscureapp.io',
        senderDomain: 'obscureapp.io',
        subject: 'Subscription confirmation',
        receivedAt: daysAgo(400),
        textContent:
          'Thanks for subscribing to our service. Your membership is active.',
      }),
    ]);
    await detection.reconcileUser(userId);

    const box = await inbox.list(userId);
    const item = box.items.find((i) =>
      i.title.toLowerCase().includes('obscureapp'),
    );
    expect(item).toBeDefined();
    expect(item!.actions.map((a) => a.key)).toContain('CONFIRM_ACTIVE');
    // Không tự tạo subscription cho bằng chứng yếu
    expect(
      await prisma.subscription.count({
        where: { userId, merchantKey: 'obscureapp' },
      }),
    ).toBe(0);
  });

  it('người dùng trả lời trong Inbox thì subscription được cập nhật ngay', async () => {
    const box = await inbox.list(userId);
    const spotify = await prisma.subscription.findFirst({
      where: { userId, merchantKey: 'spotify' },
    });
    const item =
      box.items.find((i) => i.subscriptionId === spotify?.id) ??
      (await prisma.inboxItem
        .create({
          data: {
            userId,
            kind: 'CONFIRM_ACTIVE',
            subscriptionId: spotify!.id,
            payload: { merchantName: 'Spotify' },
          },
        })
        .then((row) => ({ id: row.id })));

    await inbox.resolve(userId, item!.id, { action: 'CONFIRM_ACTIVE' });
    const updated = await prisma.subscription.findUnique({
      where: { id: spotify!.id },
    });
    expect(updated).toMatchObject({
      status: 'ACTIVE',
      detectionState: 'ACTIVE',
      confidence: 100,
      needsReview: false,
    });
  });
});
