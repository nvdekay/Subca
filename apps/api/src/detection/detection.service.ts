import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  CONFIDENCE,
  todayInTimeZone,
  type CurrencyCode,
  type DetectionState,
  type IsoDate,
} from '@subca/shared';
import { fromDbDate, toDbDate } from '../common/db-date.js';
import type {
  Prisma,
  Subscription,
  SubscriptionEvent,
  SubscriptionStatus,
} from '../generated/prisma/client.js';
import type { EmailCandidate } from '../integrations/mail/mail-provider.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TIMEZONE,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';
import { merchantByKey } from './merchants.js';
import { PARSER_VERSION, parseEmail, type DetectedEvent } from './parser.js';
import { reconcile, type EventFacts } from './reconcile.js';

export interface ProcessResult {
  scanned: number;
  candidates: number;
  events: number;
}

/**
 * Nối parser + engine đối soát vào database.
 *
 * Nguyên tắc: parser chỉ đọc, engine chỉ suy luận, còn lớp này là nơi duy nhất ghi dữ liệu —
 * nên mọi quyết định "tự thêm hay hỏi người dùng" nằm gọn một chỗ.
 */
@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plan: PlanService,
  ) {}

  /**
   * Xử lý một lô email: bỏ thư đã xử lý, parse, ghi sự kiện. Cùng một `providerMessageId`
   * không bao giờ tạo sự kiện hai lần (khóa unique ở cả `processed_emails` lẫn `subscription_events`).
   */
  async processCandidates(
    userId: string,
    accountId: string,
    emails: readonly EmailCandidate[],
  ): Promise<ProcessResult> {
    if (emails.length === 0) return { scanned: 0, candidates: 0, events: 0 };

    const seen = await this.prisma.processedEmail.findMany({
      where: {
        accountId,
        providerMessageId: { in: emails.map((e) => e.messageId) },
        parserVersion: { gte: PARSER_VERSION },
      },
      select: { providerMessageId: true },
    });
    const seenIds = new Set(seen.map((row) => row.providerMessageId));

    let candidates = 0;
    let events = 0;
    for (const email of emails) {
      if (seenIds.has(email.messageId)) continue;
      let detected: DetectedEvent | null = null;
      let parseStatus: 'PARSED' | 'NO_MATCH' | 'FAILED' = 'NO_MATCH';
      try {
        detected = parseEmail(email);
        if (detected) {
          parseStatus = 'PARSED';
          candidates++;
        }
      } catch (error) {
        parseStatus = 'FAILED';
        this.logger.warn(
          `Parse lỗi email ${email.messageId}: ${message(error)}`,
        );
      }

      if (detected && (await this.storeEvent(userId, email, detected)))
        events++;
      await this.markProcessed(accountId, email, parseStatus);
    }
    return { scanned: emails.length, candidates, events };
  }

  /** Ghi sự kiện; trả về false nếu sự kiện này đã có (email xử lý lại). */
  private async storeEvent(
    userId: string,
    email: EmailCandidate,
    detected: DetectedEvent,
  ): Promise<boolean> {
    const serviceId = detected.serviceSlug
      ? await this.serviceIdBySlug(detected.serviceSlug)
      : null;
    const data: Prisma.SubscriptionEventUncheckedCreateInput = {
      userId,
      source: 'EMAIL',
      sourceRef: email.messageId,
      eventType: detected.eventType,
      merchantKey: detected.merchantKey,
      merchantName: detected.merchantName,
      serviceId,
      planName: detected.planName ?? null,
      amountMinor: detected.amountMinor ?? null,
      currency: detected.currency ?? null,
      intervalUnit: detected.intervalUnit ?? null,
      intervalCount: detected.intervalCount ?? null,
      occurredAt: detected.occurredAt,
      renewalDate: detected.renewalDate ? toDbDate(detected.renewalDate) : null,
      trialEndDate: detected.trialEndDate
        ? toDbDate(detected.trialEndDate)
        : null,
      accessUntil: detected.accessUntil ? toDbDate(detected.accessUntil) : null,
      confidence: detected.confidence,
      // Chỉ giữ dấu vết đủ để gỡ lỗi, không lưu nội dung thư
      extracted: {
        parser: detected.parser,
        senderDomain: email.senderDomain,
        subjectHash: hash(email.subject),
      },
    };
    try {
      await this.prisma.subscriptionEvent.create({ data });
      return true;
    } catch {
      // Trùng (sourceRef, eventType) — email đã sinh sự kiện này rồi
      return false;
    }
  }

  private async markProcessed(
    accountId: string,
    email: EmailCandidate,
    parseStatus: 'PARSED' | 'NO_MATCH' | 'FAILED',
  ): Promise<void> {
    const data = {
      senderDomain: email.senderDomain,
      subjectHash: hash(email.subject),
      receivedAt: email.receivedAt,
      parseStatus,
      parserVersion: PARSER_VERSION,
      processedAt: new Date(),
    };
    await this.prisma.processedEmail.upsert({
      where: {
        accountId_providerMessageId: {
          accountId,
          providerMessageId: email.messageId,
        },
      },
      create: { accountId, providerMessageId: email.messageId, ...data },
      update: data,
    });
  }

  /**
   * Đối soát toàn bộ sự kiện của người dùng thành subscription.
   * Chạy sau mỗi lượt quét; chạy lại nhiều lần vẫn ra cùng kết quả.
   */
  async reconcileUser(
    userId: string,
  ): Promise<{ created: number; updated: number; inbox: number }> {
    const [events, subscriptions, settings] = await Promise.all([
      this.prisma.subscriptionEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.subscription.findMany({
        where: { userId, status: { not: 'ARCHIVED' } },
      }),
      this.prisma.userSettings.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
    ]);
    if (events.length === 0) return { created: 0, updated: 0, inbox: 0 };

    const today = todayInTimeZone(settings?.timezone ?? DEFAULT_TIMEZONE);
    const byMerchant = new Map<string, SubscriptionEvent[]>();
    for (const event of events) {
      byMerchant.set(event.merchantKey, [
        ...(byMerchant.get(event.merchantKey) ?? []),
        event,
      ]);
    }

    let created = 0;
    let updated = 0;
    let inbox = 0;
    for (const [merchantKey, merchantEvents] of byMerchant) {
      const result = reconcile(merchantEvents.map(toFacts), today);
      const existing = this.matchSubscription(
        subscriptions,
        merchantKey,
        merchantEvents,
        result,
      );

      if (!existing && result.confidence < CONFIDENCE.medium) {
        // Bằng chứng yếu: không tự khẳng định, đưa vào Inbox để người dùng quyết định
        inbox += await this.upsertInboxItem(userId, 'CONFIRM_ACTIVE', null, {
          merchantKey,
          merchantName: merchantEvents.at(-1)?.merchantName ?? merchantKey,
          confidence: result.confidence,
          reason: result.reviewReason,
        });
        continue;
      }

      if (existing) {
        await this.applyToExisting(
          existing,
          merchantKey,
          result,
          merchantEvents,
        );
        updated++;
      } else {
        const subscription = await this.createFromDetection(
          userId,
          merchantKey,
          result,
          merchantEvents,
        );
        if (!subscription) {
          inbox += await this.upsertInboxItem(userId, 'CONFIRM_ACTIVE', null, {
            merchantKey,
            merchantName: merchantEvents.at(-1)?.merchantName ?? merchantKey,
            reason: 'PLAN_LIMIT',
          });
          continue;
        }
        subscriptions.push(subscription);
        created++;
      }

      const target = existing ?? subscriptions.at(-1)!;
      inbox += await this.createFollowUpItems(
        userId,
        target.id,
        result,
        merchantEvents,
      );
    }
    return { created, updated, inbox };
  }

  /**
   * Tìm subscription đã có để gộp bằng chứng thay vì tạo trùng:
   * 1. đã gắn merchantKey · 2. cùng dịch vụ trong thư viện · 3. tên gần giống + giá khớp.
   */
  private matchSubscription(
    subscriptions: readonly Subscription[],
    merchantKey: string,
    events: readonly SubscriptionEvent[],
    result: ReturnType<typeof reconcile>,
  ): Subscription | undefined {
    const byKey = subscriptions.find((s) => s.merchantKey === merchantKey);
    if (byKey) return byKey;

    const serviceId =
      [...events].reverse().find((e) => e.serviceId)?.serviceId ?? null;
    if (serviceId) {
      const byService = subscriptions.find((s) => s.serviceId === serviceId);
      if (byService) return byService;
    }

    const merchantName =
      events.at(-1)?.merchantName?.toLowerCase() ?? merchantKey;
    return subscriptions.find((s) => {
      const name = (s.customName ?? '').toLowerCase();
      if (!name) return false;
      const nameMatches =
        name.includes(merchantName) || merchantName.includes(name);
      if (!nameMatches) return false;
      // Tên giống nhưng giá lệch hẳn thì nhiều khả năng là gói khác
      if (!result.amountMinor) return true;
      const ratio = Number(s.amountMinor) / Number(result.amountMinor);
      return ratio > 0.8 && ratio < 1.25;
    });
  }

  private async applyToExisting(
    subscription: Subscription,
    merchantKey: string,
    result: ReturnType<typeof reconcile>,
    events: readonly SubscriptionEvent[],
  ): Promise<void> {
    const data: Prisma.SubscriptionUncheckedUpdateInput = {
      merchantKey,
      detectionState: result.state,
      confidence: result.confidence,
      lastDetectedAt: new Date(),
      needsReview: result.needsReview,
      reviewReason: result.reviewReason,
    };

    // Gói người dùng tự nhập: chỉ bổ sung bằng chứng, không ghi đè số liệu họ đã nhập
    if (subscription.source === 'EMAIL') {
      if (result.amountMinor) data.amountMinor = result.amountMinor;
      if (result.currency) data.currency = result.currency;
      data.intervalUnit = result.intervalUnit;
      data.intervalCount = result.intervalCount;
      if (result.planName) data.planName = result.planName;
      data.status = toStatus(result.state);
      data.nextRenewalDate = result.nextRenewalDate
        ? toDbDate(result.nextRenewalDate)
        : null;
      data.trialEndDate = result.trialEndDate
        ? toDbDate(result.trialEndDate)
        : null;
      if (result.state === 'CANCELLED' || result.state === 'EXPIRED') {
        data.cancelledAt = subscription.cancelledAt ?? new Date();
      }
    }

    await this.prisma.$transaction([
      this.prisma.subscription.update({ where: { id: subscription.id }, data }),
      this.prisma.subscriptionEvent.updateMany({
        where: { id: { in: events.map((e) => e.id) }, subscriptionId: null },
        data: { subscriptionId: subscription.id },
      }),
    ]);
  }

  /** Tạo subscription mới từ phát hiện. Trả về null khi gói Free đã đầy. */
  private async createFromDetection(
    userId: string,
    merchantKey: string,
    result: ReturnType<typeof reconcile>,
    events: readonly SubscriptionEvent[],
  ): Promise<Subscription | null> {
    const limit = await this.plan.subscriptionLimit(userId);
    if (limit !== null) {
      const tracked = await this.prisma.subscription.count({
        where: { userId, status: { in: TRACKED_STATUSES } },
      });
      if (tracked >= limit) return null;
    }

    const last = events.at(-1)!;
    const serviceId =
      [...events].reverse().find((e) => e.serviceId)?.serviceId ?? null;
    const startDate =
      result.lastChargedOn ??
      fromDbDate(new Date(events[0]!.occurredAt.toISOString().slice(0, 10)));

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        serviceId,
        customName: serviceId ? null : (last.merchantName ?? merchantKey),
        planName: result.planName,
        amountMinor: result.amountMinor ?? 0n,
        currency: (result.currency as CurrencyCode | null) ?? 'VND',
        intervalUnit: result.intervalUnit,
        intervalCount: result.intervalCount,
        anchorDay: Number(startDate.slice(8, 10)),
        startDate: toDbDate(startDate),
        nextRenewalDate: result.nextRenewalDate
          ? toDbDate(result.nextRenewalDate)
          : null,
        trialEndDate: result.trialEndDate
          ? toDbDate(result.trialEndDate)
          : null,
        status: toStatus(result.state),
        source: 'EMAIL',
        detectionState: result.state,
        confidence: result.confidence,
        merchantKey,
        lastDetectedAt: new Date(),
        needsReview: result.needsReview,
        reviewReason: result.reviewReason,
      },
    });
    await this.prisma.subscriptionEvent.updateMany({
      where: { id: { in: events.map((e) => e.id) } },
      data: { subscriptionId: subscription.id },
    });
    return subscription;
  }

  /** Việc cần người dùng biết sau khi đối soát: đổi giá, thanh toán lỗi, cần xác nhận. */
  private async createFollowUpItems(
    userId: string,
    subscriptionId: string,
    result: ReturnType<typeof reconcile>,
    events: readonly SubscriptionEvent[],
  ): Promise<number> {
    let created = 0;
    const merchantName = events.at(-1)?.merchantName ?? '';

    if (result.priceChange) {
      created += await this.upsertInboxItem(
        userId,
        'PRICE_CHANGED',
        subscriptionId,
        {
          merchantName,
          fromMinor: result.priceChange.fromMinor.toString(),
          toMinor: result.priceChange.toMinor.toString(),
          currency: result.priceChange.currency,
        },
      );
    }
    if (result.state === 'PAYMENT_ISSUE') {
      created += await this.upsertInboxItem(
        userId,
        'PAYMENT_FAILED',
        subscriptionId,
        {
          merchantName,
        },
      );
    }
    if (result.needsReview && result.state === 'POSSIBLY_ACTIVE') {
      created += await this.upsertInboxItem(
        userId,
        'CONFIRM_ACTIVE',
        subscriptionId,
        {
          merchantName,
          reason: result.reviewReason,
        },
      );
    }
    return created;
  }

  /** Không tạo trùng: mỗi (người dùng, loại, subscription) chỉ có một việc đang mở. */
  private async upsertInboxItem(
    userId: string,
    kind: 'CONFIRM_ACTIVE' | 'PRICE_CHANGED' | 'PAYMENT_FAILED',
    subscriptionId: string | null,
    payload: Prisma.InputJsonValue,
  ): Promise<number> {
    const existing = await this.prisma.inboxItem.findFirst({
      where: { userId, kind, subscriptionId, status: 'OPEN' },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.inboxItem.update({
        where: { id: existing.id },
        data: { payload },
      });
      return 0;
    }
    await this.prisma.inboxItem.create({
      data: { userId, kind, subscriptionId, payload },
    });
    return 1;
  }

  private async serviceIdBySlug(slug: string): Promise<string | null> {
    const service = await this.prisma.service.findUnique({
      where: { slug },
      select: { id: true },
    });
    return service?.id ?? null;
  }
}

/** `DetectionState` (suy luận) → `SubscriptionStatus` (thứ người dùng thấy trong app). */
export function toStatus(state: DetectionState): SubscriptionStatus {
  switch (state) {
    case 'TRIAL':
      return 'TRIAL';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'CANCELLED';
    // PAYMENT_ISSUE và POSSIBLY_ACTIVE vẫn là gói đang theo dõi, chỉ kèm cảnh báo trong Inbox
    default:
      return 'ACTIVE';
  }
}

function toFacts(event: SubscriptionEvent): EventFacts {
  return {
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    amountMinor: event.amountMinor,
    currency: event.currency,
    intervalUnit: event.intervalUnit,
    intervalCount: event.intervalCount,
    planName: event.planName,
    renewalDate: event.renewalDate
      ? (fromDbDate(event.renewalDate) as IsoDate)
      : null,
    trialEndDate: event.trialEndDate
      ? (fromDbDate(event.trialEndDate) as IsoDate)
      : null,
    accessUntil: event.accessUntil
      ? (fromDbDate(event.accessUntil) as IsoDate)
      : null,
    confidence: event.confidence,
  };
}

const hash = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 32);

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Dùng lại trong test tích hợp. */
export { merchantByKey };
