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
