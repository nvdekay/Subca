/**
 * Hợp đồng API cho subscription: schema kiểm tra đầu vào (dùng ở API và form trong app)
 * và kiểu dữ liệu trả về.
 *
 * Tiền đi qua API dưới dạng CHUỖI số nguyên theo đơn vị nhỏ nhất (VD "260000" VND, "1999" USD)
 * vì JSON không có BigInt. Dùng `toMinor()` để đổi số người dùng nhập sang chuỗi này.
 */
import { z } from 'zod';
import {
  DetectionState,
  IntervalUnit,
  PaymentMethodType,
  SubscriptionStatus,
  SubscriptionEventType,
  UsageFrequency,
} from '../enums.js';
import { CurrencyCode } from '../money.js';
import { IsoDateSchema, type IsoDate } from '../renewal.js';

/** Số tiền dạng chuỗi số nguyên không âm, tối đa 15 chữ số. */
export const MinorAmountString = z
  .string()
  .regex(/^\d{1,15}$/, 'Số tiền phải là số nguyên không âm');

const SubscriptionFields = z.object({
  /** Dịch vụ trong thư viện; bỏ trống nếu tự nhập tên. */
  serviceId: z.uuid().nullable().optional(),
  servicePlanId: z.uuid().nullable().optional(),
  customName: z.string().trim().min(1).max(80).nullable().optional(),
  planName: z.string().trim().max(80).nullable().optional(),
  amountMinor: MinorAmountString,
  currency: CurrencyCode,
  intervalUnit: IntervalUnit.default('MONTH'),
  intervalCount: z.number().int().min(1).max(36).default(1),
  /**
   * Một ngày bị trừ tiền (thường là kỳ tới, như ô "Ngày gia hạn" trong app).
   * Với gói dùng thử: là ngày hết trial = ngày tính phí đầu tiên.
   * Server dùng ngày này làm gốc để tính các kỳ về sau.
   */
  billingDate: IsoDateSchema,
  isTrial: z.boolean().default(false),
  autoRenew: z.boolean().default(true),
  paymentMethodId: z.uuid().nullable().optional(),
  usageFrequency: UsageFrequency.nullable().optional(),
  /** Số ngày nhắc trước, ghi đè quy tắc chung (VD [7, 1]). Rỗng = dùng quy tắc chung. */
  reminderOffsets: z
    .array(z.number().int().min(0).max(90))
    .max(5)
    .refine((a) => new Set(a).size === a.length, 'Các mốc nhắc không được trùng nhau')
    .optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const CreateSubscriptionSchema = SubscriptionFields.refine(
  (d) => Boolean(d.serviceId) || Boolean(d.customName),
  { message: 'Chọn một dịch vụ hoặc nhập tên subscription', path: ['customName'] },
);
export type CreateSubscriptionInput = z.input<typeof CreateSubscriptionSchema>;
export type CreateSubscription = z.output<typeof CreateSubscriptionSchema>;

/** Sửa một phần. Bỏ các giá trị mặc định để trường không gửi lên thì giữ nguyên. */
export const UpdateSubscriptionSchema = z
  .object({
    ...SubscriptionFields.shape,
    intervalUnit: IntervalUnit.optional(),
    intervalCount: z.number().int().min(1).max(36).optional(),
    isTrial: z.boolean().optional(),
    autoRenew: z.boolean().optional(),
    /** Chuyển trạng thái thủ công. Lưu trữ dùng DELETE, không đặt ARCHIVED ở đây. */
    status: SubscriptionStatus.exclude(['ARCHIVED']).optional(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Không có trường nào để cập nhật');
export type UpdateSubscriptionInput = z.input<typeof UpdateSubscriptionSchema>;
export type UpdateSubscription = z.output<typeof UpdateSubscriptionSchema>;

export const ListSubscriptionsQuerySchema = z.object({
  status: SubscriptionStatus.exclude(['ARCHIVED']).optional(),
  q: z.string().trim().max(80).optional(),
});
export type ListSubscriptionsQuery = z.infer<typeof ListSubscriptionsQuerySchema>;

export interface ServiceSummaryDto {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  brandColor: string | null;
}

export interface SubscriptionDto {
  id: string;
  /** Tên hiển thị: tên dịch vụ trong thư viện, hoặc tên người dùng tự nhập. */
  name: string;
  service: ServiceSummaryDto | null;
  servicePlanId: string | null;
  planName: string | null;
  amountMinor: string;
  currency: CurrencyCode;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  /** Chi phí quy đổi về 1 tháng, cùng tiền tệ, đơn vị nhỏ nhất. */
  monthlyEquivalentMinor: string;
  startDate: IsoDate;
  nextRenewalDate: IsoDate | null;
  /** Số ngày từ hôm nay (theo múi giờ người dùng) tới kỳ tiếp theo; null nếu đã hủy. */
  daysUntilRenewal: number | null;
  trialEndDate: IsoDate | null;
  status: SubscriptionStatus;
  autoRenew: boolean;
  paymentMethodId: string | null;
  usageFrequency: UsageFrequency | null;
  reminderOffsets: number[];
  notes: string | null;
  /** Nguồn và độ tin cậy để giải thích dữ liệu tự phát hiện. */
  source: 'MANUAL' | 'EMAIL';
  detectionState: DetectionState | null;
  confidence: number | null;
  needsReview: boolean;
  reviewReason: string | null;
  lastDetectedAt: string | null;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

/** `GET /subscriptions/:id`: đủ dữ liệu cho màn Chi tiết trong 1 request. */
export interface SubscriptionDetailDto extends SubscriptionDto {
  paymentMethod: {
    id: string;
    type: PaymentMethodType;
    brand: string | null;
    label: string;
    last4: string | null;
  } | null;
  /** Hướng dẫn hủy lấy từ thư viện dịch vụ; null nếu tự nhập tên. */
  cancelGuide: { url: string | null; website: string | null; steps: string[] } | null;
  /** Các lần đã bị trừ tiền, mới nhất trước (tối đa 12). */
  charges: { chargedOn: IsoDate; amountMinor: string; currency: CurrencyCode }[];
  /** Email làm bằng chứng cho subscription; không bao gồm tiêu đề hay nội dung thư. */
  emailEvidence: EmailEvidenceDto[];
}

export interface EmailEvidenceDto {
  id: string;
  eventType: SubscriptionEventType;
  senderDomain: string | null;
  receivedAt: string | null;
  threadId: string | null;
  confidence: number;
  amountMinor: string | null;
  currency: CurrencyCode | null;
}

export interface SubscriptionListDto {
  items: SubscriptionDto[];
  /** Số subscription đang tính vào giới hạn gói (ACTIVE, TRIAL, REVIEW). */
  trackedCount: number;
  /** null = không giới hạn (Plus). */
  limit: number | null;
}
