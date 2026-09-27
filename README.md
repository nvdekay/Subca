# Subca

Ứng dụng quản lý subscription cá nhân: nhắc gia hạn, theo dõi trial, phân tích chi tiêu, chia tiền gói gia đình.

## Tài liệu

- [`docs/SUBCA-CHECKLIST.md`](docs/SUBCA-CHECKLIST.md) — kế hoạch, tiến độ, việc tiếp theo (xem phần **Hiện trạng** ở đầu file)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — kiến trúc và các quyết định kỹ thuật đã chốt
- [`CLAUDE.md`](CLAUDE.md) — quy ước code, test, commit và các bẫy đã gặp (Claude Code tự đọc khi mở phiên)

## Cấu trúc

```
apps/
  api/       NestJS 12 (Fastify) + Prisma 7 → Supabase Postgres
  mobile/    React Native + Expo (Expo Router)
  admin/     Next.js 16 + Tailwind (Admin Console)
packages/
  shared/    Enum, schema zod, xử lý tiền dùng chung cho mobile / API / admin
design/      Mockup HTML (app + admin)
docs/        SUBCA-CHECKLIST.md (kế hoạch, tiến độ) · ARCHITECTURE.md (quyết định kỹ thuật)
```

## Bắt đầu

Yêu cầu: Node ≥ 22 (khuyến nghị 24), pnpm 11, Docker (OrbStack hoặc Docker Desktop).

```bash
docker compose up -d         # Redis cho hàng đợi nhắc nhở (BullMQ)
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
- Tài khoản bị khóa: mọi endpoint trả `403 ACCOUNT_BANNED` (kiểm tra có cache 60 giây).

## API hiện có

| Method             | Đường dẫn                   | Mô tả                                                                                                                                                      |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET                | `/health`                   | Kiểm tra API + database (công khai)                                                                                                                        |
| GET                | `/me`                       | Hồ sơ, cài đặt, gói hiện tại                                                                                                                               |
| GET                | `/catalog/services?q=`      | Thư viện dịch vụ kèm gói giá                                                                                                                               |
| GET                | `/subscriptions?status=&q=` | Danh sách, sắp theo kỳ gia hạn gần nhất, kèm `trackedCount` và `limit`                                                                                     |
| GET                | `/subscriptions/:id`        | Chi tiết cho màn Chi tiết: kèm phương thức thanh toán, danh mục, hướng dẫn hủy, 12 lần trừ tiền gần nhất                                                   |
| POST               | `/subscriptions`            | Thêm; server tự tính kỳ gia hạn tiếp theo theo múi giờ người dùng                                                                                          |
| PATCH              | `/subscriptions/:id`        | Sửa một phần, hủy (`status: CANCELLED`) hoặc mở lại                                                                                                        |
| DELETE             | `/subscriptions/:id`        | Lưu trữ (xóa mềm)                                                                                                                                          |
| GET                | `/home`                     | Toàn bộ số liệu Trang chủ: tổng tháng/năm (đã quy đổi tiền tệ), số đang hoạt động, trial, sắp gia hạn 7 ngày, có thể tiết kiệm, ngân sách, 5 khoản sắp tới |
| GET · POST         | `/payment-methods`          | Danh sách (kèm số subscription và tổng tháng) · thêm (chỉ nhận 4 số cuối thẻ)                                                                              |
| PATCH · DELETE     | `/payment-methods/:id`      | Sửa / đặt mặc định · lưu trữ (gỡ khỏi các subscription)                                                                                                    |
| PATCH              | `/me`                       | Đổi tên hiển thị                                                                                                                                           |
| PATCH              | `/me/settings`              | Tiền tệ, múi giờ, ngôn ngữ, giờ nhắc, bật/tắt thông báo                                                                                                    |
| GET · PUT · DELETE | `/me/budget`                | Ngân sách subscription hằng tháng                                                                                                                          |
| POST · DELETE      | `/push-tokens`              | Đăng ký / hủy thiết bị nhận thông báo (Expo push token)                                                                                                    |
| GET                | `/calendar?month=YYYY-MM`   | Lịch gia hạn theo tháng (gộp theo ngày, đánh dấu ngày hết trial, tổng tiền trong tháng)                                                                    |
| GET                | `/reviews?period=YYYY-MM`   | Đánh giá hằng tháng: danh sách gói, quyết định, số tiền có thể tiết kiệm                                                                                   |
| PUT · DELETE       | `/reviews/:subscriptionId`  | Đặt / bỏ quyết định Giữ · Xem lại · Hủy (Xem lại → gói chuyển REVIEW, Giữ → ACTIVE)                                                                        |
| GET                | `/analytics`                | Phân tích: theo danh mục, theo phương thức thanh toán, top đắt nhất, chi phí mỗi lần dùng, xu hướng 6 tháng (ước tính)                                     |
| GET                | `/reminders`                | Màn Thông báo: nhắc đã gửi 30 ngày qua + nhắc sẽ gửi 30 ngày tới (cùng nội dung push)                                                                      |
| GET · PUT          | `/reminders/rules`          | Quy tắc nhắc chung (mốc trước gia hạn / hết trial), PUT thay cả danh sách                                                                                  |
| POST               | `/reminders/:id/opened`     | Ghi nhận người dùng đã bấm thông báo nhắc                                                                                                                  |
| DELETE             | `/me`                       | Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu (cần `SUPABASE_SERVICE_ROLE_KEY`, thiếu → 503)                                                                  |

### Nhắc nhở (BullMQ + Expo Push)

- Mỗi 5 phút, API chạy một lượt: (1) đẩy kỳ gia hạn đã qua (ghi lịch sử trừ tiền, trial hết hạn → ACTIVE hoặc CANCELLED nếu tắt tự gia hạn), (2) sinh lượt nhắc sẽ đến hạn trong 26 giờ tới theo giờ nhắc và múi giờ từng người, (3) đưa lượt nhắc vào hàng đợi BullMQ dưới dạng job hẹn giờ.
- Mốc nhắc: mốc riêng của gói (`reminderOffsets`) hoặc quy tắc chung (`reminder_rules`, mặc định 30 ngày cho gói năm, 7 ngày, 1 ngày; trial 1 ngày). Gói Free chỉ 1 mốc.
- Không gửi trùng: lượt nhắc có khóa unique, job BullMQ dùng ID của lượt nhắc. Worker kiểm tra lại trước khi gửi (gói đã hủy, đổi ngày, tắt thông báo → bỏ); lỗi mạng thử lại 3 lần; máy đã gỡ app → xóa token.
- App đăng ký thiết bị bằng `POST /push-tokens` sau khi đăng nhập, gọi `DELETE /push-tokens` khi đăng xuất.
- Mỗi 15 phút kiểm tra push receipt của Expo (thông báo có tới máy không); máy đã gỡ app → xóa token; mọi máy lỗi → lượt nhắc FAILED.
- Biến môi trường: `REDIS_URL`, `REMINDERS_ENABLED`, `EXPO_ACCESS_TOKEN` (tùy chọn). Production dùng Redis cùng khu vực với API, `maxmemory-policy noeviction`.

### Tỷ giá

- Quy đổi tiền tệ dùng bảng `exchange_rates` (tỷ giá mới nhất tính đến hôm nay). Khoản nào thiếu tỷ giá **không** được cộng vào tổng và được liệt kê trong `missingRates`.
- Job trong API cập nhật tỷ giá **mỗi ngày lúc 00:30 UTC (07:30 giờ Việt Nam)**; khi khởi động nếu tỷ giá cũ hơn 1 ngày thì cập nhật ngay. Lưu mọi cặp giữa VND, USD, EUR, JPY. Tắt bằng `FX_SYNC_ENABLED=false`.
- Chạy tay: `pnpm --filter @subca/api fx:sync`.
- Nguồn chính: [ExchangeRate-API](https://www.exchangerate-api.com) (gói Open Access, không cần key). Dự phòng: [fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api).
- **Điều khoản ExchangeRate-API:** được dùng thương mại để quy đổi, nhưng **bắt buộc ghi nguồn** nơi hiển thị số đã quy đổi (VD dòng nhỏ "Tỷ giá: ExchangeRate-API" có link trong app), **không được phân phối lại** dữ liệu tỷ giá, và chỉ gọi tối đa 1 lần/ngày.

Schema đầu vào dùng chung ở `packages/shared/src/api` (app dùng lại cho form). Lỗi dữ liệu trả `400 VALIDATION_ERROR` kèm `issues` theo từng trường; vượt giới hạn gói Free trả `403 PLAN_LIMIT_REACHED`.

CI chạy thêm smoke test khởi động toàn bộ API (kèm Redis) để bắt lỗi nối module.

Test tích hợp trên hạ tầng thật (Supabase dev + Redis từ `docker compose`, tự tạo và dọn dữ liệu tạm): `pnpm --filter @subca/api test:int`.

## Quy ước dữ liệu

- Tiền: `BigInt` theo đơn vị nhỏ nhất + mã tiền tệ (`VND`, `USD`…). API trả BigInt dạng chuỗi trong JSON.
- Chu kỳ: `intervalUnit` + `intervalCount`; `anchorDay` giữ ngày gốc (29–31).
- Enum trong `schema.prisma` phải khớp `packages/shared/src/enums.ts`.
