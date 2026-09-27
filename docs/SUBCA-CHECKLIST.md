# Subca — Checklist tổng

> Cập nhật: 27/09/2026 · Đánh dấu `[x]` khi xong.
> File liên quan: `design/subca-mobile-mockup.html` (app), `design/subca-admin-dashboard.html` (admin).
> Repo: https://github.com/nvdekay/Subca (nhánh `main`, CI xanh). Tài liệu kỹ thuật: `docs/ARCHITECTURE.md`, hướng dẫn cho Claude: `CLAUDE.md`.

### Hiện trạng (27/09/2026)

**Đang ở:** Giai đoạn 1. **Backend (API) cho các màn Giai đoạn 1–2 đã xong**; app mobile và admin mới chỉ khởi tạo khung.

**Đã xong**
- Mockup app (16 màn) + admin (12 trang) trong `design/`.
- Monorepo: Expo SDK 57, NestJS 12 + Fastify, Next.js 16, Prisma 7.10, TypeScript 6.0, pnpm 11 + Turborepo; CI GitHub Actions (có Redis cho smoke test).
- Supabase dev (Tokyo): 26 bảng, RLS mọi bảng, trigger đăng ký / xóa tài khoản, 3 migration đã chạy, seed 11 danh mục + 53 dịch vụ, tỷ giá thật.
- `packages/shared`: tiền (BigInt, quy đổi), bộ tính ngày gia hạn (38 test + đối chiếu ngẫu nhiên), schema zod + DTO cho mọi API.
- API: xác thực JWT Supabase (+ chặn tài khoản khóa), `/me` (+ cài đặt, ngân sách, xóa tài khoản), thư viện dịch vụ, subscription CRUD (giới hạn gói Free), `/home`, phương thức thanh toán, lịch, đánh giá tháng, phân tích, push token, nhắc nhở BullMQ + Expo Push + push receipt, job tỷ giá hằng ngày.
- Test: shared 51 · API 71 unit + 36 e2e (CI) · 27 tích hợp trên Supabase + Redis thật (`test:int`).
- Tài liệu: `README.md`, `CLAUDE.md` (hướng dẫn cho phiên Claude mới), `docs/ARCHITECTURE.md`.

**Việc của chủ dự án (đang chờ)**
1. **Đổi mật khẩu database Supabase** (đã lộ trong chat) rồi sửa `DATABASE_URL` / `DIRECT_URL` trong `apps/api/.env`.
2. **Thêm `SUPABASE_SERVICE_ROLE_KEY` vào `apps/api/.env`** (thiếu thì `DELETE /me` trả 503). Không gửi khóa qua chat.
3. Quyết định có chuyển project dev từ Tokyo sang Singapore (production bắt buộc Singapore).
4. **Đăng ký Apple Developer + Google Play** (khâu chờ lâu; cần cho đăng nhập Apple/Google, mua trong app, push thật).
5. Xác minh giá các gói trong seed.
6. **Sửa template email Supabase** (Authentication → Emails: *Magic Link* và *Confirm signup*) thêm `{{ .Token }}` để email có mã OTP cho app, và đặt *Email OTP Length* = **6** (app chỉ nhận đúng 6 số; Supabase không hỗ trợ dưới 6). SMTP mặc định của Supabase chỉ gửi tới email thành viên project.

**Việc kỹ thuật tiếp theo (gợi ý thứ tự)**
1. **App mobile:** ~~design system từ mockup~~ → ~~đăng nhập email OTP~~ → ~~Trang chủ (`GET /home`)~~ → ~~Danh sách / Thêm / Chi tiết subscription~~ → ~~Lịch~~ → ~~đăng ký push token~~ → ~~Phương thức thanh toán~~ → ~~Quản lý Trial~~ → ~~Cài đặt~~ → ~~Đánh giá tháng~~ → ~~Phân tích~~ → ~~Ngân sách~~ → màn Thông báo (lịch sử nhắc + cài mốc nhắc) → thông báo cục bộ dự phòng → rà soát UI Android.
2. Ghi nguồn tỷ giá "ExchangeRate-API" nơi hiện số đã quy đổi (bắt buộc) — Trang chủ app đã có; các màn sau cũng phải có.
3. Giai đoạn 3: Subca Plus (RevenueCat), chia tiền nhóm (API + VietQR), admin v1.

---

## A. Thiết kế & prototype

- [x] Mockup app mobile, 16 màn: Onboarding, Trang chủ, Danh sách, Thêm, Chi tiết, Lịch, Trial, Đánh giá, Phân tích, Ngân sách, Thanh toán, Chia tiền nhóm, Chi tiết nhóm, Subca Plus, Thông báo, Cài đặt
- [x] Logo thật của các hãng (Simple Icons, nhúng inline, chỉ logo, không khung)
- [x] Màn chia tiền gói gia đình (chia đều / tùy chỉnh, QR, nhắc, link mời)
- [x] Paywall Subca Plus (so sánh Free/Plus, 3 gói, timeline dùng thử, FAQ, luồng mua)
- [x] Mockup admin, 12 trang: Tổng quan, Người dùng, Tăng trưởng, Doanh thu, Gói & khuyến mãi, Thư viện dịch vụ, Sử dụng tính năng, Thông báo, Hỗ trợ, Hệ thống, Nhân sự, Nhật ký
- [ ] Review mockup với 5–10 người dùng mục tiêu (Gen Z), ghi lại góp ý
- [ ] Chuyển design token (màu, font, bo góc, spacing) thành preset Tailwind dùng chung cho app (NativeWind) và admin
- [ ] (Tùy chọn) Dựng lại các màn chính trên Figma để làm handoff

---

## B. Kiểm chứng thị trường (song song với kỹ thuật)

- [ ] Khảo sát 200–500 người trẻ: số subscription, số tiền, có dùng chung gói không
- [ ] Landing page + form danh sách chờ
- [ ] Đăng 5–10 video TikTok/Reels dựng từ mockup, đo phản ứng
- [ ] Chốt định vị: **"Không bao giờ bị trừ tiền oan nữa"**
- [ ] Chốt tính năng khác biệt: **chia tiền gói gia đình**

---

## C. Chốt tech stack

> Đã so sánh Native (Swift + Kotlin), Flutter và React Native. **Chọn React Native + Expo** vì: 1 codebase cho iOS + Android, 1 dev mobile là đủ, cùng TypeScript với backend/admin (dùng chung kiểu dữ liệu, zod, logic), sửa lỗi không cần chờ store duyệt (EAS Update). Subca không có phần xử lý nặng nên không cần native. Phần bắt buộc native (widget, Live Activity, đọc SMS ngân hàng) viết bằng Swift/Kotlin qua Expo Modules khi cần.

**Mobile**
- [x] **React Native + Expo** (SDK 57, React Native 0.86, New Architecture), TypeScript chế độ strict
- [x] Điều hướng: **Expo Router** (điều hướng theo file, deep link sẵn)
- [ ] Gọi API + cache: **TanStack Query** (có lưu cache xuống máy) _(TanStack Query đã dùng; chưa lưu cache xuống máy)_
- [ ] State cục bộ: **Zustand**
- [ ] Form: **react-hook-form + zod** (dùng chung schema với backend)
- [x] Giao diện: **NativeWind** 4.2 (Tailwind 3, token trong `apps/mobile/src/theme/tokens.json`) + **Reanimated** + Gesture Handler
- [ ] Danh sách dài: **FlashList**
- [ ] Biểu đồ: **Victory Native** (vẽ bằng Skia)
- [x] Ảnh/logo: **expo-image** (có cache); logo dịch vụ dạng SVG (`react-native-svg`), sinh từ Simple Icons bằng `pnpm --filter @subca/mobile logos:generate`
- [ ] Lưu dữ liệu trên máy: **MMKV** (nhanh) cho cache/cài đặt, **expo-secure-store** cho token _(phiên đăng nhập: MMKV mã hóa AES-256, khóa trong SecureStore — vì SecureStore giới hạn ~2 KB; cache chưa làm)_
- [ ] Đăng nhập: `@supabase/supabase-js` + `expo-apple-authentication` + `@react-native-google-signin/google-signin` _(supabase-js + email OTP đã làm; Apple/Google chờ tài khoản store)_
- [ ] Mua trong app: **RevenueCat** (`react-native-purchases`)
- [ ] Thông báo: **expo-notifications** (push + thông báo cục bộ) _(push đã làm; thông báo cục bộ dự phòng chưa làm)_
- [ ] Widget / Live Activity (giai đoạn sau): viết Swift/Kotlin qua **Expo Modules** / `expo-apple-targets`
- [ ] Build & phát hành: **EAS Build / Submit / Update** (development build, không dùng Expo Go cho bản thật) _(đã tạo EAS project `@nvdeekay/subca`; chưa cấu hình eas.json / build)_

**Backend & hạ tầng**
- [x] **Push:** Expo Push Service (gửi cho cả iOS và Android qua 1 API); sau có thể chuyển sang FCM/APNs trực tiếp
- [x] **Backend:** NestJS 12 **chạy trên Fastify** (thay Express mặc định) + Prisma 7.10 với `@prisma/adapter-pg` (kết nối tới Postgres của Supabase)
  - Đã cân nhắc Go: không chọn, vì ở quy mô Subca phần xử lý của backend chỉ tốn vài ms trên tổng 50–100 ms người dùng chờ; giữ TypeScript để mobile, backend và admin dùng chung kiểu dữ liệu, zod và logic
  - Xem lại khi có phần xử lý nặng (ví dụ đọc hàng triệu email hóa đơn): có thể tách riêng service đó sang Go
- [x] **Tác vụ nền:** BullMQ 6 + Redis (dev: `docker compose`, OrbStack; production: Redis cùng khu vực với API, giá cố định — không dùng Upstash tính theo số lệnh)
- [ ] **Đăng nhập:** **Supabase Auth** (Apple, Google, email OTP); NestJS xác minh JWT của Supabase ở mọi request
- [x] **Database:** **Supabase** (PostgreSQL 17), gói Pro cho production (gói Free tự tạm dừng khi không hoạt động, không có backup hằng ngày)
  - Project dev hiện ở **Tokyo (`ap-northeast-1`)**; project production phải chọn **Singapore (`ap-southeast-1`)**
- [ ] **Admin:** Next.js + shadcn/ui (Vercel) _(Next.js 16 + Tailwind 4 đã khởi tạo; shadcn/ui và Vercel chưa làm)_
- [ ] **Phân tích sản phẩm / feature flag / A/B:** PostHog
- [ ] **Theo dõi lỗi:** Sentry (`@sentry/react-native` + API)
- [ ] **Email:** Resend (kiêm SMTP riêng cho Supabase Auth) · **Lưu file:** Supabase Storage
- [ ] **Hosting API:** Railway / Render / Fly.io, khu vực Singapore (cùng khu vực với Supabase)
- [x] **Repo:** Turborepo + pnpm 11 (`apps/mobile`, `apps/api`, `apps/admin`, `packages/shared`), GitHub `nvdekay/Subca`
- [ ] **CI/CD:** GitHub Actions + EAS Build / Submit / Update _(CI GitHub Actions đã chạy: build, typecheck, test, lint, prisma validate; EAS chưa cấu hình)_

---

## C2. Hiệu năng & trải nghiệm (áp dụng từ đầu)

- [ ] **Cập nhật giao diện ngay (optimistic update)** với TanStack Query: Thêm, Sửa, Hủy, Đã nhận tiền… đổi màn hình liền, server xử lý phía sau, lỗi thì hoàn tác
- [ ] **Lưu cache xuống máy** (TanStack Query persist + MMKV): mở app hiện ngay dữ liệu lần trước rồi mới làm mới
- [ ] Hàng đợi thao tác khi mất mạng (TanStack Query mutation persist), có mạng thì gửi lại
- [ ] Danh sách dùng **FlashList**; animation chạy trên UI thread bằng **Reanimated** (không animate bằng state React)
- [ ] Logo dịch vụ đóng gói sẵn dạng SVG trong app; ảnh từ mạng qua `expo-image` (cache đĩa)
- [ ] Giữ bundle JS gọn: lazy load màn ít dùng, bật Hermes (mặc định), theo dõi kích thước bundle mỗi bản build
- [ ] Đo thời gian mở app (cold start) và FPS trên **máy Android tầm trung** (không chỉ test trên iPhone đời mới)
- [ ] **API đặt cùng khu vực với Supabase** (production: Singapore; lệch khu vực có thể tốn thêm khoảng 200 ms mỗi truy vấn)
- [ ] **Index database** ngay trong migration đầu tiên:
  - [x] `subscriptions (user_id, status)`
  - [x] `subscriptions (next_renewal_date)`
  - [x] `reminders (subscription_id, kind, offset_days, due_date)` (unique)
  - [x] `group_payments (group_id, status)` + `group_cycles (group_id, period)` (unique)
- [ ] **Tính sẵn số liệu thống kê** (tổng tháng, dữ liệu phân tích, số liệu admin) bằng tác vụ nền, không cộng lại toàn bộ dữ liệu mỗi lần mở app
- [ ] **Dùng connection pooler của Supabase** (Supavisor) cho API
- [ ] **Một màn một request:** endpoint gộp cho Trang chủ (`GET /home`), Phân tích, Chi tiết nhóm
- [ ] **Việc chậm đưa vào hàng đợi BullMQ:** gửi push, xuất PDF/CSV, webhook thanh toán; API trả kết quả ngay
- [ ] Nén response (gzip/brotli), chỉ trả các trường màn hình cần
- [ ] Đo và đặt ngưỡng: API p95 < 200 ms, Trang chủ hiện dữ liệu < 1 giây kể từ khi mở app

---

## D. Giai đoạn 0: Chuẩn bị (tuần 1–2)

> Mốc thời gian (tuần 1–16) tính cho team 2 người: 1 mobile (React Native), 1 backend/admin. Nếu chỉ có 1 người làm toàn bộ thì tính khoảng 5–6 tháng, hoặc dời chia tiền nhóm sang bản 1.1.

### Tài khoản (làm ngay, có khâu chờ lâu)
- [ ] **Apple Developer** (99 USD/năm), nếu đăng ký dưới tên công ty thì cần số D-U-N-S (1–2 tuần)
- [ ] Google Play Console (25 USD)
- [ ] RevenueCat
- [ ] Supabase: tạo 2 project riêng (staging + production) _(đã có project dev/staging `lvnjhgmjmgxonbmsvtag` ở Tokyo; chưa có production)_
- [ ] **Đổi mật khẩu database Supabase** (mật khẩu hiện tại đã bị gửi qua chat) và cập nhật `apps/api/.env`
- [x] GitHub repo `nvdekay/Subca`
- [ ] Sentry
- [ ] PostHog
- [ ] Tên miền `subca.app` + email tên miền

### Codebase
- [x] Tạo monorepo Turborepo + pnpm (`apps/mobile`, `apps/api`, `apps/admin`, `packages/shared`)
- [x] Khởi tạo app Expo (TypeScript, Expo Router), đặt bundle ID / application ID `app.subca`
- [ ] Cấu hình `eas.json`: profile `development` / `preview` / `production`, kênh EAS Update tương ứng
- [ ] Để EAS quản lý chứng chỉ iOS và keystore Android
- [x] ESLint, Prettier, TypeScript chế độ strict cho toàn repo
- [x] GitHub Actions: lint + test cho mỗi PR
- [ ] 3 môi trường: dev / staging / prod, quản lý biến môi trường và secrets

### Dữ liệu & logic lõi
- [x] Kết nối Supabase dev: `apps/api/.env` (DATABASE_URL pooler 6543 + DIRECT_URL 5432), `prisma migrate deploy` đã chạy 2 migration
- [x] Kiểm tra trên Supabase: 26/26 bảng bật RLS, 2 trigger trên `auth.users`, `anon`/`authenticated` không có quyền đọc, API `/health` → `db: up`
- [ ] Test trigger đăng ký thật: tạo user ở Authentication → Users, kiểm tra profile + settings + 4 quy tắc nhắc mặc định, xóa user kiểm tra dọn dữ liệu
- [x] Schema Prisma v1 (xem mục I)
- [x] Cấu hình Prisma cho Supabase: `DATABASE_URL` dùng connection pooler (Supavisor, cổng 6543, `pgbouncer=true`) cho API; `DIRECT_URL` (cổng 5432) cho migration
- [x] Bảng `profiles` liên kết `auth.users(id)`, tự tạo bằng trigger khi người dùng đăng ký
- [x] **Bật Row Level Security (RLS) cho mọi bảng trong schema `public`**, mặc định không có policy → app dùng anon key không đọc/ghi thẳng được DB; mọi truy cập đi qua NestJS
- [ ] Không bao giờ đưa `service_role` key vào app mobile hay admin phía trình duyệt, chỉ dùng ở backend _(quy tắc áp dụng suốt dự án)_
- [x] Seed dữ liệu đợt 1 (`pnpm --filter @subca/api prisma:seed`, chạy lại không tạo trùng): 11 danh mục hệ thống, 53 dịch vụ, 15 gói, 2 feature flag — đã chạy trên Supabase dev
- [ ] **Xác minh giá các gói trong seed** với trang chính thức (hiện là giá tham khảo)
- [ ] Mở rộng thư viện lên khoảng 200 dịch vụ + bổ sung link/hướng dẫn hủy
- [x] Bộ tính ngày gia hạn trong `packages/shared/src/renewal.ts` (server là nguồn chính; app dùng cùng hàm để xem trước khi nhập liệu), có unit test cho các trường hợp:
  - [x] Ngày 31 → tháng 2 (28/29) → quay lại 31
  - [x] Năm nhuận
  - [x] Chu kỳ tuần / quý / năm / N tháng
  - [x] Trial: ngày hết hạn và ngày tính phí đầu tiên
  - [x] Múi giờ người dùng (kể cả múi giờ có giờ mùa hè)
  - [x] Test đối chiếu ngẫu nhiên 3.000 trường hợp với cách lặp từng kỳ
- [x] Schema zod + kiểu dữ liệu dùng chung cho mobile, API và admin (`packages/shared`)

### Pháp lý
- [ ] Chính sách quyền riêng tư (bắt buộc để lên store)
- [ ] Điều khoản sử dụng
- [ ] Rà soát Nghị định 13/2023 và Luật Bảo vệ dữ liệu cá nhân (xác nhận lại ngày hiệu lực với người làm pháp lý)

---

## E. Giai đoạn 1: Lõi MVP (tuần 3–8)

> Làm xong mỗi mục cả backend lẫn mobile rồi mới sang mục sau.

- [ ] **Đăng nhập bằng Supabase Auth** + onboarding
  - [ ] Sign in with Apple (bắt buộc trên iOS khi có Google): `expo-apple-authentication` → `signInWithIdToken`
  - [ ] Google: `@react-native-google-signin/google-signin` → `signInWithIdToken`
  - [ ] Android: Sign in with Apple qua luồng OAuth web của Supabase (để người dùng đổi máy vẫn đăng nhập được)
  - [ ] Email OTP (SMTP riêng qua Resend; SMTP mặc định của Supabase bị giới hạn số email) _(app: màn chào → nhập email → nhập mã đã xong; còn SMTP Resend + template email có `{{ .Token }}`)_
  - [x] Lưu phiên (MMKV mã hóa, khóa trong `expo-secure-store`), tự làm mới token khi app mở; API client: `TOKEN_EXPIRED` → làm mới rồi gọi lại 1 lần, `ACCOUNT_BANNED`/token hỏng → đăng xuất
  - [x] NestJS: guard toàn cục xác minh JWT Supabase (JWKS ES256, kiểm issuer/audience/role/hạn), `@Public()`, `@CurrentUser()`, lỗi 401 có `code` (`TOKEN_EXPIRED` / `INVALID_TOKEN` / `UNAUTHENTICATED`)
  - [x] `GET /me`: hồ sơ + cài đặt + gói FREE/PLUS + giới hạn Free; chặn tài khoản bị khóa (403); ghi `last_active_at` tối đa 1 lần/giờ
  - [ ] Test đầu-cuối với token Supabase thật (cần user thử + publishable key)
  - [x] Chặn tài khoản bị khóa ở mọi endpoint (403 `ACCOUNT_BANNED`), cache 60 giây, có `invalidate()` cho admin
- [ ] **Subscription:** thêm / sửa / xóa + thư viện khoảng 200 dịch vụ phổ biến ở Việt Nam
  - [x] API: `GET/POST/PATCH/DELETE /subscriptions`, tự tính kỳ gia hạn theo múi giờ người dùng, trial, hủy/mở lại, lưu trữ (xóa mềm), kiểm tra quyền sở hữu và ID tham chiếu, giới hạn 8 subscription gói Free (403 `PLAN_LIMIT_REACHED`)
  - [x] API thư viện: `GET /catalog/categories`, `GET /catalog/services`
  - [x] Schema đầu vào dùng chung (`packages/shared/src/api`) cho API và form trong app
  - [x] Test tích hợp trên Supabase thật (`test:int`, 11 test, tự dọn dữ liệu)
  - [x] Màn Thêm (chọn nhanh, giá, tiền tệ, chu kỳ, ngày, phương thức, mốc nhắc, tự gia hạn, ghi chú) + màn Sửa dùng chung form (chỉ gửi trường đã đổi) _(form dùng state + schema zod chung, chưa dùng react-hook-form)_
  - [x] Màn Danh sách (tìm kiếm không dấu, 5 bộ lọc có đếm, giới hạn gói Free)
  - [x] Màn Chi tiết (lịch sử, mức độ sử dụng, hướng dẫn hủy, lưu trữ, đánh dấu cần xem lại, dùng lại gói đã hủy); API `GET /subscriptions/:id` trả thêm thanh toán, hướng dẫn hủy, lịch sử trừ tiền
- [ ] **Trang chủ:** tổng tiền theo tháng, số đang hoạt động, sắp gia hạn, trial, cảnh báo
  - [x] API `GET /home` (1 request cho cả màn): tổng tháng/năm quy đổi tiền tệ, trial, sắp gia hạn 7 ngày, có thể tiết kiệm, ngân sách, 5 khoản sắp tới, `missingRates`
  - [x] Màn Trang chủ trong app (thẻ tổng, 4 ô thống kê, ngân sách, sắp gia hạn, trial, kéo để làm mới, ghi nguồn tỷ giá) _(chưa có: % so với tháng trước, chia tiền nhóm, lối tắt, banner Plus)_
- [ ] **Nhắc nhở:**
  - [x] Đăng ký push token (`POST/DELETE /push-tokens`, token chuyển sang tài khoản mới khi máy đổi tài khoản)
  - [x] Lượt chạy mỗi 5 phút: đẩy kỳ gia hạn đã qua (ghi lịch sử trừ tiền, trial → ACTIVE/CANCELLED), sinh lượt nhắc 26 giờ tới theo múi giờ + giờ nhắc từng người, đưa vào hàng đợi
  - [x] Hàng đợi BullMQ → **Expo Push Service** (`expo-server-sdk`): kiểm tra lại trước khi gửi, thử lại 3 lần khi lỗi mạng, xóa token khi máy đã gỡ app, hết lần thử → FAILED
  - [x] Khóa duy nhất `(subscription_id, kind, offset_days, due_date)` + jobId = ID lượt nhắc → không gửi trùng
  - [x] Redis dev bằng `docker compose` (OrbStack), `noeviction` + AOF
  - [x] Kiểm tra **push receipt** của Expo mỗi 15 phút (xác nhận đã tới máy, xóa token lỗi) và `POST /reminders/:id/opened` ghi `opened_at` khi người dùng bấm thông báo
  - [ ] Trang admin theo dõi hàng đợi (Bull Board) và thống kê lượt nhắc
  - [ ] Thông báo cục bộ làm dự phòng (`expo-notifications`): app lấy danh sách nhắc 30 ngày tới từ server và tự lên lịch (iOS giới hạn 64 thông báo chờ → chỉ lên lịch các mốc gần nhất)
  - [x] Xin quyền thông báo đúng lúc (sau khi thêm subscription đầu tiên, có hộp thoại giải thích trước hộp thoại hệ thống); Android 13+ cần quyền `POST_NOTIFICATIONS` (expo-notifications tự khai báo)
  - [x] App đăng ký push token mỗi lần mở (nếu đã cho phép), gỡ token trước khi đăng xuất; bấm thông báo → ghi `opened` + mở màn Chi tiết _(chưa thử nhận push thật trên máy)_
  - [ ] Màn Thông báo + cài đặt mốc nhắc (30 / 7 / 1 ngày, ngày gia hạn, trial, gia hạn năm)
- [x] **Lịch gia hạn** (lịch tháng, bấm ngày để lọc)
  - [x] API `GET /calendar?month=` (gộp theo ngày, ngày hết trial, tổng tháng quy đổi)
  - [x] Màn Lịch trong app (ngày có gia hạn tô màu, từ 500K màu đào, chấm màu thương hiệu, tổng tháng, danh sách theo ngày)
- [x] **Quản lý Trial** (đếm ngày, Giữ / Nhắc tôi / Hủy) — màn trong app, dùng lại API subscription
- [ ] **Cài đặt:** hồ sơ, tiền tệ, múi giờ, giờ nhắc, ngôn ngữ _(app đã có: tên, tiền tệ chính, múi giờ, bật/tắt + giờ nhắc, ngân sách, đăng xuất; chưa có: ngôn ngữ)_
  - [x] API `PATCH /me`, `PATCH /me/settings` (kiểm tra múi giờ hợp lệ)
- [ ] **Xóa tài khoản** trong app (Apple bắt buộc): backend xóa dữ liệu rồi gọi `auth.admin.deleteUser` của Supabase _(nút trong Cài đặt đã có, xác nhận trước khi xóa; chờ service role key để chạy thật)_
  - [x] API `DELETE /me` (gọi Supabase Admin, trigger xóa toàn bộ dữ liệu) — **cần thêm `SUPABASE_SERVICE_ROLE_KEY` vào `apps/api/.env`**, thiếu thì trả 503
- [ ] Gắn Sentry + PostHog (sự kiện onboarding, thêm subscription, bật nhắc)
- [ ] Build TestFlight nội bộ + Google Play Internal testing (EAS Build + EAS Submit)
- [ ] Rà soát UI trên cả 2 nền tảng: nút back Android, safe area, bàn phím che ô nhập, cỡ chữ lớn (accessibility)

---

## F. Giai đoạn 2: Hoàn thiện giá trị (tuần 9–12)

- [x] Đánh giá hằng tháng (Giữ / Xem lại / Hủy, gợi ý tiết kiệm) — màn trong app, cập nhật giao diện ngay khi bấm (optimistic) _("Gợi ý từ Subca" để dành cho gói Plus, chưa làm)_
  - [x] API `GET /reviews`, `PUT/DELETE /reviews/:subscriptionId` (đồng bộ trạng thái REVIEW/ACTIVE, tổng tiết kiệm)
- [x] Ngân sách (hạn mức, cảnh báo vượt, mô phỏng "nếu hủy thì tiết kiệm bao nhiêu") — màn Ngân sách (đồng hồ, cảnh báo, mô phỏng chọn sẵn các gói đánh dấu Hủy ở Đánh giá tháng), mở từ thẻ ngân sách ở Trang chủ / Cài đặt
  - [x] API `GET/PUT/DELETE /me/budget`; tình trạng ngân sách (đã chi, %, vượt) trả trong `/home`
- [x] Phân tích (xu hướng, dự tính năm, chi phí mỗi lần dùng, top đắt nhất, theo phương thức thanh toán)
  - [x] API `GET /analytics` (xu hướng 6 tháng là ước tính từ các gói còn hoạt động mỗi tháng; chi phí mỗi lần dùng theo mức độ sử dụng người dùng chọn)
- [x] Phương thức thanh toán (chỉ lưu nhãn + 4 số cuối) — chọn / tạo nhanh ngay trong form subscription (chip "+ Thêm"); màn quản lý phụ trong Cài đặt: thẻ gradient, xem gói theo thẻ, sửa/xóa, mặc định
  - [x] API `/payment-methods`: chỉ nhận 4 số cuối, luôn đúng 1 phương thức mặc định (transaction), lưu trữ thì gỡ khỏi subscription, kèm số subscription và tổng tháng quy đổi
- [ ] Xuất dữ liệu CSV / PDF (tác vụ nền → gửi qua email)
- [x] Tỷ giá tự cập nhật hằng ngày (job 07:30 giờ VN + cập nhật khi khởi động nếu cũ): nguồn chính ExchangeRate-API (Open Access), dự phòng fawazahmed0/currency-api; kiểm tra khoảng hợp lý trước khi lưu; lưu 12 cặp VND/USD/EUR/JPY; lệnh `fx:sync` — đã nạp tỷ giá thật vào Supabase dev
- [ ] **App + admin: hiển thị ghi nguồn "Tỷ giá: ExchangeRate-API" (có link) ở nơi hiện số đã quy đổi** — bắt buộc theo điều khoản; không phân phối lại dữ liệu tỷ giá
- [ ] Khi chạy nhiều instance API: chỉ bật `FX_SYNC_ENABLED` ở 1 instance (chạy trùng vẫn an toàn nhưng tốn request)
  - [x] Quy đổi tiền tệ khi tính tổng (`FxService`, `convertMinor`), không đoán khi thiếu tỷ giá
- [ ] **Beta kín 100–300 người**
  - [ ] Đo tỷ lệ thêm được ≥ 3 subscription ngày đầu
  - [ ] Đo tỷ lệ còn dùng sau 7 và 30 ngày
  - [ ] Thu góp ý, sửa lỗi

---

## G. Giai đoạn 3: Kiếm tiền + chia tiền nhóm → Ra mắt (tuần 13–16)

### Subca Plus
- [ ] Tạo sản phẩm trên App Store Connect và Google Play: Tháng 29.000đ, Năm 199.000đ, Trọn đời 399.000đ
- [ ] Dùng thử 7 ngày cho gói Tháng và Năm
- [ ] RevenueCat (`react-native-purchases`) + webhook → bảng `entitlements`
- [ ] Cấu hình Server Notifications (App Store) và Real-time Developer Notifications (Google Play) trỏ về RevenueCat
- [ ] Paywall (theo mockup), hiện sau khi người dùng thêm subscription thứ 3
- [ ] Khóa tính năng theo gói: Free tối đa 8 subscription, 1 mốc nhắc, 1 nhóm
- [ ] Nhắc chính người dùng 2 ngày trước khi hết dùng thử Plus
- [ ] Khôi phục giao dịch

### Chia tiền nhóm
- [ ] Tạo nhóm từ subscription, chọn số người (2–6)
- [ ] Chia đều / tùy chỉnh, kiểm tra tổng khớp giá gói
- [ ] Link mời `subca.app/j/...`: Expo Router + Universal Links (file `apple-app-site-association`) + Android App Links (file `assetlinks.json`)
- [ ] QR chuyển khoản theo chuẩn **VietQR (NAPAS / EMVCo)**
- [ ] Đánh dấu đã nhận, "Tôi đã chuyển", nhắc thành viên chưa trả
- [ ] Lịch sử theo tháng

### Admin v1
- [ ] Đăng nhập admin bằng Supabase Auth + bắt buộc MFA (TOTP) + phân quyền theo vai trò (bảng `admin_roles`)
- [ ] Người dùng (tìm kiếm, chi tiết, khóa, tặng Plus, xóa dữ liệu)
- [ ] Doanh thu (lấy từ RevenueCat)
- [ ] Thư viện dịch vụ + duyệt đề xuất giá
- [ ] Nhật ký thao tác (audit log)
- [ ] Dashboard tổng quan, số liệu phễu và cohort lấy từ PostHog

### Ra mắt
- [ ] Ảnh chụp màn hình + mô tả trên store (ASO: "quản lý subscription", "nhắc gia hạn", "hủy đăng ký")
- [ ] Nộp duyệt App Store + Google Play (dự trù 1–2 tuần, nhất là phần mua trong app)
- [ ] Trang hỗ trợ + email hỗ trợ
- [ ] Theo dõi Sentry, uptime, hàng đợi trong tuần đầu

---

## H. Giai đoạn 4: Tăng trưởng (sau ra mắt)

- [ ] Thẻ tổng kết "Subscription Wrapped" (tháng / năm) để chia sẻ
- [ ] Chương trình giới thiệu: mời 1 bạn, cả hai được 1 tháng Plus
- [ ] Widget màn hình chính: viết native (WidgetKit cho iOS qua `expo-apple-targets`, Glance cho Android qua Expo Module), đọc dữ liệu chia sẻ từ app
- [ ] (iOS) Live Activity cho khoản sắp bị trừ tiền trong ngày
- [ ] Mã khuyến mãi (GENZ50, TIKTOK30, SINHVIEN…)
- [ ] Thử nghiệm A/B giá paywall (PostHog)
- [ ] Bản tiếng Anh → thị trường Đông Nam Á / quốc tế, ra mắt trên Product Hunt
- [ ] Thanh toán web qua MoMo / ZaloPay / thẻ (kiểm tra quy định store trước)
- [ ] Đọc biến động số dư ngân hàng (chỉ Android)
- [ ] Đọc hóa đơn trong Gmail (cần thẩm định bảo mật của Google, tốn vài tuần + có phí → làm sau cùng)
- [ ] Chiến dịch push / email từ admin

---

## I. Schema dữ liệu v1

- [x] `profiles` (liên kết `auth.users`), `user_settings` (tiền tệ, múi giờ, giờ nhắc, ngôn ngữ), `push_tokens`
- [x] `subscriptions` (service_id / tên tự nhập, amount_minor, currency, interval_unit, interval_count, anchor_day, start_date, next_renewal_date, status, trial_end_date, payment_method_id, category_id, auto_renew, usage_frequency, notes)
- [x] `renewal_history`, `reminders`, `monthly_reviews`, `budgets`
- [x] `payment_methods` (loại, nhãn, 4 số cuối, **không** lưu số thẻ)
- [x] `services`, `service_plans`, `price_reports`, `categories`, `exchange_rates`
- [x] `groups`, `group_members`, `group_cycles`, `group_payments`
- [x] `entitlements`, `promo_codes`, `feature_flags`
- [x] `admin_users`, `admin_roles`, `audit_logs`

**Quy tắc:**
- [x] Tiền lưu `bigint` theo đơn vị nhỏ nhất + mã tiền tệ (không dùng float)
- [x] Chu kỳ = `interval_unit` + `interval_count`
- [x] Lưu `anchor_day` để xử lý ngày 29–31
- [x] Múi giờ theo từng người dùng (mặc định `Asia/Ho_Chi_Minh`)
- [x] Xóa mềm subscription (`archived`), xóa thật khi người dùng xóa tài khoản

---

## J. Rủi ro cần theo dõi

- [ ] Mật khẩu database dev đã lộ qua chat → đổi mật khẩu (xem mục D)
- [x] `pnpm` bị treo khi turbo chạy song song: nguyên nhân là `pnpm run` tự chạy `pnpm install` cùng lúc → đã tắt bằng `verifyDepsBeforeRun: warn`; sau khi đổi dependency nhớ chạy `pnpm install` thủ công
- [ ] Quên bật RLS ở bảng mới → thêm bước kiểm tra RLS vào CI / checklist review migration
- [ ] Hết kết nối DB khi API scale → luôn dùng connection pooler của Supabase
- [ ] Backup: bật backup hằng ngày (gói Pro), cân nhắc Point-in-Time Recovery khi có doanh thu
- [ ] Push trễ hoặc mất (iOS tiết kiệm pin, Android một số hãng như Xiaomi/Oppo/Samsung chặn chạy nền) → thông báo cục bộ làm dự phòng + màn hướng dẫn tắt tối ưu pin
- [ ] Nâng cấp Expo SDK / React Native có thể vỡ thư viện native → nâng cấp theo lịch mỗi SDK, ưu tiên thư viện nằm trong hệ sinh thái Expo
- [ ] EAS Update chỉ sửa được code JS/asset; thay đổi native (thêm thư viện, quyền mới) vẫn phải build và nộp store → dùng `runtimeVersion` đúng cách để không đẩy bản JS lên bản native không tương thích
- [ ] Hiệu năng trên máy Android yếu → test định kỳ trên máy tầm trung, dùng FlashList + Reanimated
- [ ] Ngày gia hạn tính sai → unit test đầy đủ ở Giai đoạn 0
- [ ] Logo thương hiệu: chỉ dùng để nhận diện dịch vụ, không dùng trong quảng cáo theo kiểu gợi ý là đối tác
- [ ] Quy định store về thanh toán ngoài app: kiểm tra lại trước khi làm thanh toán web
- [ ] Quyền riêng tư: không bán dữ liệu, ghi rõ trên trang giới thiệu

---

## K. Chỉ số theo dõi

- [ ] Độ trễ API p95 (mục tiêu < 200 ms) và thời gian Trang chủ hiện dữ liệu (mục tiêu < 1 giây)
- [ ] Tỷ lệ thêm ≥ 3 subscription ngày đầu (kích hoạt)
- [ ] Tỷ lệ còn dùng sau 1 / 7 / 30 ngày
- [ ] Tỷ lệ chuyển sang trả phí (mục tiêu 3–5%)
- [ ] Tỷ lệ rời bỏ gói Plus hằng tháng
- [ ] MRR, số người trả phí, doanh thu / người trả phí
- [ ] Số thành viên được mời vào mỗi nhóm chia tiền (hệ số lan truyền)
- [ ] Tỷ lệ mở thông báo nhắc, tỷ lệ tắt thông báo
- [ ] Tỷ lệ phiên không crash (≥ 99,5%)
