/**
 * Sinh src/components/brand-logos.generated.ts từ Simple Icons (CC0) cho đúng các logoKey trong seed.
 * Đóng gói sẵn trong app để hiện logo ngay, không tải từ mạng.
 * Chạy lại khi seed thêm dịch vụ: `pnpm --filter @subca/mobile logos:generate`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as icons from 'simple-icons';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = readFileSync(join(root, '../api/prisma/seed.ts'), 'utf8');
const keys = [...new Set([...seed.matchAll(/logoKey: '([^']+)'/g)].map((m) => m[1]))].sort();

const bySlug = new Map(Object.values(icons).map((icon) => [icon.slug, icon]));
const found = [];
const missing = [];
for (const key of keys) {
  const icon = bySlug.get(key);
  if (icon) found.push([key, icon]);
  else missing.push(key);
}

const body = found
  .map(
    ([key, icon]) =>
      `  ${JSON.stringify(key)}: { color: '#${icon.hex}', path: ${JSON.stringify(icon.path)} },`,
  )
  .join('\n');

writeFileSync(
  join(root, 'src/components/brand-logos.generated.ts'),
  `// File sinh tự động bởi scripts/generate-brand-logos.mjs — đừng sửa tay.
// Nguồn: Simple Icons (CC0). Thiếu trong Simple Icons (hiện chữ viết tắt): ${missing.join(', ') || 'không có'}.
export const BRAND_LOGOS: Record<string, { color: string; path: string }> = {
${body}
};
`,
);
console.log(`Đã sinh ${found.length} logo; thiếu: ${missing.join(', ') || 'không có'}`);
