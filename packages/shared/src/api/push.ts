import { z } from 'zod';
import { IntervalUnit, ReminderKind } from '../enums.js';
import type { IsoDate } from '../renewal.js';
import type { ServiceSummaryDto } from './subscription.js';

/** Định dạng token của Expo: ExponentPushToken[...] hoặc ExpoPushToken[...]. */
const ExpoPushTokenString = z
  .string()
  .max(200)
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Token push không hợp lệ');

export const RegisterPushTokenSchema = z.object({
  token: ExpoPushTokenString,
  platform: z.enum(['IOS', 'ANDROID']),
  deviceName: z.string().trim().max(80).nullable().optional(),
  appVersion: z.string().trim().max(20).nullable().optional(),
});
export type RegisterPushToken = z.infer<typeof RegisterPushTokenSchema>;

export const UnregisterPushTokenSchema = z.object({ token: ExpoPushTokenString });
export type UnregisterPushToken = z.infer<typeof UnregisterPushTokenSchema>;

// ─────────────── Lịch sử nhắc, nhắc sắp tới & quy tắc nhắc ───────────────

/** Một lượt nhắc (đã gửi hoặc sắp gửi) với đúng tiêu đề / nội dung của push. */
export interface ReminderFeedItemDto {
  /** ID lượt nhắc đã lưu; null với lượt sắp tới chưa được tạo (server chỉ tạo trước 26 giờ). */
  id: string | null;
  subscriptionId: string;
  name: string;
  service: ServiceSummaryDto | null;
  kind: ReminderKind;
  offsetDays: number;
  dueDate: IsoDate;
  /** Thời điểm đã gửi (lịch sử) hoặc sẽ gửi (sắp tới), ISO 8601. */
  at: string;
  title: string;
  body: string;
}

export interface RemindersDto {
  /** Đã gửi trong 30 ngày gần nhất, mới nhất trước. */
  history: ReminderFeedItemDto[];
  /** Sẽ gửi trong 30 ngày tới theo quy tắc hiện tại, gần nhất trước (app dùng để lên lịch thông báo cục bộ dự phòng). */
  upcoming: ReminderFeedItemDto[];
  notificationsEnabled: boolean;
}

export const ReminderRuleSchema = z.object({
  kind: ReminderKind,
  offsetDays: z.number().int().min(0).max(90),
  /** Chỉ áp dụng cho gói có chu kỳ từ đơn vị này trở lên (VD nhắc 30 ngày chỉ cho gói năm). */
  minInterval: IntervalUnit.nullable().default(null),
  enabled: z.boolean(),
});
export type ReminderRuleDto = z.output<typeof ReminderRuleSchema>;

export const UpdateReminderRulesSchema = z.object({
  rules: z
    .array(ReminderRuleSchema)
    .max(12)
    .refine(
      (rules) => new Set(rules.map((r) => `${r.kind}:${r.offsetDays}`)).size === rules.length,
      'Mỗi mốc nhắc chỉ được xuất hiện một lần',
    ),
});
export type UpdateReminderRules = z.output<typeof UpdateReminderRulesSchema>;
