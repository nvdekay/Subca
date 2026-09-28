import { Logger } from '@nestjs/common';
import {
  htmlToText,
  parseSenderEmail,
  senderDomainOf,
  type EmailCandidate,
  type ListMessagesOptions,
  type ListMessagesResult,
  type MailAccountTokens,
  type MailProvider,
} from './mail-provider.js';

const OAUTH_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const OAUTH_REVOKE = 'https://oauth2.googleapis.com/revoke';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
/** Chỉ xin quyền đọc thư và biết địa chỉ hộp thư — nguyên tắc ít quyền nhất. */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}
interface GmailMessage extends GmailPart {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}

/** Adapter Gmail. Chỉ nói chuyện với Google; phần còn lại của hệ thống không biết Gmail là gì. */
export class GmailProvider implements MailProvider {
  readonly name = 'Gmail';
  private readonly logger = new Logger(GmailProvider.name);

  constructor(
    private readonly clientId: string | undefined,
    private readonly clientSecret: string | undefined,
    private readonly redirectUri: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.requireClientId(),
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      // Bắt buộc để nhận refresh token, kể cả khi người dùng đã đồng ý trước đó
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${OAUTH_AUTHORIZE}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<MailAccountTokens> {
    const token = await this.postForm(OAUTH_TOKEN, {
      code,
      client_id: this.requireClientId(),
      client_secret: this.clientSecret!,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    const refreshToken = token['refresh_token'];
    const accessToken = token['access_token'];
    if (typeof refreshToken !== 'string' || typeof accessToken !== 'string') {
      throw new Error(
        'Google không trả về refresh token — thử lại và chọn "Cho phép" toàn bộ.',
      );
    }
    const profile = (await this.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      accessToken,
    )) as {
      email?: string;
    };
    if (!profile.email)
      throw new Error('Không đọc được địa chỉ hộp thư từ Google');
    return {
      email: profile.email.toLowerCase(),
      refreshToken,
      scope: typeof token['scope'] === 'string' ? token['scope'] : GMAIL_SCOPES,
    };
  }

  async listMessages(
    refreshToken: string,
    options: ListMessagesOptions,
  ): Promise<ListMessagesResult> {
    const accessToken = await this.accessToken(refreshToken);
    const params = new URLSearchParams({
      maxResults: String(Math.min(options.limit ?? 50, 100)),
      // Bỏ thư rác và thùng rác; chỉ quan tâm hộp thư thật
      q: buildQuery(options.since),
    });
    if (options.pageToken) params.set('pageToken', options.pageToken);

    const list = (await this.get(
      `${GMAIL_API}/messages?${params.toString()}`,
      accessToken,
    )) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    const ids = list.messages?.map((m) => m.id) ?? [];

    const messages: EmailCandidate[] = [];
    for (const id of ids) {
      try {
        const message = (await this.get(
          `${GMAIL_API}/messages/${id}?format=full`,
          accessToken,
        )) as GmailMessage;
        messages.push(toCandidate(message));
      } catch (error) {
        // Một thư hỏng không được làm chết cả lượt quét
        this.logger.warn(`Bỏ qua email ${id}: ${message(error)}`);
      }
    }
    return { messages, nextPageToken: list.nextPageToken ?? null };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.fetchFn(OAUTH_REVOKE, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }).toString(),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  }

  /** Access token sống ~1 giờ nên lấy mới mỗi lượt quét, không cần lưu. */
  private async accessToken(refreshToken: string): Promise<string> {
    const token = await this.postForm(OAUTH_TOKEN, {
      refresh_token: refreshToken,
      client_id: this.requireClientId(),
      client_secret: this.clientSecret!,
      grant_type: 'refresh_token',
    });
    if (typeof token['access_token'] !== 'string') {
      throw new Error(
        'Không làm mới được quyền truy cập hộp thư (token đã bị thu hồi?)',
      );
    }
    return token['access_token'];
  }

  private async postForm(
    url: string,
    form: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!res.ok) {
      throw new Error(
        `Google OAuth lỗi ${res.status}: ${String(body?.['error'] ?? '')}`,
      );
    }
    return body ?? {};
  }

  private async get(url: string, accessToken: string): Promise<unknown> {
    const res = await this.fetchFn(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gmail API lỗi ${res.status}`);
    return res.json();
  }

  private requireClientId(): string {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
    }
    return this.clientId;
  }
}

/** Câu truy vấn Gmail: bỏ thư rác/quảng cáo hiển nhiên, chỉ lấy thư mới hơn `since`. */
function buildQuery(since?: Date): string {
  const parts = ['-in:spam', '-in:trash', '-category:social'];
  if (since) parts.push(`after:${Math.floor(since.getTime() / 1000)}`);
  return parts.join(' ');
}

export function toCandidate(message: GmailMessage): EmailCandidate {
  const headers = message.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name)?.value ?? '';
  const from = header('from');
  const senderEmail = parseSenderEmail(from);
  const receivedAt = message.internalDate
    ? new Date(Number(message.internalDate))
    : new Date(header('date') || Date.now());

  return {
    messageId: message.id,
    threadId: message.threadId ?? null,
    sender: from,
    senderEmail,
    senderDomain: senderDomainOf(senderEmail),
    subject: header('subject'),
    receivedAt,
    textContent: extractText(message.payload ?? message),
  };
}

/** Ưu tiên phần text/plain, không có thì đổi HTML sang text. Cắt bớt cho khỏi phình bộ nhớ. */
function extractText(part: GmailPart): string {
  const plain = findPart(part, 'text/plain');
  if (plain) return decode(plain).slice(0, 20_000);
  const html = findPart(part, 'text/html');
  if (html) return htmlToText(decode(html)).slice(0, 20_000);
  return '';
}

function findPart(part: GmailPart, mimeType: string): GmailPart | null {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

const decode = (part: GmailPart): string =>
  part.body?.data
    ? Buffer.from(part.body.data, 'base64url').toString('utf8')
    : '';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
