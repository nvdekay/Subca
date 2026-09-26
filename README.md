# Subca

Ứng dụng quản lý subscription cá nhân: nhắc gia hạn, theo dõi trial, phân tích chi tiêu, chia tiền gói gia đình.

## Cấu trúc

```
apps/
  api/       NestJS 12 (Fastify) + Prisma 7 → Supabase Postgres
  mobile/    React Native + Expo (Expo Router)
  admin/     Next.js 16 + Tailwind (Admin Console)
packages/
  shared/    Enum, schema zod, xử lý tiền dùng chung cho mobile / API / admin
design/      Mockup HTML (app + admin)
docs/        SUBCA-CHECKLIST.md — kế hoạch triển khai
```

## Bắt đầu

Yêu cầu: Node ≥ 22 (khuyến nghị 24), pnpm 11.

```bash
pnpm install                 # cài toàn bộ + tự sinh Prisma Client
cp apps/api/.env.example apps/api/.env   # điền chuỗi kết nối Supabase
pnpm build                   # build shared → api → admin
pnpm test                    # unit test
pnpm typecheck
pnpm lint
```

Chạy từng app:

```bash
pnpm --filter @subca/api dev      # http://localhost:3000/health
pnpm --filter @subca/mobile dev   # Expo
pnpm --filter @subca/admin dev    # http://localhost:3000 (đổi PORT nếu chạy cùng API)
```

## Database (Supabase + Prisma)

- Schema: `apps/api/prisma/schema.prisma`, cấu hình kết nối: `apps/api/prisma.config.ts`.
- `DATABASE_URL`: connection pooler (cổng 6543) cho ứng dụng. `DIRECT_URL`: kết nối trực tiếp (cổng 5432) cho migration.
- Áp dụng migration lên Supabase: `pnpm --filter @subca/api prisma:deploy`.
- Tạo migration mới khi sửa schema: `pnpm db:migrate` (cần `SHADOW_DATABASE_URL` hoặc quyền tạo database tạm).

Migration hiện có:

1. `20260927000000_init`: 26 bảng, enum, index.
2. `20260927000100_rls_and_auth`: bật **Row Level Security cho mọi bảng** (không có policy → client không truy cập thẳng được), thu hồi quyền của `anon` / `authenticated`, trigger trên `auth.users` tự tạo `profiles` + `user_settings` + quy tắc nhắc mặc định khi đăng ký và xóa toàn bộ dữ liệu khi tài khoản bị xóa.

**Quy tắc bắt buộc:** mọi bảng mới phải bật RLS trong chính migration tạo ra nó. Khóa `service_role` của Supabase chỉ dùng ở backend.

## Xác thực (API)

- App đăng nhập bằng Supabase Auth, gửi access token qua header `Authorization: Bearer <token>`.
- API xác minh token bằng khóa công khai từ JWKS của project (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, ES256): đúng issuer, audience `authenticated`, còn hạn, role `authenticated`. Không cần lưu bí mật JWT.
- Mọi endpoint mặc định **bắt buộc đăng nhập**; endpoint công khai gắn `@Public()` (VD `/health`). Lấy người dùng hiện tại bằng `@CurrentUser()`.
- Lỗi 401 có `code` để app xử lý: `TOKEN_EXPIRED` → làm mới token rồi gọi lại; `UNAUTHENTICATED` / `INVALID_TOKEN` → đăng nhập lại.
- `GET /me`: hồ sơ, cài đặt, gói hiện tại (FREE/PLUS) và giới hạn gói Free.

## Quy ước dữ liệu

- Tiền: `BigInt` theo đơn vị nhỏ nhất + mã tiền tệ (`VND`, `USD`…). API trả BigInt dạng chuỗi trong JSON.
- Chu kỳ: `intervalUnit` + `intervalCount`; `anchorDay` giữ ngày gốc (29–31).
- Enum trong `schema.prisma` phải khớp `packages/shared/src/enums.ts`.
