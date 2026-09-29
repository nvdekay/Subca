/**
 * Tạo (hoặc đặt lại mật khẩu) tài khoản Admin Console đầu tiên.
 *
 * Dùng khi máy chủ chưa có `SUPABASE_SERVICE_ROLE_KEY` — lúc đó trang Nhân sự không tạo được
 * tài khoản, nên phải ghi thẳng vào `auth.users` bằng mật khẩu đã băm (bcrypt của pgcrypto).
 * Sau khi có tài khoản đầu tiên, thêm admin khác ngay trong giao diện.
 *
 * Chạy: pnpm --filter @subca/api admin:create -- <email> ["Tên hiển thị"]
 * Mặc định sinh mật khẩu ngẫu nhiên; có thể đặt ADMIN_CREATE_PASSWORD và
 * ADMIN_CREATE_ROLE=ADMIN cho tài khoản dev riêng. Thông tin đăng nhập ghi vào
 * `.admin-account*.local` ở gốc repo (đã gitignore).
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { chmodSync, writeFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const email = (args[0] ?? 'admin@subca.app').trim().toLowerCase();
const name = args[1] ?? 'Quản trị viên';
const role = process.env['ADMIN_CREATE_ROLE'] === 'ADMIN' ? 'ADMIN' : 'OWNER';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Email admin không hợp lệ');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  }),
});

/** Mật khẩu ngẫu nhiên, bỏ ký tự dễ đọc lẫn, luôn có chữ hoa / thường / số. */
function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const body = Array.from(
    randomBytes(18),
    (b) => alphabet[b % alphabet.length],
  ).join('');
  return `Sb${body}7`;
}

const password = process.env['ADMIN_CREATE_PASSWORD'] ?? randomPassword();
if (password.length < 6)
  throw new Error('Mật khẩu admin phải có ít nhất 6 ký tự');

const existing = await prisma.$queryRaw<{ id: string }[]>`
  select id::text as id from auth.users where email = ${email} limit 1
`;

let userId: string;
if (existing[0]) {
  userId = existing[0].id;
  await prisma.$executeRaw`
    update auth.users
       set encrypted_password = extensions.crypt(${password}, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = ${userId}::uuid
  `;
  console.log(`Tài khoản ${email} đã có sẵn — đã đặt lại mật khẩu.`);
} else {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      ${email}, extensions.crypt(${password}, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    ) returning id::text as id
  `;
  userId = rows[0]!.id;
  // GoTrue cần một "identity" provider email đi kèm tài khoản
  await prisma.$executeRaw`
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      ${userId}, ${userId}::uuid,
      jsonb_build_object('sub', ${userId}::text, 'email', ${email}::text, 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing
  `;
  console.log(`Đã tạo tài khoản đăng nhập ${email}.`);
}

const admin = await prisma.adminUser.upsert({
  where: { id: userId },
  create: { id: userId, email, name, role },
  update: { isActive: true, role, name },
});
console.log('admin_users:', {
  email: admin.email,
  role: admin.role,
  isActive: admin.isActive,
});

const target = new URL(
  `../../../.admin-account${email === 'admin@subca.app' ? '' : `-${email.split('@')[0]}`}.local`,
  import.meta.url,
);
writeFileSync(
  target,
  [
    '# Tài khoản Admin Console — KHÔNG commit, đổi mật khẩu sau lần đăng nhập đầu',
    `Email:    ${email}`,
    `Mật khẩu: ${password}`,
    `Vai trò:  ${admin.role}`,
    '',
  ].join('\n'),
  { encoding: 'utf8', mode: 0o600 },
);
chmodSync(target, 0o600);
console.log(
  'Đã ghi thông tin đăng nhập vào file .admin-account*.local ở gốc repo.',
);

await prisma.$disconnect();
