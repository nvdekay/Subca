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
  /**
   * Tên miền người gửi (khớp cả tên miền con: `account.netflix.com` → `netflix.com`).
   * Để rỗng cho dịch vụ **chỉ xuất hiện trong hóa đơn gộp** (Apple TV+, Kindle Unlimited…):
   * chúng không tự gửi mail, chỉ hiện thành một dòng trong biên nhận của Apple / Amazon.
   */
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

const MONTHLY = { intervalUnit: 'MONTH', intervalCount: 1 } as const;

export const MERCHANTS: readonly MerchantRule[] = [
  // ---- Xem phim / truyền hình ----
  {
    key: 'netflix',
    name: 'Netflix',
    domains: ['netflix.com'],
    serviceSlug: 'netflix',
    defaultInterval: MONTHLY,
  },
  {
    key: 'youtube',
    name: 'YouTube Premium',
    domains: ['youtube.com'],
    aliases: ['YouTube Premium'],
    serviceSlug: 'youtube-premium',
    defaultInterval: MONTHLY,
  },
  {
    key: 'youtube-music',
    name: 'YouTube Music',
    domains: [],
    aliases: ['YouTube Music'],
    serviceSlug: 'youtube-music',
    defaultInterval: MONTHLY,
  },
  {
    key: 'disney',
    name: 'Disney+',
    domains: ['disneyplus.com'],
    aliases: ['Disney+', 'Disney Plus'],
    defaultInterval: MONTHLY,
  },
  {
    key: 'max',
    name: 'Max',
    domains: ['max.com', 'hbomax.com'],
    aliases: ['HBO Max'],
    serviceSlug: 'max',
    defaultInterval: MONTHLY,
  },
  {
    key: 'appletv',
    name: 'Apple TV+',
    domains: [],
    aliases: ['Apple TV+', 'Apple TV Plus'],
    serviceSlug: 'apple-tv-plus',
    defaultInterval: MONTHLY,
  },
  {
    key: 'primevideo',
    name: 'Prime Video',
    domains: ['primevideo.com'],
    aliases: ['Prime Video', 'Amazon Prime'],
    serviceSlug: 'prime-video',
    defaultInterval: MONTHLY,
  },
  {
    key: 'vieon',
    name: 'VieON',
    domains: ['vieon.vn'],
    serviceSlug: 'vieon',
    defaultInterval: MONTHLY,
  },
  {
    key: 'fptplay',
    name: 'FPT Play',
    domains: ['fptplay.vn'],
    serviceSlug: 'fpt-play',
    defaultInterval: MONTHLY,
  },
  {
    key: 'galaxyplay',
    name: 'Galaxy Play',
    domains: ['galaxyplay.vn'],
    serviceSlug: 'galaxy-play',
    defaultInterval: MONTHLY,
  },
  {
    key: 'tv360',
    name: 'TV360',
    domains: ['tv360.vn'],
    serviceSlug: 'tv360',
    defaultInterval: MONTHLY,
  },

  // ---- Nghe nhạc ----
  {
    key: 'spotify',
    name: 'Spotify',
    domains: ['spotify.com'],
    serviceSlug: 'spotify',
    defaultInterval: MONTHLY,
  },
  {
    key: 'apple-music',
    name: 'Apple Music',
    domains: [],
    aliases: ['Apple Music'],
    serviceSlug: 'apple-music',
    defaultInterval: MONTHLY,
  },
  {
    key: 'zingmp3',
    name: 'Zing MP3',
    domains: ['zing.vn', 'zingmp3.vn'],
    serviceSlug: 'zing-mp3',
    defaultInterval: MONTHLY,
  },
  {
    key: 'nhaccuatui',
    name: 'NhacCuaTui',
    domains: ['nhaccuatui.com'],
    serviceSlug: 'nhaccuatui',
    defaultInterval: MONTHLY,
  },

  // ---- AI & công việc ----
  {
    key: 'openai',
    name: 'OpenAI',
    domains: ['openai.com', 'chatgpt.com'],
    aliases: ['ChatGPT Plus', 'ChatGPT Pro', 'ChatGPT', 'OpenAI'],
    serviceSlug: 'chatgpt-plus',
    defaultInterval: MONTHLY,
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    domains: ['anthropic.com', 'claude.ai'],
    aliases: ['Claude Pro', 'Claude Max', 'Claude'],
    serviceSlug: 'claude',
    defaultInterval: MONTHLY,
  },
  {
    key: 'google-ai',
    name: 'Google AI',
    domains: [],
    aliases: ['Google AI Pro', 'Google AI Premium', 'Gemini Advanced'],
    serviceSlug: 'google-ai',
    defaultInterval: MONTHLY,
  },
  {
    key: 'github-copilot',
    name: 'GitHub Copilot',
    domains: [],
    aliases: ['GitHub Copilot'],
    serviceSlug: 'github-copilot',
    defaultInterval: MONTHLY,
  },
  {
    key: 'perplexity',
    name: 'Perplexity',
    domains: ['perplexity.ai'],
    aliases: ['Perplexity Pro'],
    defaultInterval: MONTHLY,
  },
  {
    key: 'cursor',
    name: 'Cursor',
    domains: ['cursor.com', 'cursor.sh'],
    defaultInterval: MONTHLY,
  },
  {
    key: 'midjourney',
    name: 'Midjourney',
    domains: ['midjourney.com'],
    defaultInterval: MONTHLY,
  },
  {
    key: 'notion',
    name: 'Notion',
    domains: ['notion.so', 'makenotion.com'],
    serviceSlug: 'notion',
  },
  { key: 'figma', name: 'Figma', domains: ['figma.com'], serviceSlug: 'figma' },
  {
    key: 'canva',
    name: 'Canva',
    domains: ['canva.com'],
    aliases: ['Canva Pro'],
    serviceSlug: 'canva-pro',
  },
  {
    key: 'adobe',
    name: 'Adobe',
    domains: ['adobe.com'],
    aliases: ['Creative Cloud'],
    serviceSlug: 'adobe-creative-cloud',
  },
  {
    key: 'adobe-lightroom',
    name: 'Adobe Lightroom',
    domains: [],
    aliases: ['Lightroom'],
    serviceSlug: 'adobe-lightroom',
  },
  {
    key: 'capcut',
    name: 'CapCut',
    domains: ['capcut.com'],
    aliases: ['CapCut Pro'],
    serviceSlug: 'capcut-pro',
  },
  {
    key: 'microsoft',
    name: 'Microsoft',
    domains: ['microsoft.com', 'microsoftonline.com'],
    aliases: ['Microsoft 365', 'Office 365'],
    serviceSlug: 'microsoft-365',
  },
  { key: 'github', name: 'GitHub', domains: ['github.com'] },
  { key: 'zoom', name: 'Zoom', domains: ['zoom.us'], serviceSlug: 'zoom' },
  { key: 'slack', name: 'Slack', domains: ['slack.com'], serviceSlug: 'slack' },
  {
    key: 'grammarly',
    name: 'Grammarly',
    domains: ['grammarly.com'],
    serviceSlug: 'grammarly',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    domains: ['linkedin.com'],
    aliases: ['LinkedIn Premium'],
    serviceSlug: 'linkedin-premium',
  },
  {
    key: 'medium',
    name: 'Medium',
    domains: ['medium.com'],
    serviceSlug: 'medium',
  },

  // ---- Lưu trữ ----
  {
    key: 'icloud',
    name: 'iCloud+',
    domains: [],
    aliases: ['iCloud+', 'iCloud'],
    serviceSlug: 'icloud-plus',
    defaultInterval: MONTHLY,
  },
  {
    key: 'google-one',
    name: 'Google One',
    domains: [],
    aliases: ['Google One'],
    serviceSlug: 'google-one',
    defaultInterval: MONTHLY,
  },
  {
    key: 'dropbox',
    name: 'Dropbox',
    domains: ['dropbox.com'],
    serviceSlug: 'dropbox',
  },
  {
    key: 'onedrive',
    name: 'OneDrive',
    domains: [],
    aliases: ['OneDrive'],
    serviceSlug: 'onedrive',
  },

  // ---- Học tập & sức khỏe ----
  {
    key: 'duolingo',
    name: 'Duolingo',
    domains: ['duolingo.com'],
    aliases: ['Duolingo Super', 'Super Duolingo'],
    serviceSlug: 'duolingo',
  },
  {
    key: 'elsa',
    name: 'ELSA Speak',
    domains: ['elsaspeak.com', 'elsanow.co'],
    aliases: ['ELSA Speak', 'ELSA Premium'],
    serviceSlug: 'elsa-speak',
  },
  {
    key: 'coursera',
    name: 'Coursera',
    domains: ['coursera.org'],
    aliases: ['Coursera Plus'],
    serviceSlug: 'coursera-plus',
  },
  {
    key: 'strava',
    name: 'Strava',
    domains: ['strava.com'],
    serviceSlug: 'strava',
  },
  {
    key: 'kindle',
    name: 'Kindle Unlimited',
    domains: [],
    aliases: ['Kindle Unlimited'],
    serviceSlug: 'kindle-unlimited',
  },

  // ---- Tiện ích, hosting ----
  {
    key: '1password',
    name: '1Password',
    domains: ['1password.com'],
    serviceSlug: '1password',
  },
  {
    key: 'bitwarden',
    name: 'Bitwarden',
    domains: ['bitwarden.com'],
    serviceSlug: 'bitwarden',
  },
  {
    key: 'nordvpn',
    name: 'NordVPN',
    domains: ['nordvpn.com'],
    serviceSlug: 'nordvpn',
  },
  {
    key: 'expressvpn',
    name: 'ExpressVPN',
    domains: ['expressvpn.com'],
    serviceSlug: 'expressvpn',
  },
  {
    key: 'vercel',
    name: 'Vercel',
    domains: ['vercel.com'],
    serviceSlug: 'vercel',
  },
  {
    key: 'hostinger',
    name: 'Hostinger',
    domains: ['hostinger.com', 'hostinger.vn'],
    serviceSlug: 'hostinger',
  },
  {
    key: 'godaddy',
    name: 'GoDaddy',
    domains: ['godaddy.com'],
    serviceSlug: 'godaddy',
  },
  {
    key: 'namecheap',
    name: 'Namecheap',
    domains: ['namecheap.com'],
    serviceSlug: 'namecheap',
  },

  // ---- Game ----
  {
    key: 'playstation',
    name: 'PlayStation Plus',
    domains: ['playstation.com', 'sony.com'],
    aliases: ['PlayStation Plus', 'PS Plus'],
    serviceSlug: 'playstation-plus',
  },
  {
    key: 'xbox',
    name: 'Xbox Game Pass',
    domains: ['xbox.com'],
    aliases: ['Game Pass', 'Xbox Game Pass'],
    serviceSlug: 'xbox-game-pass',
  },
  {
    key: 'nintendo',
    name: 'Nintendo Switch Online',
    domains: ['nintendo.com', 'nintendo.net'],
    aliases: ['Nintendo Switch Online'],
    serviceSlug: 'nintendo-switch-online',
  },
  {
    key: 'apple-arcade',
    name: 'Apple Arcade',
    domains: [],
    aliases: ['Apple Arcade'],
    serviceSlug: 'apple-arcade',
  },

  // ---- Mạng xã hội / khác ----
  {
    key: 'discord',
    name: 'Discord',
    domains: ['discord.com'],
    aliases: ['Discord Nitro', 'Nitro'],
    defaultInterval: MONTHLY,
  },
  {
    key: 'telegram',
    name: 'Telegram Premium',
    domains: ['telegram.org'],
    aliases: ['Telegram Premium'],
    defaultInterval: MONTHLY,
  },
  {
    key: 'x',
    name: 'X Premium',
    domains: ['x.com', 'twitter.com'],
    aliases: ['X Premium', 'Twitter Blue'],
    defaultInterval: MONTHLY,
  },

  // ---- Cửa hàng / cổng thanh toán: hóa đơn gộp nhiều dịch vụ ----
  {
    key: 'apple',
    name: 'Apple',
    domains: ['apple.com', 'itunes.com'],
    aliases: ['App Store', 'Apple One'],
    aggregator: true,
  },
  {
    key: 'google',
    name: 'Google',
    domains: ['google.com', 'googlemail.com', 'googleplay.com'],
    aliases: ['Google Play', 'Google Workspace'],
    aggregator: true,
  },
  {
    key: 'amazon',
    name: 'Amazon',
    domains: ['amazon.com'],
    aggregator: true,
  },
  { key: 'paypal', name: 'PayPal', domains: ['paypal.com'], aggregator: true },
  { key: 'stripe', name: 'Stripe', domains: ['stripe.com'], aggregator: true },
  { key: 'momo', name: 'MoMo', domains: ['momo.vn'], aggregator: true },
  {
    key: 'zalopay',
    name: 'ZaloPay',
    domains: ['zalopay.vn'],
    aggregator: true,
  },
  { key: 'vnpay', name: 'VNPAY', domains: ['vnpay.vn'], aggregator: true },
];

const BY_DOMAIN = new Map<string, MerchantRule>();
for (const merchant of MERCHANTS) {
  for (const domain of merchant.domains) BY_DOMAIN.set(domain, merchant);
}

export const merchantByDomain = (domain: string): MerchantRule | undefined =>
  BY_DOMAIN.get(domain.toLowerCase());

export const merchantByKey = (key: string): MerchantRule | undefined =>
  MERCHANTS.find((m) => m.key === key);

/**
 * Tìm merchant theo tên xuất hiện trong text (dùng cho hóa đơn gộp của Apple / Google Play).
 * Chọn tên **dài nhất** khớp được: "YouTube Music" phải thắng "YouTube Premium",
 * "Apple TV+" phải thắng "Apple".
 */
export function merchantByText(text: string): MerchantRule | undefined {
  const haystack = text.toLowerCase();
  let best: { merchant: MerchantRule; length: number } | undefined;
  for (const merchant of MERCHANTS) {
    if (merchant.aggregator) continue;
    for (const name of [merchant.name, ...(merchant.aliases ?? [])]) {
      const needle = name.toLowerCase();
      if (!haystack.includes(needle)) continue;
      if (!best || needle.length > best.length)
        best = { merchant, length: needle.length };
    }
  }
  return best?.merchant;
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

/**
 * Tên dịch vụ gọn từ một dòng hóa đơn: bỏ phần trong ngoặc và cụm chu kỳ ở đuôi.
 * "Bear Pro (Yearly)" → "Bear Pro". Cần thiết để tháng sau hóa đơn ghi hơi khác
 * vẫn ra cùng một merchant, không tạo hai subscription.
 */
export function merchantNameFromLabel(label: string): string {
  return (
    label
      .replace(/\([^)]*\)/g, ' ')
      .replace(
        /\b(monthly|yearly|annual(ly)?|quarterly|weekly|per (month|year)|hằng tháng|hàng tháng|mỗi tháng|hằng năm|hàng năm|mỗi năm)\b/gi,
        ' ',
      )
      .replace(/[\s.·…\-–—:|]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || label.trim()
  );
}

/**
 * Khóa merchant cho một dòng trong hóa đơn gộp mà danh mục chưa có:
 * "Bear Pro (Yearly)" → `bear-pro`. Giữ chữ cái tiếng Việt bỏ dấu ra ngoài — chỉ cần ổn định.
 */
export function merchantKeyFromLabel(label: string): string {
  return (
    merchantNameFromLabel(label)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'unknown'
  );
}
