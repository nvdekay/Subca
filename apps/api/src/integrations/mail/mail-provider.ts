/**
 * Cổng kết nối hộp thư. Mọi thứ phía dưới (lọc ứng viên, parser, đối soát) chỉ làm việc với
 * `EmailCandidate` — đổi Gmail sang nhà cung cấp khác chỉ cần viết adapter mới.
 */

/** Một email đã chuẩn hóa, không còn dấu vết định dạng của Gmail. */
export interface EmailCandidate {
  messageId: string;
  threadId: string | null;
  /** Nguyên văn header From, VD `Netflix <info@account.netflix.com>`. */
  sender: string;
  senderEmail: string;
  senderDomain: string;
  subject: string;
  receivedAt: Date;
  /** Nội dung dạng text (HTML đã được gỡ thẻ). */
  textContent: string;
}

export interface ListMessagesOptions {
  /** Chỉ lấy email nhận sau mốc này. */
  since?: Date;
  /** Số email tối đa cần lấy trong lượt này. */
  limit?: number;
  /** Trang tiếp theo của lần gọi trước. */
  pageToken?: string;
}

export interface ListMessagesResult {
  messages: EmailCandidate[];
  nextPageToken: string | null;
}

/** Thông tin tài khoản sau khi người dùng đồng ý. */
export interface MailAccountTokens {
  email: string;
  refreshToken: string;
  scope: string;
}

export interface MailProvider {
  /** Tên hiển thị của nhà cung cấp (để log). */
  readonly name: string;
  /** Máy chủ đã có cấu hình OAuth chưa. */
  readonly configured: boolean;
  /** URL trang đồng ý; `state` để nhận lại đúng người dùng ở bước callback. */
  authorizeUrl(state: string): string;
  /** Đổi mã uỷ quyền lấy refresh token + email của hộp thư. */
  exchangeCode(code: string): Promise<MailAccountTokens>;
  /** Lấy danh sách email đã chuẩn hóa. */
  listMessages(
    refreshToken: string,
    options: ListMessagesOptions,
  ): Promise<ListMessagesResult>;
  /** Thu hồi quyền truy cập khi người dùng ngắt kết nối. */
  revoke(refreshToken: string): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

/** Gỡ thẻ HTML, giải mã vài entity hay gặp và gom khoảng trắng — đủ cho parser đọc. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** `Netflix <info@account.netflix.com>` → `info@account.netflix.com`. */
export function parseSenderEmail(from: string): string {
  const angle = /<([^>]+)>/.exec(from);
  return (angle?.[1] ?? from).trim().toLowerCase();
}

/** Lấy tên miền gốc: `info@account.netflix.com` → `netflix.com` (giữ nguyên miền 2 cấp như co.uk). */
export function senderDomainOf(email: string): string {
  const domain = email.split('@').pop()?.toLowerCase() ?? '';
  const parts = domain.split('.').filter(Boolean);
  if (parts.length <= 2) return domain;
  const twoLevelTlds = ['co.uk', 'com.vn', 'com.au', 'co.jp', 'com.br'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoLevelTlds.includes(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}
