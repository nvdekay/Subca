# Subca API

Backend NestJS 12 chạy trên Fastify, Prisma 7.10 và Supabase Postgres. API xác thực access token Supabase Auth; mọi truy vấn nghiệp vụ phải phân vùng theo `userId`. Hợp đồng zod/DTO dùng chung nằm trong `packages/shared`.

## Chạy local

```bash
pnpm install
cp .env.example .env
# Điền DATABASE_URL, DIRECT_URL, SUPABASE_URL; các secret chỉ lưu ở backend
docker compose up -d
pnpm --filter @subca/api dev
```

Health check: `http://localhost:3000/health`. API cần database kết nối được; Redis cần cho BullMQ (reminders, push receipt và scan Gmail). Biến đầy đủ và an toàn được liệt kê trong `.env.example`; không đưa `SUPABASE_SERVICE_ROLE_KEY`, Google secret, `SECRETS_KEY` hoặc database URL vào client.

## Database

- Prisma schema: `prisma/schema.prisma`; config Prisma 7: `prisma.config.ts`; generated client ở `src/generated/prisma` (không sửa tay).
- `DATABASE_URL` dùng Supavisor transaction pooler cho runtime; `DIRECT_URL` dùng migration.
- Chạy migration đã tạo: `pnpm --filter @subca/api prisma:deploy`.
- Tạo migration khi đổi schema: `pnpm --filter @subca/api prisma:migrate`.
- Sinh lại client: `pnpm --filter @subca/api prisma:generate`.
- Seed dữ liệu dev: `pnpm --filter @subca/api prisma:seed`.

Repo hiện có 5 migration, 31 Prisma models. Mọi bảng mới phải bật RLS ngay trong migration tạo bảng; app chỉ truy cập dữ liệu nghiệp vụ qua API.

## Các module API

`auth`, `me`, `catalog`, `subscriptions`, `home`, `insights` (calendar/reviews/analytics), `payment-methods`, `reminders`, `push`, `groups`, `connections`, `detection`, `inbox`, `fx`, `queue`, `admin`, `health`.

Các luồng chính:

- `/subscriptions`: CRUD/lưu trữ; DTO list có nguồn phát hiện, confidence và số event làm bằng chứng.
- `/home`, `/calendar`, `/reviews`, `/analytics`: dữ liệu tổng hợp cho mobile. Analytics hiện không breakdown theo category.
- `/connections`: Gmail OAuth; `POST /connections/:id/sync` tạo sync run, enqueue BullMQ và trả kết quả ban đầu ngay. Worker lưu tiến độ sau mỗi trang Gmail; mobile đọc `/connections/summary`.
- `/inbox`: các quyết định cần người dùng xử lý sau detection.
- `/groups`: nhóm chia phí theo tháng, split, payment state và VietQR.
- `/reminders` + BullMQ: lập lịch, gửi Expo Push và đối chiếu receipts.

Danh sách endpoint và map theo flow mobile xem ở [`docs/PROJECT-KNOWLEDGE.md`](../../docs/PROJECT-KNOWLEDGE.md#api-calls-theo-flow-mobile-v2); quyết định kiến trúc ở [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## Chất lượng

```bash
pnpm --filter @subca/api typecheck
pnpm --filter @subca/api lint
pnpm --filter @subca/api test          # unit + e2e
pnpm --filter @subca/api test:int      # cần Supabase dev + Redis; tự tạo/dọn dữ liệu
pnpm --filter @subca/api prisma:validate
```

Sau khi thêm Nest module/provider hoặc đổi constructor, chạy smoke/e2e kiểm tra AppModule để bắt lỗi dependency injection; test unit tạo provider thủ công không thay thế được kiểm tra wiring toàn app.
