# Subca

Ứng dụng quản lý subscription cá nhân: nhắc gia hạn, theo dõi trial, phân tích chi tiêu, chia tiền gói gia đình.

## Tài liệu

- [`docs/PROJECT-KNOWLEDGE.md`](docs/PROJECT-KNOWLEDGE.md) — **nguồn sự thật trung tâm** cho Claude, Codex và session mới: hiện trạng, việc tiếp theo, kiến trúc, quy ước, môi trường và bẫy đã biết
- [`docs/SUBCA-CHECKLIST.md`](docs/SUBCA-CHECKLIST.md) — kế hoạch, tiến độ và backlog (xem phần **Hiện trạng** ở đầu file)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — kiến trúc và các quyết định kỹ thuật đã chốt
- [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) — entrypoint tự động để Claude Code và Codex nạp knowledge base khi mở session

## Cấu trúc

```
apps/
  api/       NestJS 12 (Fastify) + Prisma 7 → Supabase Postgres
  mobile/    React Native + Expo (Expo Router)
  admin/     Next.js 16 + Tailwind (Admin Console)
packages/
  shared/    Enum, schema zod, xử lý tiền dùng chung cho mobile / API / admin
design/      Mockup HTML (app + admin)
docs/        PROJECT-KNOWLEDGE.md (hiện trạng) · SUBCA-CHECKLIST.md (roadmap) · ARCHITECTURE.md (quyết định)
```

## Bắt đầu

Yêu cầu: Node ≥ 22 (khuyến nghị 24), pnpm 11, Docker (OrbStack hoặc Docker Desktop).

```bash
docker compose up -d         # Redis cho BullMQ: reminders, push và Gmail scan
pnpm install                 # cài toàn bộ + tự sinh Prisma Client
cp apps/api/.env.example apps/api/.env   # điền chuỗi kết nối Supabase
pnpm build
pnpm typecheck
pnpm lint
pnpm test                    # unit/e2e tests trong packages
```

Chạy từng app:

```bash
pnpm --filter @subca/api dev      # http://localhost:3000/health
pnpm --filter @subca/mobile dev   # Expo
pnpm --filter @subca/admin dev -- -p 3100  # API mặc định chiếm cổng 3000
```

Mobile có native modules (MMKV, notifications, v.v.); để chạy iOS Simulator sau lần đầu:

```bash
pnpm --filter @subca/mobile ios
```

Nếu Xcode báo thiếu `React.framework` khi cài Pods trên máy này, đồng bộ lại Pods theo chế độ build React Native từ source rồi chạy lại lệnh iOS:

```bash
cd apps/mobile/ios
RCT_USE_RN_DEP=0 RCT_USE_PREBUILT_RNCORE=0 pod install
cd ../../..
RCT_USE_RN_DEP=0 RCT_USE_PREBUILT_RNCORE=0 pnpm --filter @subca/mobile ios
```

## Database (Supabase + Prisma)

- Schema: `apps/api/prisma/schema.prisma`, cấu hình kết nối: `apps/api/prisma.config.ts`.
- `DATABASE_URL`: connection pooler (cổng 6543) cho ứng dụng. `DIRECT_URL`: kết nối trực tiếp (cổng 5432) cho migration.
- Áp dụng migration lên Supabase: `pnpm --filter @subca/api prisma:deploy`.
- Tạo migration mới khi sửa schema: `pnpm db:migrate` (cần `SHADOW_DATABASE_URL` hoặc quyền tạo database tạm).

Migration hiện có (5 migration; tổng schema 31 model):

1. `20260927000000_init`: 26 bảng, enum, index.
2. `20260927000100_rls_and_auth`: bật **Row Level Security cho mọi bảng**, thu hồi quyền của `anon` / `authenticated`, trigger tạo profile/settings/reminder rules và cascade dữ liệu khi xóa tài khoản.
3. `20260927000200_reminder_receipts`: nhắc nhở và trạng thái push receipt.
4. `20260928000000_email_auto_detect`: Gmail connection, email sync, detection, events và Inbox.
5. `20260928010000_aggregated_receipt_events`: hỗ trợ hóa đơn gộp thành nhiều sự kiện.

**Quy tắc bắt buộc:** mọi bảng mới phải bật RLS trong chính migration tạo ra nó. Khóa `service_role` của Supabase chỉ dùng ở backend.

## Xác thực (API)

- App đăng nhập bằng Supabase Auth, gửi access token qua header `Authorization: Bearer <token>`.
- API xác minh token bằng khóa công khai từ JWKS của project (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, ES256): đúng issuer, audience `authenticated`, còn hạn, role `authenticated`. Không cần lưu bí mật JWT.
- Mọi endpoint mặc định **bắt buộc đăng nhập**; endpoint công khai gắn `@Public()` (VD `/health`). Lấy người dùng hiện tại bằng `@CurrentUser()`.
- Lỗi 401 có `code` để app xử lý: `TOKEN_EXPIRED` → làm mới token rồi gọi lại; `UNAUTHENTICATED` / `INVALID_TOKEN` → đăng nhập lại.
- `GET /me`: hồ sơ, cài đặt, gói hiện tại (FREE/PLUS) và giới hạn gói Free.
- Tài khoản bị khóa: mọi endpoint trả `403 ACCOUNT_BANNED` (kiểm tra có cache 60 giây).

## API hiện có

| Method                | Đường dẫn                                                             | Mô tả                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET                   | `/health`                                                             | Kiểm tra API + database (công khai)                                                                                                                        |
| GET                   | `/me`                                                                 | Hồ sơ, cài đặt, gói hiện tại                                                                                                                               |
| GET                   | `/catalog/services?q=`                                                | Thư viện dịch vụ kèm gói giá                                                                                                                               |
| GET                   | `/subscriptions?status=&q=`                                           | Danh sách + giới hạn gói; gồm nguồn phát hiện, confidence và số bằng chứng email                                                                           |
| GET                   | `/subscriptions/:id`                                                  | Chi tiết: phương thức thanh toán, hướng dẫn hủy và 12 lần trừ tiền gần nhất                                                                                |
| POST                  | `/subscriptions`                                                      | Thêm; server tự tính kỳ gia hạn tiếp theo theo múi giờ người dùng                                                                                          |
| PATCH                 | `/subscriptions/:id`                                                  | Sửa một phần, hủy (`status: CANCELLED`) hoặc mở lại                                                                                                        |
| DELETE                | `/subscriptions/:id`                                                  | Lưu trữ (xóa mềm)                                                                                                                                          |
| GET                   | `/home`                                                               | Toàn bộ số liệu Trang chủ: tổng tháng/năm (đã quy đổi tiền tệ), số đang hoạt động, trial, sắp gia hạn 7 ngày, có thể tiết kiệm, ngân sách, 5 khoản sắp tới |
| GET · POST            | `/payment-methods`                                                    | Danh sách (kèm số subscription và tổng tháng) · thêm (chỉ nhận 4 số cuối thẻ)                                                                              |
| PATCH · DELETE        | `/payment-methods/:id`                                                | Sửa / đặt mặc định · lưu trữ (gỡ khỏi các subscription)                                                                                                    |
| PATCH                 | `/me`                                                                 | Đổi tên hiển thị                                                                                                                                           |
| PATCH                 | `/me/settings`                                                        | Tiền tệ, múi giờ, ngôn ngữ, giờ nhắc, bật/tắt thông báo                                                                                                    |
| GET · PUT · DELETE    | `/me/budget`                                                          | Ngân sách subscription hằng tháng                                                                                                                          |
| POST · DELETE         | `/push-tokens`                                                        | Đăng ký / hủy thiết bị nhận thông báo (Expo push token)                                                                                                    |
| GET                   | `/calendar?month=YYYY-MM`                                             | Lịch gia hạn theo tháng (gộp theo ngày, đánh dấu ngày hết trial, tổng tiền trong tháng)                                                                    |
| GET                   | `/reviews?period=YYYY-MM`                                             | Đánh giá hằng tháng: danh sách gói, quyết định, số tiền có thể tiết kiệm                                                                                   |
| PUT · DELETE          | `/reviews/:subscriptionId`                                            | Đặt / bỏ quyết định Giữ · Xem lại · Hủy (Xem lại → gói chuyển REVIEW, Giữ → ACTIVE)                                                                        |
| GET                   | `/analytics`                                                          | Phân tích theo phương thức thanh toán, top đắt nhất, chi phí mỗi lần dùng và xu hướng 6 tháng (ước tính); không chia theo category                         |
| GET                   | `/reminders`                                                          | Màn Thông báo: nhắc đã gửi 30 ngày qua + nhắc sẽ gửi 30 ngày tới (cùng nội dung push)                                                                      |
| GET · PUT             | `/reminders/rules`                                                    | Quy tắc nhắc chung (mốc trước gia hạn / hết trial), PUT thay cả danh sách                                                                                  |
| POST                  | `/reminders/:id/opened`                                               | Ghi nhận người dùng đã bấm thông báo nhắc                                                                                                                  |
| DELETE                | `/me`                                                                 | Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu (cần `SUPABASE_SERVICE_ROLE_KEY`, thiếu → 503)                                                                  |
| GET · POST            | `/groups`                                                             | Màn Chia tiền nhóm: nhóm mình làm chủ, nhóm tham gia, tổng sẽ nhận / cần trả · tạo nhóm từ một gói đang trả (2–6 người)                                    |
| POST                  | `/groups/join`                                                        | Vào nhóm bằng mã trong link mời `subca.app/j/<mã>`                                                                                                         |
| GET · PATCH · DELETE  | `/groups/:id`                                                         | Chi tiết nhóm (thành viên, kỳ thu tháng này, lịch sử, mã QR VietQR) · sửa tên / giá gói / hạn chuyển / thông tin nhận tiền · xóa nhóm                      |
| PUT                   | `/groups/:id/split`                                                   | Đổi cách chia: chia đều, hoặc tùy chỉnh (tổng phải khớp giá gói)                                                                                           |
| POST · PATCH · DELETE | `/groups/:id/members`                                                 | Thêm chỗ · đổi tên thành viên · gỡ thành viên hoặc tự rời nhóm                                                                                             |
| POST                  | `/groups/:id/payments/:paymentId/{claim,confirm,waive,reopen,remind}` | Thành viên báo đã chuyển · chủ nhóm xác nhận / miễn / mở lại · nhắc một người (chặn nhắc dồn trong 6 giờ)                                                  |
| POST                  | `/groups/:id/remind-all`                                              | Nhắc mọi thành viên chưa trả trong kỳ đang thu                                                                                                             |
| GET · POST            | `/connections` · `/connections/gmail/start`                           | Hộp thư đã kết nối · xin URL đồng ý của Google (app mở bằng trình duyệt hệ thống)                                                                          |
| GET                   | `/connections/gmail/callback`                                         | Google gọi về (công khai, bảo vệ bằng `state` dùng một lần) → lưu refresh token đã mã hóa                                                                  |
| POST · DELETE         | `/connections/:id/sync` · `/connections/:id`                          | Đưa scan vào BullMQ và trả run ngay · ngắt kết nối (thu hồi ở Google rồi xóa token)                                                                        |
| GET                   | `/connections/summary`                                                | Tiến độ quét và số subscription đã tìm thấy                                                                                                                |
| GET · POST            | `/inbox` · `/inbox/:id/resolve`                                       | Subca Inbox: việc cần người dùng quyết định · trả lời                                                                                                      |

### Nhắc nhở (BullMQ + Expo Push)

- Mỗi 5 phút, API chạy một lượt: (1) đẩy kỳ gia hạn đã qua (ghi lịch sử trừ tiền, trial hết hạn → ACTIVE hoặc CANCELLED nếu tắt tự gia hạn), (2) sinh lượt nhắc sẽ đến hạn trong 26 giờ tới theo giờ nhắc và múi giờ từng người, (3) đưa lượt nhắc vào hàng đợi BullMQ dưới dạng job hẹn giờ.
- Mốc nhắc: mốc riêng của gói (`reminderOffsets`) hoặc quy tắc chung (`reminder_rules`, mặc định 30 ngày cho gói năm, 7 ngày, 1 ngày; trial 1 ngày). Gói Free chỉ 1 mốc.
- Không gửi trùng: lượt nhắc có khóa unique, job BullMQ dùng ID của lượt nhắc. Worker kiểm tra lại trước khi gửi (gói đã hủy, đổi ngày, tắt thông báo → bỏ); lỗi mạng thử lại 3 lần; máy đã gỡ app → xóa token.
- App đăng ký thiết bị bằng `POST /push-tokens` sau khi đăng nhập, gọi `DELETE /push-tokens` khi đăng xuất.
- Mỗi 15 phút kiểm tra push receipt của Expo (thông báo có tới máy không); máy đã gỡ app → xóa token; mọi máy lỗi → lượt nhắc FAILED.
- Biến môi trường: `REDIS_URL`, `REMINDERS_ENABLED`, `EXPO_ACCESS_TOKEN` (tùy chọn). Production dùng Redis cùng khu vực với API, `maxmemory-policy noeviction`.

### Tự phát hiện subscription từ email

- Kết nối Gmail một lần: scan ban đầu lùi 12 tháng; scan thủ công trả run ngay qua BullMQ, tiến độ cập nhật theo từng trang. Scheduler định kỳ 6 giờ chỉ chạy khi `EMAIL_SYNC_ENABLED=true`.
- Đường đi: lọc ứng viên (từ khóa Anh/Việt + merchant registry) → parser nhiều lớp (merchant → tổng quát, gồm line-items cho hóa đơn gộp) → `subscription_events` → engine đối soát → subscription hoặc Inbox.
- Độ tin cậy quyết định trải nghiệm: ≥75 tự thêm · ≥45 thêm kèm nhãn "Cần kiểm tra" · thấp hơn thì hỏi trong **Subca Inbox**. Im lặng lâu chỉ hạ tin cậy, không tự kết luận đã hủy.
- Gói nhập tay không bị tạo trùng: engine gộp bằng chứng theo merchant / dịch vụ / giá và **không ghi đè** số liệu người dùng tự nhập.
- Quyền tối thiểu (`gmail.readonly`), refresh token mã hóa AES-256-GCM (`SECRETS_KEY`) và không bao giờ xuống client; **không lưu nội dung thư** — chỉ lưu thông tin gói và băm tiêu đề.
- Cần `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SECRETS_KEY` và URL callback chính xác; thiếu thì API trả `GMAIL_UNAVAILABLE` và app ẩn nút kết nối. Tính năng đã có code nhưng OAuth production/CASA và scan hộp thư thật còn phải xác minh.

### Chia tiền nhóm (VietQR)

- Nhóm thu theo tháng: mỗi tháng một kỳ, mỗi thành viên một khoản phải trả. Kỳ được tạo và đồng bộ ngay khi mở màn nhóm, không cần job nền.
- Chia đều thì tổng luôn khớp giá gói (phần lẻ dồn cho người đầu); chia tùy chỉnh bắt buộc tổng khớp giá gói.
- Trạng thái khoản: chưa trả → "Tôi đã chuyển" → chủ nhóm xác nhận (hoặc miễn). Đổi giá gói / cách chia chỉ sửa khoản chưa trả.
- Mã QR chuyển khoản sinh ở server theo chuẩn **VietQR (EMVCo + NAPAS247, QRIBFTTA)**, app chỉ vẽ lại chuỗi. Chỉ hỗ trợ VND. Danh sách BIN ngân hàng trong `packages/shared/src/vietqr.ts` là danh sách tham khảo, cần đối chiếu với NAPAS trước khi ra mắt.

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
