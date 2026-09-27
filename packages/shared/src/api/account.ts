/** Hợp đồng API cho hồ sơ, cài đặt, ngân sách, phương thức thanh toán và Trang chủ. */
import { z } from 'zod';
import { PaymentMethodType } from '../enums.js';
import { CurrencyCode } from '../money.js';
import type { SubscriptionDto } from './subscription.js';
import { MinorAmountString } from './subscription.js';

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ─────────────── Hồ sơ & cài đặt ───────────────

export const UpdateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Không có trường nào để cập nhật');
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const UpdateSettingsSchema = z
  .object({
    currency: CurrencyCode,
    timezone: z.string().min(1).max(64).refine(isValidTimeZone, 'Múi giờ không hợp lệ'),
    locale: z.enum(['vi-VN', 'en-US']),
    /** Giờ nhận nhắc, phút tính từ 00:00 (510 = 08:30). */
    reminderMinuteOfDay: z.number().int().min(0).max(1439),
    notificationsEnabled: z.boolean(),
    marketingOptIn: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Không có trường nào để cập nhật');
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>;

export interface SettingsDto {
  currency: CurrencyCode;
  timezone: string;
  locale: string;
  reminderMinuteOfDay: number;
  notificationsEnabled: boolean;
  marketingOptIn: boolean;
}

// ─────────────── Ngân sách ───────────────

export const UpsertBudgetSchema = z.object({
  amountMinor: MinorAmountString.refine((s) => BigInt(s) > 0n, 'Hạn mức phải lớn hơn 0'),
  currency: CurrencyCode,
  alertAtPercent: z.number().int().min(1).max(200).default(90),
});
export type UpsertBudget = z.output<typeof UpsertBudgetSchema>;

export interface BudgetDto {
  amountMinor: string;
  currency: CurrencyCode;
  alertAtPercent: number;
}

// ─────────────── Phương thức thanh toán ───────────────

const PaymentMethodFields = z.object({
  type: PaymentMethodType,
  /** VD VISA, MASTERCARD, MOMO. */
  brand: z.string().trim().toUpperCase().max(20).nullable().optional(),
  label: z.string().trim().min(1).max(40),
  /** Chỉ 4 số cuối. KHÔNG BAO GIỜ gửi số thẻ đầy đủ. */
  last4: z
    .string()
    .regex(/^\d{4}$/, 'Chỉ nhập 4 số cuối')
    .nullable()
    .optional(),
  isDefault: z.boolean().default(false),
});

export const CreatePaymentMethodSchema = PaymentMethodFields;
export type CreatePaymentMethod = z.output<typeof CreatePaymentMethodSchema>;

export const UpdatePaymentMethodSchema = PaymentMethodFields.extend({ isDefault: z.boolean() })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Không có trường nào để cập nhật');
export type UpdatePaymentMethod = z.output<typeof UpdatePaymentMethodSchema>;

export interface PaymentMethodDto {
  id: string;
  type: PaymentMethodType;
  brand: string | null;
  label: string;
  last4: string | null;
  isDefault: boolean;
  /** Số subscription đang theo dõi (ACTIVE / TRIAL / REVIEW) dùng phương thức này. */
  subscriptionCount: number;
  /** Tổng chi phí tháng quy đổi về tiền tệ chính của người dùng (không tính trial). */
  monthlyTotalMinor: string;
}

// ─────────────── Trang chủ ───────────────

export interface HomeDto {
  /** Tiền tệ chính của người dùng; mọi tổng đã quy đổi về tiền tệ này. */
  currency: CurrencyCode;
  /** Tổng chi phí mỗi tháng của các gói đang trả tiền (ACTIVE + REVIEW, không tính trial). */
  monthlyTotalMinor: string;
  yearlyProjectionMinor: string;
  activeCount: number;
  trialCount: number;
  /** Số khoản (không tính trial) sẽ gia hạn trong 7 ngày tới, kể cả hôm nay. */
  dueIn7DaysCount: number;
  /** Tổng chi phí tháng của các gói đang đánh dấu "Cần xem lại". */
  potentialSavingsMinor: string;
  budget: (BudgetDto & { spentMinor: string; percent: number; overBudget: boolean }) | null;
  /** 5 khoản gia hạn gần nhất (không tính trial). */
  upcoming: SubscriptionDto[];
  /** Trial đang chạy, hết hạn sớm nhất trước. */
  trials: SubscriptionDto[];
  /** Tiền tệ chưa có tỷ giá → các khoản này KHÔNG được cộng vào tổng. */
  missingRates: CurrencyCode[];
  plan: 'FREE' | 'PLUS';
}
