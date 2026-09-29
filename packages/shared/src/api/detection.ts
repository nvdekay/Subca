/**
 * Hợp đồng API cho phần tự động phát hiện subscription từ email:
 * kết nối hộp thư, tiến độ quét, dòng thời gian sự kiện và Subca Inbox.
 */
import { z } from 'zod';
import {
  ConnectedAccountStatus,
  ConnectedProvider,
  DetectionState,
  EmailSyncKind,
  EmailSyncStatus,
  InboxItemKind,
  InboxItemStatus,
  IntervalUnit,
  SubscriptionEventType,
} from '../enums.js';
import type { CurrencyCode } from '../money.js';
import type { IsoDate } from '../renewal.js';
import type { ServiceSummaryDto } from './subscription.js';

// ─────────────── Kết nối hộp thư ───────────────

export interface ConnectedAccountDto {
  id: string;
  provider: ConnectedProvider;
  /** Địa chỉ hộp thư đã kết nối (chỉ để hiển thị). */
  providerEmail: string;
  status: ConnectedAccountStatus;
  lastSyncAt: string | null;
  initialSyncDoneAt: string | null;
  /** Lượt quét đang chạy hoặc vừa xong. */
  sync: SyncRunDto | null;
  createdAt: string;
}

export interface SyncRunDto {
  id: string;
  kind: EmailSyncKind;
  status: EmailSyncStatus;
  scannedCount: number;
  candidateCount: number;
  eventCount: number;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

/** Khoảng thời gian người dùng chọn cho một lượt quét Gmail thủ công. */
export const SyncConnectionSchema = z
  .object({
    windowMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).optional(),
  })
  .optional();
export type SyncConnection = z.infer<typeof SyncConnectionSchema>;

export interface ConnectionsDto {
  accounts: ConnectedAccountDto[];
  /** Máy chủ đã cấu hình OAuth Google chưa; chưa thì app ẩn nút kết nối. */
  gmailAvailable: boolean;
}

export const StartConnectionSchema = z.object({
  /** Deep link để mở lại app sau khi người dùng đồng ý trên Google. */
  redirectTo: z.string().trim().min(1).max(300).optional(),
});
export type StartConnection = z.infer<typeof StartConnectionSchema>;

export interface StartConnectionDto {
  /** URL trang đồng ý của Google — app mở bằng trình duyệt hệ thống. */
  authorizeUrl: string;
}

// ─────────────── Sự kiện subscription ───────────────

export interface SubscriptionEventDto {
  id: string;
  eventType: SubscriptionEventType;
  source: 'EMAIL' | 'MANUAL' | 'SYSTEM';
  merchantName: string | null;
  planName: string | null;
  amountMinor: string | null;
  currency: CurrencyCode | null;
  intervalUnit: IntervalUnit | null;
  intervalCount: number | null;
  occurredAt: string;
  renewalDate: IsoDate | null;
  trialEndDate: IsoDate | null;
  confidence: number;
}

export interface SubscriptionTimelineDto {
  subscriptionId: string;
  /** Mới nhất trước. */
  events: SubscriptionEventDto[];
}

/** Phần bổ sung cho subscription khi Subca tự phát hiện (đính kèm DTO subscription). */
export interface DetectionInfoDto {
  source: 'MANUAL' | 'EMAIL';
  autoDetected: boolean;
  detectionState: DetectionState | null;
  confidence: number | null;
  needsReview: boolean;
  reviewReason: string | null;
  lastDetectedAt: string | null;
  /** Số sự kiện email đang làm bằng chứng. */
  evidenceCount: number;
}

// ─────────────── Subca Inbox ───────────────

export interface InboxItemDto {
  id: string;
  kind: InboxItemKind;
  status: InboxItemStatus;
  title: string;
  body: string;
  subscriptionId: string | null;
  service: ServiceSummaryDto | null;
  /** Nhãn các nút trả lời, theo đúng thứ tự hiển thị. */
  actions: { key: string; label: string; tone: 'primary' | 'default' | 'danger' }[];
  createdAt: string;
}

export interface InboxDto {
  items: InboxItemDto[];
  openCount: number;
}

export const ResolveInboxItemSchema = z.object({
  action: z.enum([
    'CONFIRM_ACTIVE',
    'MARK_CANCELLED',
    'KEEP',
    'REVIEW_LATER',
    'ACKNOWLEDGE',
    'DISMISS',
  ]),
});
export type ResolveInboxItem = z.infer<typeof ResolveInboxItemSchema>;

// ─────────────── Kết quả quét lần đầu ───────────────

export interface DiscoverySummaryDto {
  /** ID của lượt quét mà các số liệu/trạng thái này thuộc về. */
  runId: string | null;
  /** Đang quét hay đã xong. */
  status: EmailSyncStatus | 'IDLE';
  scannedCount: number;
  candidateCount: number;
  detected: number;
  active: number;
  trial: number;
  needsReview: number;
  cancelled: number;
  openInboxCount: number;
}
