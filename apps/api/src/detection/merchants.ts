import type { IntervalUnit } from '@subca/shared';

/**
 * Danh mục merchant để nhận ra "email này của dịch vụ nào".
 *
 * Thêm dịch vụ mới = thêm một dòng ở đây; không phải sửa parser. Khóa `key` là danh tính
 * chuẩn hóa dùng xuyên suốt (gom mọi email của OpenAI / ChatGPT về cùng `openai`).
 */
export interface MerchantRule {
  key: string;
  name: string;
  /** Tên miền người gửi (khớp cả tên miền con: `account.netflix.com` → `netflix.com`). */
  domains: string[];
  /** Tên khác xuất hiện trong tiêu đề / nội dung. */
  aliases?: string[];
  /** Slug trong bảng `services` để lấy logo và hướng dẫn hủy. */
  serviceSlug?: string;
  /** Chu kỳ mặc định khi email không nói rõ. */
  defaultInterval?: { intervalUnit: IntervalUnit; intervalCount: number };
  /**
   * Cửa hàng gộp nhiều dịch vụ vào một hóa đơn (Apple, Google Play) — email của họ
   * cần đọc tên dịch vụ bên trong, không được coi cả hóa đơn là một subscription.
   */
  aggregator?: boolean;
}

export const MERCHANTS: readonly MerchantRule[] = [
  {
    key: 'netflix',
    name: 'Netflix',
    domains: ['netflix.com'],
    serviceSlug: 'netflix',
    defaultInterval: { intervalUnit: 'MONTH', intervalCount: 1 },
  },
  {
    key: 'spotify',
    name: 'Spotify',
    domains: ['spotify.com'],
    serviceSlug: 'spotify',
    defaultInterval: { intervalUnit: 'MONTH', intervalCount: 1 },
  },
  {
    key: 'openai',
    name: 'OpenAI',
    domains: ['openai.com', 'chatgpt.com'],
    aliases: ['ChatGPT', 'ChatGPT Plus', 'OpenAI'],
    serviceSlug: 'chatgpt',
    defaultInterval: { intervalUnit: 'MONTH', intervalCount: 1 },
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    domains: ['anthropic.com', 'claude.ai'],
    aliases: ['Claude', 'Claude Pro'],
    serviceSlug: 'claude',
    defaultInterval: { intervalUnit: 'MONTH', intervalCount: 1 },
  },
  {
    key: 'youtube',
    name: 'YouTube Premium',
    domains: ['youtube.com'],
    aliases: ['YouTube Premium', 'YouTube Music'],
    serviceSlug: 'youtube-premium',
    defaultInterval: { intervalUnit: 'MONTH', intervalCount: 1 },
  },
  {
    key: 'google',
    name: 'Google',
    domains: ['google.com', 'googlemail.com'],
    aliases: ['Google One', 'Google Workspace'],
    serviceSlug: 'google-one',
    aggregator: true,
  },
  {
    key: 'apple',
    name: 'Apple',
    domains: ['apple.com', 'itunes.com'],
    aliases: ['App Store', 'iCloud', 'Apple One'],
    serviceSlug: 'icloud',
    aggregator: true,
  },
  {
    key: 'microsoft',
    name: 'Microsoft',
    domains: ['microsoft.com', 'microsoftonline.com'],
    aliases: ['Microsoft 365', 'Office 365'],
    serviceSlug: 'microsoft-365',
  },
  {
    key: 'adobe',
    name: 'Adobe',
    domains: ['adobe.com'],
    serviceSlug: 'adobe-creative-cloud',
  },
  { key: 'canva', name: 'Canva', domains: ['canva.com'], serviceSlug: 'canva' },
  {
    key: 'notion',
    name: 'Notion',
    domains: ['notion.so', 'makenotion.com'],
    serviceSlug: 'notion',
  },
  { key: 'figma', name: 'Figma', domains: ['figma.com'], serviceSlug: 'figma' },
  {
    key: 'github',
    name: 'GitHub',
    domains: ['github.com'],
    serviceSlug: 'github',
  },
  {
    key: 'dropbox',
    name: 'Dropbox',
    domains: ['dropbox.com'],
    serviceSlug: 'dropbox',
  },
  {
    key: 'amazon',
    name: 'Amazon',
    domains: ['amazon.com'],
    aliases: ['Prime Video', 'Amazon Prime'],
  },
  {
    key: 'disney',
    name: 'Disney+',
    domains: ['disneyplus.com'],
    serviceSlug: 'disney-plus',
  },
  {
    key: 'duolingo',
    name: 'Duolingo',
    domains: ['duolingo.com'],
    serviceSlug: 'duolingo',
  },
  { key: 'grammarly', name: 'Grammarly', domains: ['grammarly.com'] },
  { key: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com'] },
  { key: 'zoom', name: 'Zoom', domains: ['zoom.us'], serviceSlug: 'zoom' },
  { key: 'slack', name: 'Slack', domains: ['slack.com'] },
  { key: 'vieon', name: 'VieON', domains: ['vieon.vn'], serviceSlug: 'vieon' },
  {
    key: 'fptplay',
    name: 'FPT Play',
    domains: ['fptplay.vn'],
    serviceSlug: 'fpt-play',
  },
  { key: 'galaxyplay', name: 'Galaxy Play', domains: ['galaxyplay.vn'] },
  {
    key: 'zingmp3',
    name: 'Zing MP3',
    domains: ['zing.vn', 'zingmp3.vn'],
    serviceSlug: 'zing-mp3',
  },
  { key: 'spiderum', name: 'Spiderum', domains: ['spiderum.com'] },
  { key: 'paypal', name: 'PayPal', domains: ['paypal.com'], aggregator: true },
  { key: 'stripe', name: 'Stripe', domains: ['stripe.com'], aggregator: true },
];

const BY_DOMAIN = new Map<string, MerchantRule>();
for (const merchant of MERCHANTS) {
  for (const domain of merchant.domains) BY_DOMAIN.set(domain, merchant);
}

export const merchantByDomain = (domain: string): MerchantRule | undefined =>
  BY_DOMAIN.get(domain.toLowerCase());

export const merchantByKey = (key: string): MerchantRule | undefined =>
  MERCHANTS.find((m) => m.key === key);

/** Tìm merchant theo tên xuất hiện trong text (dùng cho hóa đơn gộp của Apple / Google Play). */
export function merchantByText(text: string): MerchantRule | undefined {
  const haystack = text.toLowerCase();
  return MERCHANTS.filter((m) => !m.aggregator).find((m) =>
    [m.name, ...(m.aliases ?? [])].some((name) =>
      haystack.includes(name.toLowerCase()),
    ),
  );
}

/**
 * Khóa merchant cho dịch vụ chưa có trong danh mục: lấy từ tên miền người gửi.
 * `billing.somerandomapp.io` → `somerandomapp`.
 */
export function merchantKeyFromDomain(domain: string): string {
  return (
    (domain.split('.')[0] ?? domain)
      .replace(/[^a-z0-9]+/gi, '')
      .toLowerCase() || 'unknown'
  );
}

/** Tên hiển thị tạm cho merchant lạ: `somerandomapp` → `Somerandomapp`. */
export function merchantNameFromDomain(domain: string): string {
  const key = merchantKeyFromDomain(domain);
  return key.charAt(0).toUpperCase() + key.slice(1);
}
