import type { EmailCandidate } from '../integrations/mail/mail-provider.js';
import { merchantByDomain } from './merchants.js';

/**
 * Lọc ứng viên: chọn ra email *có khả năng* liên quan subscription trước khi parse.
 * Mục đích là rẻ và rộng — parser mới là nơi quyết định chính xác.
 */

/** Từ khóa tiếng Anh và tiếng Việt hay gặp trong email hóa đơn / gia hạn. */
const KEYWORDS = [
  'subscription',
  'subscribe',
  'renew',
  'renewal',
  'receipt',
  'invoice',
  'billing',
  'bill',
  'payment',
  'charged',
  'charge',
  'membership',
  'trial',
  'free trial',
  'auto-renew',
  'auto renew',
  'cancelled',
  'canceled',
  'cancellation',
  'price change',
  'price increase',
  'payment failed',
  'payment declined',
  'your plan',
  'plan change',
  'order confirmation',
  // Tiếng Việt
  'gia hạn',
  'hóa đơn',
  'hoá đơn',
  'thanh toán',
  'biên nhận',
  'đăng ký',
  'dùng thử',
  'hủy gói',
  'huỷ gói',
  'gói cước',
  'đã bị trừ',
  'thất bại',
];

/** Email quảng cáo/thông báo chung — loại sớm để đỡ tốn parser. */
const NEGATIVE_HINTS = [
  'unsubscribe from this newsletter',
  'newsletter',
  'webinar',
  'khuyến mãi',
  'ưu đãi đặc biệt',
  'giảm giá',
];

export interface CandidateVerdict {
  isCandidate: boolean;
  /** Lý do nhận (để gỡ lỗi và thống kê). */
  reason: 'merchant-domain' | 'keyword' | 'none';
  /** Điểm thô 0–100, dùng làm một phần của confidence. */
  score: number;
}

export function classifyCandidate(email: EmailCandidate): CandidateVerdict {
  const merchant = merchantByDomain(email.senderDomain);
  const haystack =
    `${email.subject}\n${email.textContent.slice(0, 4000)}`.toLowerCase();
  const keywordHits = KEYWORDS.filter((keyword) =>
    haystack.includes(keyword),
  ).length;
  const negative = NEGATIVE_HINTS.some((hint) => haystack.includes(hint));

  // Email của merchant đã biết: nhận ngay cả khi từ khóa ít, nhưng vẫn cần ít nhất 1 dấu hiệu
  if (merchant && keywordHits > 0) {
    return {
      isCandidate: true,
      reason: 'merchant-domain',
      score: Math.min(60 + keywordHits * 8, 95),
    };
  }
  if (keywordHits >= 2 && !negative) {
    return {
      isCandidate: true,
      reason: 'keyword',
      score: Math.min(30 + keywordHits * 8, 80),
    };
  }
  return { isCandidate: false, reason: 'none', score: keywordHits * 5 };
}
