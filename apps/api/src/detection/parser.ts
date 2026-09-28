import type {
  CurrencyCode,
  IntervalUnit,
  IsoDate,
  SubscriptionEventType,
} from '@subca/shared';
import type { EmailCandidate } from '../integrations/mail/mail-provider.js';
import { classifyCandidate } from './candidate-filter.js';
import {
  extractAmount,
  extractDate,
  extractInterval,
  extractLineItems,
  extractPlanName,
  type LineItem,
} from './extract.js';
import {
  merchantByDomain,
  merchantByText,
  merchantKeyFromDomain,
  merchantKeyFromLabel,
  merchantNameFromDomain,
  merchantNameFromLabel,
  type MerchantRule,
} from './merchants.js';

/** Đổi parser thì tăng số này để quét lại các email đã xử lý bằng bản cũ. */
export const PARSER_VERSION = 2;

/** Sự kiện parser đọc được. Parser KHÔNG đụng database — engine đối soát mới quyết định ghi gì. */
export interface DetectedEvent {
  eventType: SubscriptionEventType;
  merchantKey: string;
  merchantName: string;
  serviceSlug?: string;
  planName?: string;
  amountMinor?: bigint;
  currency?: CurrencyCode;
  intervalUnit?: IntervalUnit;
  intervalCount?: number;
  occurredAt: Date;
  renewalDate?: IsoDate;
  trialEndDate?: IsoDate;
  accessUntil?: IsoDate;
  /** 0–100 cho riêng sự kiện này. */
  confidence: number;
  /** Ai đọc ra: `merchant:netflix`, `generic`, `llm`. */
  parser: string;
}

/**
 * Luật nhận diện loại sự kiện. Thứ tự quan trọng: luật đứng trước thắng, nên các sự kiện
 * "mạnh" (hủy, lỗi thanh toán) phải nằm trên các sự kiện chung chung (thanh toán thành công).
 */
const EVENT_RULES: {
  type: SubscriptionEventType;
  pattern: RegExp;
  confidence: number;
}[] = [
  {
    type: 'PAYMENT_FAILED',
    pattern:
      /(payment (failed|declined|was declined|unsuccessful)|we could(n't| not) (charge|process)|thanh toán (thất bại|không thành công)|trừ tiền thất bại)/i,
    confidence: 85,
  },
  {
    type: 'SUBSCRIPTION_CANCELLED',
    pattern:
      /(your (subscription|membership|plan) (has been|was) (cancell?ed|canceled)|subscription cancell?ed|đã (hủy|huỷ) (gói|đăng ký)|gói của bạn đã bị (hủy|huỷ))/i,
    confidence: 88,
  },
  {
    type: 'CANCELLATION_REQUESTED',
    pattern:
      /(we('| a)re sorry to see you go|cancellation (request|confirmed)|you('ve| have) cancell?ed|yêu cầu (hủy|huỷ))/i,
    confidence: 75,
  },
  {
    type: 'SUBSCRIPTION_EXPIRED',
    pattern:
      /(subscription (has )?expired|membership expired|gói đã hết hạn|đã hết hạn sử dụng)/i,
    confidence: 80,
  },
  {
    type: 'TRIAL_ENDING',
    pattern:
      /(trial (ends|ending|will end|expires)|free trial (ends|is ending)|dùng thử (sắp|sẽ) (hết|kết thúc))/i,
    confidence: 82,
  },
  {
    type: 'TRIAL_STARTED',
    pattern:
      /(your free trial (has )?(started|begins)|welcome to your (free )?trial|start(ed)? your free trial|bắt đầu dùng thử|dùng thử miễn phí)/i,
    confidence: 82,
  },
  {
    type: 'PRICE_CHANGED',
    pattern:
      /(price (change|increase|update)|we('re| are) (updating|changing) (the )?price|new price|thay đổi giá|tăng giá|điều chỉnh giá)/i,
    confidence: 80,
  },
  {
    type: 'PLAN_CHANGED',
    pattern:
      /(your plan (has )?changed|switched to the|upgrade(d)? to|downgrade(d)? to|đã (nâng|hạ) cấp gói|đổi gói)/i,
    confidence: 70,
  },
  {
    type: 'SUBSCRIPTION_RESUMED',
    pattern:
      /(subscription (has been )?(resumed|restarted|reactivated)|welcome back|đã (mở lại|kích hoạt lại))/i,
    confidence: 78,
  },
  {
    type: 'SUBSCRIPTION_STARTED',
    pattern:
      /(welcome to|your subscription (has )?started|thanks for subscribing|subscription confirm(ed|ation)|đăng ký thành công|chào mừng bạn đến với)/i,
    confidence: 72,
  },
  {
    type: 'RENEWAL',
    pattern:
      /(auto[- ]?renew|renews on|will renew|renewal (date|notice)|subscription renewed|tự động gia hạn|sẽ gia hạn|gia hạn vào)/i,
    confidence: 78,
  },
  {
    type: 'PAYMENT_SUCCESS',
    pattern:
      /(receipt|invoice|payment (received|successful|confirmation)|thank you for your payment|you were charged|charged to your|hóa đơn|biên nhận|thanh toán thành công|đã thanh toán)/i,
    confidence: 70,
  },
];

/** Ngày gia hạn tiếp theo thường đứng cạnh các cụm này. */
const NEXT_DATE_HINTS =
  /(next (billing|payment|charge|renewal)[^.\n]{0,40}|renews on|will renew on|gia hạn (tiếp theo|vào)|ngày gia hạn)/i;
const TRIAL_DATE_HINTS =
  /(trial (ends|will end|expires)[^.\n]{0,40}|free trial until|dùng thử (đến|kết thúc))/i;
const ACCESS_UNTIL_HINTS =
  /(access until|you can (still )?use[^.\n]{0,40}until|có thể dùng đến|sử dụng đến hết)/i;

/**
 * Parser nhiều lớp:
 * 1. merchant đã biết (tên miền người gửi) → biết trước tên dịch vụ, chu kỳ mặc định
 * 2. tổng quát (regex sự kiện + trích tiền/ngày) cho merchant lạ
 * 3. LLM — cắm sau qua `LlmParser`, chỉ chạy khi hai lớp trên không ra gì
 *
 * Trả về `null` nếu email không phải chuyện subscription.
 */
export function parseEmails(email: EmailCandidate): DetectedEvent[] {
  const verdict = classifyCandidate(email);
  if (!verdict.isCandidate) return [];

  const text = `${email.subject}\n${email.textContent}`;
  // Tiêu đề nói rõ chuyện gì hơn nội dung: mail "dùng thử đã bắt đầu" thường kèm luôn
  // câu "dùng thử kết thúc ngày…", nên xét tiêu đề trước rồi mới tới toàn văn.
  const rule = matchEventRule(email.subject) ?? matchEventRule(text);
  if (!rule) return [];

  const merchant = resolveMerchant(email, text);

  // Hóa đơn gộp (Apple, Google Play, ví điện tử): mỗi dòng là một dịch vụ riêng
  if (merchant.aggregatorOf) {
    const split = splitAggregated(email, text, rule, verdict.score, merchant);
    if (split.length > 0) return split;
  }

  return [singleEvent(email, text, rule, verdict.score, merchant)];
}

/**
 * Bản một-sự-kiện cho những chỗ chỉ cần kết quả chính (test, gỡ lỗi).
 * Đường chạy thật dùng `parseEmails` vì một email có thể chứa nhiều dịch vụ.
 */
export function parseEmail(email: EmailCandidate): DetectedEvent | null {
  return parseEmails(email)[0] ?? null;
}

function singleEvent(
  email: EmailCandidate,
  text: string,
  rule: (typeof EVENT_RULES)[number],
  candidateScore: number,
  merchant: ResolvedMerchant,
): DetectedEvent {
  const amount = extractAmount(text);
  const interval = extractInterval(text) ?? merchant.rule?.defaultInterval;

  const event: DetectedEvent = {
    eventType: rule.type,
    merchantKey: merchant.key,
    merchantName: merchant.name,
    occurredAt: email.receivedAt,
    confidence: scoreConfidence(
      rule.confidence,
      candidateScore,
      Boolean(amount),
      Boolean(merchant.rule),
    ),
    parser: merchant.rule ? `merchant:${merchant.rule.key}` : 'generic',
  };
  if (merchant.rule?.serviceSlug) event.serviceSlug = merchant.rule.serviceSlug;

  const planName = extractPlanName(text);
  if (planName) event.planName = planName;
  if (amount) {
    event.amountMinor = amount.amountMinor;
    event.currency = amount.currency;
  }
  if (interval) {
    event.intervalUnit = interval.intervalUnit;
    event.intervalCount = interval.intervalCount;
  }

  const renewalDate = extractDate(text, NEXT_DATE_HINTS);
  if (renewalDate) event.renewalDate = renewalDate;
  const trialEnd = extractDate(text, TRIAL_DATE_HINTS);
  if (trialEnd) event.trialEndDate = trialEnd;
  const accessUntil = extractDate(text, ACCESS_UNTIL_HINTS);
  if (accessUntil) event.accessUntil = accessUntil;

  return event;
}

/**
 * Tách hóa đơn gộp thành nhiều sự kiện — một biên nhận Apple có thể gồm iCloud+, Spotify
 * và một game, mỗi thứ một giá. Coi cả hóa đơn là một subscription thì số tiền sai và
 * người dùng mất dấu các dịch vụ còn lại.
 *
 * Chỉ tách khi đọc được **từ hai dòng trở lên**: một dòng đơn độc thì đường thường xử lý
 * tốt hơn (còn lấy được cả ngày gia hạn ghi trong thư).
 */
function splitAggregated(
  email: EmailCandidate,
  text: string,
  rule: (typeof EVENT_RULES)[number],
  candidateScore: number,
  aggregator: ResolvedMerchant,
): DetectedEvent[] {
  const aggregatorKey = aggregator.aggregatorOf!.key;
  const items = extractLineItems(text).filter(
    (item) => !isAggregatorLabel(item.label, aggregator),
  );
  if (items.length < 2) return [];

  const events: DetectedEvent[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const event = aggregatedEvent(
      email,
      rule,
      candidateScore,
      aggregatorKey,
      item,
    );
    // Cùng một dịch vụ xuất hiện hai lần trong hóa đơn (bảng tóm tắt + chi tiết) → giữ một
    if (seen.has(event.merchantKey)) continue;
    seen.add(event.merchantKey);
    events.push(event);
  }
  return events.length < 2 ? [] : events;
}

function aggregatedEvent(
  email: EmailCandidate,
  rule: (typeof EVENT_RULES)[number],
  candidateScore: number,
  aggregatorKey: string,
  item: LineItem,
): DetectedEvent {
  const inner = merchantByText(item.label);
  const event: DetectedEvent = {
    eventType: rule.type,
    merchantKey: inner?.key ?? merchantKeyFromLabel(item.label),
    merchantName: inner?.name ?? merchantNameFromLabel(item.label),
    amountMinor: item.amountMinor,
    currency: item.currency,
    occurredAt: email.receivedAt,
    confidence: scoreConfidence(
      rule.confidence,
      candidateScore,
      true,
      Boolean(inner),
    ),
    parser: `aggregate:${aggregatorKey}`,
  };
  if (inner?.serviceSlug) event.serviceSlug = inner.serviceSlug;

  const planName = extractPlanName(item.label);
  if (planName) event.planName = planName;

  const interval = item.interval ?? inner?.defaultInterval;
  if (interval) {
    event.intervalUnit = interval.intervalUnit;
    event.intervalCount = interval.intervalCount;
  }
  // Ngày trong hóa đơn gộp (ngày lập, tổng kỳ tới) không gắn riêng cho dòng nào,
  // nên không gán renewalDate ở đây — engine đối soát tự chiếu từ các lần trừ tiền.
  return event;
}

/** Dòng nói về chính cửa hàng ("Apple One", "Google Play") chứ không phải một dịch vụ lẻ. */
function isAggregatorLabel(
  label: string,
  aggregator: ResolvedMerchant,
): boolean {
  const rule = aggregator.aggregatorOf!;
  const lower = label.toLowerCase();
  return [rule.name, ...(rule.aliases ?? [])].some(
    (name) => lower === name.toLowerCase(),
  );
}

function matchEventRule(text: string): (typeof EVENT_RULES)[number] | null {
  return EVENT_RULES.find((rule) => rule.pattern.test(text)) ?? null;
}

interface ResolvedMerchant {
  key: string;
  name: string;
  rule?: MerchantRule;
  /** Cửa hàng gộp đã gửi email này (nếu có) — dùng để tách hóa đơn nhiều dịch vụ. */
  aggregatorOf?: MerchantRule;
}

/**
 * Xác định merchant. Với hóa đơn gộp (Apple, Google Play, PayPal, Stripe) thì tên trong
 * nội dung mới là dịch vụ thật — VD mail của Apple nhưng nội dung nói "Spotify".
 */
function resolveMerchant(
  email: EmailCandidate,
  text: string,
): ResolvedMerchant {
  const byDomain = merchantByDomain(email.senderDomain);
  if (byDomain?.aggregator) {
    const inner = merchantByText(text);
    if (inner)
      return {
        key: inner.key,
        name: inner.name,
        rule: inner,
        aggregatorOf: byDomain,
      };
    return { key: byDomain.key, name: byDomain.name, aggregatorOf: byDomain };
  }
  if (byDomain)
    return { key: byDomain.key, name: byDomain.name, rule: byDomain };

  const byText = merchantByText(text);
  if (byText) return { key: byText.key, name: byText.name, rule: byText };

  return {
    key: merchantKeyFromDomain(email.senderDomain),
    name: merchantNameFromDomain(email.senderDomain),
  };
}

/** Gộp điểm: luật sự kiện là chính, cộng thêm khi biết merchant và đọc được số tiền. */
function scoreConfidence(
  ruleScore: number,
  candidateScore: number,
  hasAmount: boolean,
  knownMerchant: boolean,
): number {
  let score = ruleScore * 0.7 + candidateScore * 0.3;
  if (hasAmount) score += 8;
  if (knownMerchant) score += 7;
  return Math.max(0, Math.min(100, Math.round(score)));
}
