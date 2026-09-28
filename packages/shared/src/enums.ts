/**
 * Enum dùng chung giữa mobile, API và admin.
 * Giá trị PHẢI khớp với các enum trong apps/api/prisma/schema.prisma.
 */
import { z } from 'zod';

export const SubscriptionStatus = z.enum(['ACTIVE', 'TRIAL', 'REVIEW', 'CANCELLED', 'ARCHIVED']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const IntervalUnit = z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']);
export type IntervalUnit = z.infer<typeof IntervalUnit>;

export const UsageFrequency = z.enum([
  'NEVER',
  'RARELY',
  'SOMETIMES',
  'WEEKLY',
  'SEVERAL_PER_WEEK',
  'DAILY',
]);
export type UsageFrequency = z.infer<typeof UsageFrequency>;

export const PaymentMethodType = z.enum([
  'CARD',
  'PAYPAL',
  'APP_STORE',
  'GOOGLE_PLAY',
  'E_WALLET',
  'BANK_TRANSFER',
  'OTHER',
]);
export type PaymentMethodType = z.infer<typeof PaymentMethodType>;

export const ReminderKind = z.enum(['RENEWAL', 'TRIAL_END']);
export type ReminderKind = z.infer<typeof ReminderKind>;

export const ReviewDecision = z.enum(['KEEP', 'REVIEW', 'CANCEL']);
export type ReviewDecision = z.infer<typeof ReviewDecision>;

export const SplitMode = z.enum(['EQUAL', 'CUSTOM']);
export type SplitMode = z.infer<typeof SplitMode>;

export const GroupPaymentStatus = z.enum(['PENDING', 'CLAIMED_PAID', 'CONFIRMED', 'WAIVED']);
export type GroupPaymentStatus = z.infer<typeof GroupPaymentStatus>;

export const SubscriptionSource = z.enum(['MANUAL', 'EMAIL']);
export type SubscriptionSource = z.infer<typeof SubscriptionSource>;

/** Trạng thái Subca suy ra từ email (khác `SubscriptionStatus` mà người dùng chỉnh tay). */
export const DetectionState = z.enum([
  'ACTIVE',
  'TRIAL',
  'POSSIBLY_ACTIVE',
  'CANCELLED',
  'EXPIRED',
  'PAYMENT_ISSUE',
  'UNKNOWN',
]);
export type DetectionState = z.infer<typeof DetectionState>;

export const ConnectedProvider = z.enum(['GMAIL']);
export type ConnectedProvider = z.infer<typeof ConnectedProvider>;

export const ConnectedAccountStatus = z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR']);
export type ConnectedAccountStatus = z.infer<typeof ConnectedAccountStatus>;

export const EmailSyncKind = z.enum(['INITIAL', 'INCREMENTAL']);
export type EmailSyncKind = z.infer<typeof EmailSyncKind>;

export const EmailSyncStatus = z.enum(['RUNNING', 'DONE', 'FAILED']);
export type EmailSyncStatus = z.infer<typeof EmailSyncStatus>;

export const EmailParseStatus = z.enum(['NO_MATCH', 'PARSED', 'FAILED', 'SKIPPED']);
export type EmailParseStatus = z.infer<typeof EmailParseStatus>;

export const SubscriptionEventType = z.enum([
  'SUBSCRIPTION_STARTED',
  'TRIAL_STARTED',
  'TRIAL_ENDING',
  'PAYMENT_SUCCESS',
  'RENEWAL',
  'PRICE_CHANGED',
  'PLAN_CHANGED',
  'PAYMENT_FAILED',
  'CANCELLATION_REQUESTED',
  'SUBSCRIPTION_CANCELLED',
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_RESUMED',
]);
export type SubscriptionEventType = z.infer<typeof SubscriptionEventType>;

export const EventSource = z.enum(['EMAIL', 'MANUAL', 'SYSTEM']);
export type EventSource = z.infer<typeof EventSource>;

export const InboxItemKind = z.enum([
  'CONFIRM_ACTIVE',
  'TRIAL_ENDING',
  'PRICE_CHANGED',
  'PAYMENT_FAILED',
  'POSSIBLE_DUPLICATE',
  'SUBSCRIPTION_CANCELLED',
]);
export type InboxItemKind = z.infer<typeof InboxItemKind>;

export const InboxItemStatus = z.enum(['OPEN', 'RESOLVED', 'DISMISSED']);
export type InboxItemStatus = z.infer<typeof InboxItemStatus>;

/** Ngưỡng độ tin cậy quyết định Subca tự nhận hay hỏi người dùng. */
export const CONFIDENCE = {
  /** ≥ 75: tự thêm vào danh sách, không hỏi. */
  high: 75,
  /** ≥ 45: vẫn thêm nhưng gắn nhãn "Cần kiểm tra". */
  medium: 45,
} as const;

export const PlusProduct = z.enum(['PLUS_MONTHLY', 'PLUS_YEARLY', 'PLUS_LIFETIME']);
export type PlusProduct = z.infer<typeof PlusProduct>;

export const AdminRole = z.enum(['OWNER', 'ADMIN', 'SUPPORT', 'MARKETING', 'VIEWER']);
export type AdminRole = z.infer<typeof AdminRole>;

export const AuditActorType = z.enum(['ADMIN', 'SYSTEM']);
export type AuditActorType = z.infer<typeof AuditActorType>;

export const AuditSeverity = z.enum(['INFO', 'SENSITIVE', 'CRITICAL']);
export type AuditSeverity = z.infer<typeof AuditSeverity>;

export const PriceReportStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type PriceReportStatus = z.infer<typeof PriceReportStatus>;

/** Giới hạn gói Free (khớp paywall và trang Gói trong admin). */
export const FREE_LIMITS = {
  maxSubscriptions: 8,
  maxReminderOffsets: 1,
  maxOwnedGroups: 1,
} as const;
