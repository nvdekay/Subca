import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MERCHANTS, merchantByDomain, merchantByText } from './merchants.js';

/**
 * `serviceSlug` sai một chữ là mất logo và hướng dẫn hủy mà không có lỗi nào báo ra
 * (`serviceIdBySlug` chỉ trả null). Đối chiếu thẳng với seed để bắt được ngay khi viết.
 */
const seedPath = fileURLToPath(
  new URL('../../prisma/seed.ts', import.meta.url),
);
const SEED_SLUGS = new Set(
  [...readFileSync(seedPath, 'utf8').matchAll(/slug: '([a-z0-9-]+)'/g)].map(
    (match) => match[1]!,
  ),
);

describe('danh mục merchant', () => {
  it('mọi serviceSlug đều có trong seed thư viện dịch vụ', () => {
    const missing = MERCHANTS.filter(
      (m) => m.serviceSlug && !SEED_SLUGS.has(m.serviceSlug),
    ).map((m) => `${m.key} → ${m.serviceSlug}`);
    expect(missing).toEqual([]);
  });

  it('khóa merchant không trùng nhau', () => {
    const keys = MERCHANTS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('nhận merchant theo tên miền con', () => {
    expect(merchantByDomain('netflix.com')?.key).toBe('netflix');
    expect(merchantByDomain('NETFLIX.COM')?.key).toBe('netflix');
  });

  it('tên dài hơn thắng khi tra theo text', () => {
    expect(merchantByText('YouTube Music Premium')?.key).toBe('youtube-music');
    expect(merchantByText('Apple TV+ 1 tháng')?.key).toBe('appletv');
  });

  it('không tra ra cửa hàng gộp từ text (Apple, Google Play)', () => {
    expect(merchantByText('App Store')?.key).toBeUndefined();
  });
});
