/**
 * Seed dữ liệu nền: danh mục hệ thống + thư viện dịch vụ + feature flag vận hành.
 *
 * Chạy: pnpm --filter @subca/api prisma:seed
 *
 * - Chạy lại bao nhiêu lần cũng được (idempotent): danh mục dùng ID cố định sinh từ slug,
 *   dịch vụ upsert theo slug, gói upsert theo (dịch vụ, tên gói, khu vực).
 * - GIÁ GÓI LÀ GIÁ THAM KHẢO, cần đối chiếu lại với trang chính thức trước khi ra mắt.
 *   Sau khi ra mắt, giá được cập nhật qua luồng "Người dùng báo đổi giá → admin duyệt".
 * - logoKey là slug của Simple Icons; null = app hiển thị chữ viết tắt trên nền brandColor.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type IntervalUnit,
} from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  }),
});

/** UUID v5 (RFC 4122) từ một chuỗi: cùng đầu vào → cùng UUID. */
function uuidV5(
  name: string,
  namespace = '6f1c2a4e-5b0d-4c8e-9a3f-7d2e1b0c9a8f',
): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(name, 'utf8')]))
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const categoryId = (slug: string) => uuidV5(`category:${slug}`);

// ─────────────────────────────────────────────
// Danh mục hệ thống
// ─────────────────────────────────────────────

const CATEGORIES = [
  { slug: 'giai-tri', name: 'Giải trí', icon: 'tv', color: '#1996B8' },
  { slug: 'am-nhac', name: 'Âm nhạc', icon: 'music', color: '#D0578C' },
  {
    slug: 'ai-cong-viec',
    name: 'AI & Công việc',
    icon: 'briefcase',
    color: '#E07A4A',
  },
  { slug: 'luu-tru', name: 'Lưu trữ đám mây', icon: 'cloud', color: '#7B63C9' },
  {
    slug: 'hoc-tap',
    name: 'Học tập',
    icon: 'graduation-cap',
    color: '#3E8E6A',
  },
  {
    slug: 'suc-khoe',
    name: 'Sức khỏe & Thể thao',
    icon: 'heart-pulse',
    color: '#C99A2E',
  },
  {
    slug: 'web-hosting',
    name: 'Web & Hosting',
    icon: 'globe',
    color: '#5A6B8C',
  },
  {
    slug: 'tien-ich',
    name: 'Tiện ích & Bảo mật',
    icon: 'shield',
    color: '#4F6655',
  },
  { slug: 'game', name: 'Game', icon: 'gamepad', color: '#8A5CC7' },
  {
    slug: 'doc-tin-tuc',
    name: 'Đọc & Tin tức',
    icon: 'book-open',
    color: '#9A6212',
  },
  { slug: 'khac', name: 'Khác', icon: 'more-horizontal', color: '#657166' },
] as const;

type CategorySlug = (typeof CATEGORIES)[number]['slug'];

// ─────────────────────────────────────────────
// Thư viện dịch vụ (đợt đầu)
// ─────────────────────────────────────────────

interface PlanSeed {
  name: string;
  /** Đơn vị nhỏ nhất: VND = đồng, USD = cent. */
  amountMinor: number;
  currency: 'VND' | 'USD';
  unit?: IntervalUnit;
  count?: number;
  isFamily?: boolean;
  maxMembers?: number;
}

interface ServiceSeed {
  slug: string;
  name: string;
  category: CategorySlug;
  logoKey?: string;
  brandColor: string;
  website?: string;
  cancelUrl?: string;
  plans?: PlanSeed[];
}

const SERVICES: ServiceSeed[] = [
  // Giải trí
  {
    slug: 'netflix',
    name: 'Netflix',
    category: 'giai-tri',
    logoKey: 'netflix',
    brandColor: '#E50914',
    website: 'https://www.netflix.com',
    cancelUrl: 'https://www.netflix.com/cancelplan',
    plans: [
      { name: 'Di động', amountMinor: 70_000, currency: 'VND' },
      { name: 'Cơ bản', amountMinor: 108_000, currency: 'VND' },
      {
        name: 'Tiêu chuẩn',
        amountMinor: 220_000,
        currency: 'VND',
        maxMembers: 2,
      },
      {
        name: 'Cao cấp',
        amountMinor: 260_000,
        currency: 'VND',
        isFamily: true,
        maxMembers: 4,
      },
    ],
  },
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    category: 'giai-tri',
    logoKey: 'youtube',
    brandColor: '#FF0000',
    website: 'https://www.youtube.com/premium',
    cancelUrl: 'https://www.youtube.com/paid_memberships',
    plans: [{ name: 'Cá nhân', amountMinor: 79_000, currency: 'VND' }],
  },
  {
    slug: 'apple-tv-plus',
    name: 'Apple TV+',
    category: 'giai-tri',
    logoKey: 'appletv',
    brandColor: '#000000',
    website: 'https://tv.apple.com',
  },
  {
    slug: 'prime-video',
    name: 'Prime Video',
    category: 'giai-tri',
    logoKey: 'primevideo',
    brandColor: '#1F2E3E',
    website: 'https://www.primevideo.com',
  },
  {
    slug: 'max',
    name: 'Max',
    category: 'giai-tri',
    logoKey: 'max',
    brandColor: '#002BE7',
    website: 'https://www.max.com',
  },
  {
    slug: 'fpt-play',
    name: 'FPT Play',
    category: 'giai-tri',
    brandColor: '#F26F21',
    website: 'https://fptplay.vn',
  },
  {
    slug: 'vieon',
    name: 'VieON',
    category: 'giai-tri',
    brandColor: '#1E1E1E',
    website: 'https://vieon.vn',
  },
  {
    slug: 'galaxy-play',
    name: 'Galaxy Play',
    category: 'giai-tri',
    brandColor: '#6C2BD9',
    website: 'https://galaxyplay.vn',
  },
  {
    slug: 'tv360',
    name: 'TV360',
    category: 'giai-tri',
    brandColor: '#E4002B',
    website: 'https://tv360.vn',
  },

  // Âm nhạc
  {
    slug: 'spotify',
    name: 'Spotify',
    category: 'am-nhac',
    logoKey: 'spotify',
    brandColor: '#1ED760',
    website: 'https://www.spotify.com',
    cancelUrl: 'https://www.spotify.com/account/subscription/',
    plans: [
      { name: 'Premium Cá nhân', amountMinor: 59_000, currency: 'VND' },
      {
        name: 'Premium Gia đình',
        amountMinor: 89_000,
        currency: 'VND',
        isFamily: true,
        maxMembers: 6,
      },
    ],
  },
  {
    slug: 'apple-music',
    name: 'Apple Music',
    category: 'am-nhac',
    logoKey: 'applemusic',
    brandColor: '#FA243C',
    website: 'https://music.apple.com',
  },
  {
    slug: 'youtube-music',
    name: 'YouTube Music',
    category: 'am-nhac',
    logoKey: 'youtubemusic',
    brandColor: '#FF0000',
    website: 'https://music.youtube.com',
  },
  {
    slug: 'zing-mp3',
    name: 'Zing MP3',
    category: 'am-nhac',
    brandColor: '#8D22C3',
    website: 'https://zingmp3.vn',
  },
  {
    slug: 'nhaccuatui',
    name: 'NhacCuaTui',
    category: 'am-nhac',
    brandColor: '#1B8DE3',
    website: 'https://www.nhaccuatui.com',
  },

  // AI & Công việc
  {
    slug: 'chatgpt-plus',
    name: 'ChatGPT',
    category: 'ai-cong-viec',
    logoKey: 'openai',
    brandColor: '#10A37F',
    website: 'https://chatgpt.com',
    plans: [
      { name: 'Plus', amountMinor: 2_000, currency: 'USD' },
      { name: 'Pro', amountMinor: 20_000, currency: 'USD' },
    ],
  },
  {
    slug: 'claude',
    name: 'Claude',
    category: 'ai-cong-viec',
    logoKey: 'claude',
    brandColor: '#D97757',
    website: 'https://claude.ai',
    plans: [{ name: 'Pro', amountMinor: 2_000, currency: 'USD' }],
  },
  {
    slug: 'google-ai',
    name: 'Google AI (Gemini)',
    category: 'ai-cong-viec',
    logoKey: 'googlegemini',
    brandColor: '#8E75B2',
    website: 'https://gemini.google.com',
  },
  {
    slug: 'github-copilot',
    name: 'GitHub Copilot',
    category: 'ai-cong-viec',
    logoKey: 'githubcopilot',
    brandColor: '#000000',
    website: 'https://github.com/features/copilot',
    plans: [{ name: 'Pro', amountMinor: 1_000, currency: 'USD' }],
  },
  {
    slug: 'canva-pro',
    name: 'Canva Pro',
    category: 'ai-cong-viec',
    logoKey: 'canva',
    brandColor: '#00C4CC',
    website: 'https://www.canva.com',
  },
  {
    slug: 'notion',
    name: 'Notion',
    category: 'ai-cong-viec',
    logoKey: 'notion',
    brandColor: '#000000',
    website: 'https://www.notion.so',
  },
  {
    slug: 'figma',
    name: 'Figma',
    category: 'ai-cong-viec',
    logoKey: 'figma',
    brandColor: '#F24E1E',
    website: 'https://www.figma.com',
  },
  {
    slug: 'adobe-creative-cloud',
    name: 'Adobe Creative Cloud',
    category: 'ai-cong-viec',
    logoKey: 'adobecreativecloud',
    brandColor: '#DA1F26',
    website: 'https://www.adobe.com/creativecloud.html',
  },
  {
    slug: 'adobe-lightroom',
    name: 'Adobe Lightroom',
    category: 'ai-cong-viec',
    logoKey: 'adobelightroom',
    brandColor: '#31A8FF',
    website: 'https://www.adobe.com/products/photoshop-lightroom.html',
  },
  {
    slug: 'microsoft-365',
    name: 'Microsoft 365',
    category: 'ai-cong-viec',
    brandColor: '#D83B01',
    website: 'https://www.microsoft.com/microsoft-365',
  },
  {
    slug: 'grammarly',
    name: 'Grammarly',
    category: 'ai-cong-viec',
    logoKey: 'grammarly',
    brandColor: '#15C39A',
    website: 'https://www.grammarly.com',
  },
  {
    slug: 'capcut-pro',
    name: 'CapCut Pro',
    category: 'ai-cong-viec',
    brandColor: '#000000',
    website: 'https://www.capcut.com',
  },
  {
    slug: 'zoom',
    name: 'Zoom',
    category: 'ai-cong-viec',
    logoKey: 'zoom',
    brandColor: '#0B5CFF',
    website: 'https://zoom.us',
  },
  {
    slug: 'slack',
    name: 'Slack',
    category: 'ai-cong-viec',
    logoKey: 'slack',
    brandColor: '#4A154B',
    website: 'https://slack.com',
  },

  // Lưu trữ
  {
    slug: 'icloud-plus',
    name: 'iCloud+',
    category: 'luu-tru',
    logoKey: 'icloud',
    brandColor: '#3693F3',
    website: 'https://www.icloud.com',
    plans: [
      { name: '50GB', amountMinor: 19_000, currency: 'VND' },
      {
        name: '200GB',
        amountMinor: 59_000,
        currency: 'VND',
        isFamily: true,
        maxMembers: 6,
      },
      {
        name: '2TB',
        amountMinor: 199_000,
        currency: 'VND',
        isFamily: true,
        maxMembers: 6,
      },
    ],
  },
  {
    slug: 'google-one',
    name: 'Google One',
    category: 'luu-tru',
    logoKey: 'google',
    brandColor: '#4285F4',
    website: 'https://one.google.com',
    plans: [
      {
        name: '100GB',
        amountMinor: 45_000,
        currency: 'VND',
        isFamily: true,
        maxMembers: 6,
      },
    ],
  },
  {
    slug: 'dropbox',
    name: 'Dropbox',
    category: 'luu-tru',
    logoKey: 'dropbox',
    brandColor: '#0061FF',
    website: 'https://www.dropbox.com',
  },
  {
    slug: 'onedrive',
    name: 'OneDrive',
    category: 'luu-tru',
    brandColor: '#0078D4',
    website: 'https://onedrive.live.com',
  },

  // Học tập
  {
    slug: 'duolingo',
    name: 'Duolingo',
    category: 'hoc-tap',
    logoKey: 'duolingo',
    brandColor: '#58CC02',
    website: 'https://www.duolingo.com',
  },
  {
    slug: 'elsa-speak',
    name: 'ELSA Speak',
    category: 'hoc-tap',
    brandColor: '#2A7FF8',
    website: 'https://elsaspeak.com',
  },
  {
    slug: 'coursera-plus',
    name: 'Coursera Plus',
    category: 'hoc-tap',
    logoKey: 'coursera',
    brandColor: '#0056D2',
    website: 'https://www.coursera.org',
  },
  {
    slug: 'linkedin-premium',
    name: 'LinkedIn Premium',
    category: 'hoc-tap',
    logoKey: 'linkedin',
    brandColor: '#0A66C2',
    website: 'https://www.linkedin.com/premium',
  },

  // Sức khỏe
  {
    slug: 'phong-gym',
    name: 'Phòng gym',
    category: 'suc-khoe',
    brandColor: '#F08A24',
  },
  {
    slug: 'strava',
    name: 'Strava',
    category: 'suc-khoe',
    logoKey: 'strava',
    brandColor: '#FC4C02',
    website: 'https://www.strava.com',
  },

  // Web & Hosting
  {
    slug: 'hostinger',
    name: 'Hostinger',
    category: 'web-hosting',
    logoKey: 'hostinger',
    brandColor: '#673DE6',
    website: 'https://www.hostinger.com',
  },
  {
    slug: 'godaddy',
    name: 'GoDaddy',
    category: 'web-hosting',
    logoKey: 'godaddy',
    brandColor: '#1BDBDB',
    website: 'https://www.godaddy.com',
  },
  {
    slug: 'namecheap',
    name: 'Namecheap',
    category: 'web-hosting',
    logoKey: 'namecheap',
    brandColor: '#DE3723',
    website: 'https://www.namecheap.com',
  },
  {
    slug: 'vercel',
    name: 'Vercel',
    category: 'web-hosting',
    logoKey: 'vercel',
    brandColor: '#000000',
    website: 'https://vercel.com',
  },
  {
    slug: 'ten-mien',
    name: 'Tên miền',
    category: 'web-hosting',
    brandColor: '#657166',
  },

  // Tiện ích & Bảo mật
  {
    slug: '1password',
    name: '1Password',
    category: 'tien-ich',
    logoKey: '1password',
    brandColor: '#0094F5',
    website: 'https://1password.com',
  },
  {
    slug: 'bitwarden',
    name: 'Bitwarden',
    category: 'tien-ich',
    logoKey: 'bitwarden',
    brandColor: '#175DDC',
    website: 'https://bitwarden.com',
  },
  {
    slug: 'nordvpn',
    name: 'NordVPN',
    category: 'tien-ich',
    logoKey: 'nordvpn',
    brandColor: '#4687FF',
    website: 'https://nordvpn.com',
  },
  {
    slug: 'expressvpn',
    name: 'ExpressVPN',
    category: 'tien-ich',
    logoKey: 'expressvpn',
    brandColor: '#DA3940',
    website: 'https://www.expressvpn.com',
  },

  // Game
  {
    slug: 'playstation-plus',
    name: 'PlayStation Plus',
    category: 'game',
    logoKey: 'playstation',
    brandColor: '#0070D1',
    website: 'https://www.playstation.com/ps-plus/',
  },
  {
    slug: 'xbox-game-pass',
    name: 'Xbox Game Pass',
    category: 'game',
    brandColor: '#107C10',
    website: 'https://www.xbox.com/xbox-game-pass',
  },
  {
    slug: 'nintendo-switch-online',
    name: 'Nintendo Switch Online',
    category: 'game',
    logoKey: 'nintendoswitch',
    brandColor: '#E60012',
    website: 'https://www.nintendo.com/switch/online/',
  },
  {
    slug: 'apple-arcade',
    name: 'Apple Arcade',
    category: 'game',
    logoKey: 'applearcade',
    brandColor: '#000000',
    website: 'https://www.apple.com/apple-arcade/',
  },

  // Đọc & Tin tức
  {
    slug: 'medium',
    name: 'Medium',
    category: 'doc-tin-tuc',
    logoKey: 'medium',
    brandColor: '#000000',
    website: 'https://medium.com',
  },
  {
    slug: 'kindle-unlimited',
    name: 'Kindle Unlimited',
    category: 'doc-tin-tuc',
    brandColor: '#FF9900',
    website: 'https://www.amazon.com/kindle-dbs/hz/subscribe/ku',
  },
];

const FEATURE_FLAGS = [
  {
    key: 'maintenance',
    description: 'Chế độ bảo trì: app hiện màn hình bảo trì cho mọi người dùng',
    enabled: false,
  },
  {
    key: 'family_split',
    description: 'Tính năng chia tiền nhóm',
    enabled: true,
  },
];

async function main(): Promise<void> {
  for (const [i, c] of CATEGORIES.entries()) {
    const data = { name: c.name, icon: c.icon, color: c.color, sortOrder: i };
    await prisma.category.upsert({
      where: { id: categoryId(c.slug) },
      create: { id: categoryId(c.slug), slug: c.slug, userId: null, ...data },
      update: data,
    });
  }

  let planCount = 0;
  for (const s of SERVICES) {
    const data = {
      name: s.name,
      categoryId: categoryId(s.category),
      logoKey: s.logoKey ?? null,
      brandColor: s.brandColor,
      website: s.website ?? null,
      cancelUrl: s.cancelUrl ?? null,
      isActive: true,
    };
    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, ...data },
      update: data,
    });
    for (const p of s.plans ?? []) {
      const planData = {
        amountMinor: BigInt(p.amountMinor),
        currency: p.currency,
        intervalUnit: p.unit ?? 'MONTH',
        intervalCount: p.count ?? 1,
        isFamily: p.isFamily ?? false,
        maxMembers: p.maxMembers ?? null,
        isActive: true,
      };
      await prisma.servicePlan.upsert({
        where: {
          serviceId_name_region: {
            serviceId: service.id,
            name: p.name,
            region: 'VN',
          },
        },
        create: {
          serviceId: service.id,
          name: p.name,
          region: 'VN',
          ...planData,
        },
        update: planData,
      });
      planCount++;
    }
  }

  for (const f of FEATURE_FLAGS) {
    // Không ghi đè trạng thái bật/tắt đã được admin thay đổi
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: f,
      update: { description: f.description },
    });
  }

  console.log(
    `Seed xong: ${CATEGORIES.length} danh mục, ${SERVICES.length} dịch vụ, ${planCount} gói, ${FEATURE_FLAGS.length} feature flag.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
