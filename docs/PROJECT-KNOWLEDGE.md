# Subca — Project Knowledge Base

> **Nguồn sự thật trung tâm cho Claude, Codex và người phát triển.**  
> Cập nhật: **01/10/2026** · Snapshot commit: `fa11acf` + đợt onboarding/auth 01/10 · Repo: `nvdekay/Subca`
> Snapshot theo code và Git ngày 01/10; xem `git status` / `git diff` để nhận biết thay đổi sau snapshot. Không coi kết quả runtime/QA cũ là trạng thái hiện tại.

## 1. Cách dùng trong một session mới

1. Đọc hết file này. Không cần quét toàn bộ codebase để hiểu lại dự án.
2. Chạy `git status --short` và `git log -5 --oneline` để nhận biết thay đổi sau snapshot.
3. Chỉ đọc code, test và tài liệu chi tiết liên quan trực tiếp đến task.
4. Trước khi kết thúc một thay đổi có ý nghĩa, cập nhật lại file này theo mục 14.

Thứ tự ưu tiên khi thông tin mâu thuẫn:

1. Code/migration đang chạy và test trong đúng phạm vi được hỏi.
2. File này.
3. `docs/ARCHITECTURE.md` (lý do và chi tiết quyết định).
4. `docs/SUBCA-CHECKLIST.md` (backlog/checklist chi tiết; có thể chứa mục lịch sử chưa được dọn).
5. README của từng app.

Không lưu secret, token, mật khẩu, key hoặc connection string thật trong knowledge base.

## 2. Tóm tắt sản phẩm

Subca là ứng dụng quản lý subscription cá nhân, ưu tiên người trẻ Việt Nam. Giá trị chính: tự phát hiện gói đang trả tiền, nhắc trước khi gia hạn/trial hết hạn, theo dõi chi tiêu, đánh giá gói hằng tháng và chia tiền gói gia đình.

Định hướng hiện tại là **auto-first**:

- Tự phát hiện subscription từ hóa đơn email là luồng chính đang được phát triển.
- Nhập tay vẫn được giữ làm phương án dự phòng và để chỉnh dữ liệu.
- Định vị dự kiến: **“Không bao giờ bị trừ tiền oan nữa.”**
- Tính năng khác biệt: **chia tiền gói gia đình**.
- Danh mục đã bị bỏ khỏi sản phẩm và API; bảng/cột cũ vẫn còn trong DB nhưng không dùng.

## 3. Hiện trạng ngắn gọn

### Snapshot hiện tại (01/10/2026)

- **Sản phẩm:** các luồng lõi subscription, nhắc gia hạn, trial, review, phân tích, ngân sách, phương thức thanh toán và chia tiền nhóm đã có app + API. Admin Console v1 có overview, users, catalog, features, system, queues, team và audit. Chưa phát hành hoặc có môi trường production.
- **Mobile V2:** intro trước đăng nhập gồm “Xin chào.” và ba cảnh gom gói, nhắc gia hạn, chi tiêu/chia tiền. Ba cảnh đã rút gọn chữ; “Xin chào.” tự chuyển sau 3 giây khi phù hợp accessibility, các cảnh sau do người dùng điều khiển. Sau đăng nhập, route `welcome` bắt đầu thẳng ở kết nối email; hai màn giới thiệu cũ “Subca / Bắt đầu” và “Subca làm phần việc nhàm chán” đã bị xóa khỏi code. Nút bỏ qua kết nối email thay route hiện tại bằng Trang chủ, không mở form thêm thủ công. Tabs chính là Trang chủ / Gói của tôi / Cần chú ý / Phân tích với CTA thêm ở giữa; Lịch và Review là route phụ. Các màn nhóm, ngân sách, thanh toán, thông báo, hồ sơ và Gmail vẫn giữ. Prototype `design/Subca V2.html` chỉ là tham chiếu, không phải nghiệp vụ đã triển khai.
- **Giao diện:** Mobile và Admin dùng Nunito, nền giấy sáng, mực navy-charcoal, cam và pastel, viền đậm, góc gọn, bóng offset. Tokens mobile ở `apps/mobile/src/theme/tokens.json`; Admin ở `apps/admin/src/app/globals.css` và `src/components/ui.tsx`. Sidebar Admin đứng yên trên desktop, nội dung chính cuộn riêng. Không dùng gradient; logo dịch vụ giữ màu thương hiệu. Màn kết nối Gmail trên mobile dùng biểu tượng Gmail năm màu ở bước onboarding, trạng thái đã kết nối và thẻ tài khoản.
- **Auth mobile:** đăng nhập thường bằng email + mật khẩu Supabase. Đăng ký và recovery dùng email OTP một lần rồi tạo/đặt lại mật khẩu; recovery không tự tạo user và UI không dò lộ email đã đăng ký. Pending email được xác minh lưu trong MMKV mã hóa để gate vào `set-password`; không lưu mật khẩu. Màn tạo mật khẩu đã rút gọn chữ, nút hiện/ẩn nằm trong ô nhập; từng ô báo lỗi sau blur và khi submit. Mật khẩu cần 6–72 ký tự, có chữ và số; ô nhập lại bắt buộc khớp. Mã liên quan: `(auth)/sign-in.tsx`, `(auth)/verify.tsx`, `set-password.tsx`, `features/auth/password-flow.ts`, `password.ts`, `session.tsx`. SMTP/OTP và đăng nhập lại với tài khoản thật chưa QA đầu-cuối.
- **Intro/accessibility:** minh họa code-native trong `features/onboarding/intro.tsx`, `intro-art.tsx`, `intro-phone.tsx`, dùng Reanimated sẵn có. Giảm/tắt animation theo Reduce Motion; tắt tự chuyển khi screen reader bật; timer dọn khi blur/background/unmount. Nội dung có thể cuộn, CTA ở ngoài vùng cuộn. Các cảnh gom gói và lời nhắc đã xem trên iPhone 17 Pro Simulator; cảnh chi tiêu đã rút gọn nhưng chưa xem lại vì CoreSimulatorService ngắt kết nối trong phiên 30/09. Chưa QA Android, màn nhỏ, chữ lớn và thao tác với screen reader.
- **Email detection:** đường ống Gmail adapter → parser → reconcile → subscription/Inbox đã chạy bằng hộp thư mẫu; parser nhận khoảng 65 merchant và hóa đơn gộp. Sync thủ công qua BullMQ trả `runId`, cập nhật scanned/candidate/event theo từng trang; UI polling 3 giây, có resume/retry theo run. Người dùng chọn phạm vi 1/3/6/12 tháng (mặc định 3), tối đa 400 email/lượt; scheduler incremental giữ luồng riêng. Màn scan và chi tiết gói hiển thị tiến độ, trạng thái và email evidence/thread link khi có metadata. Chưa QA Gmail thật hoặc OAuth/CASA production.
- **Admin/Auth:** Supabase Auth + `admin_users`, năm vai trò, MFA TOTP tùy chọn bằng `ADMIN_REQUIRE_MFA`. Bí danh web `admin` ánh xạ tới tài khoản dev `admin-login@subca.app` vai trò ADMIN; OWNER hiện hữu giữ nguyên. DB dev đã xác nhận user này active với một identity email; chưa QA đăng nhập qua UI. Chỉ API được đọc/ghi dữ liệu nghiệp vụ; Admin client không truy vấn DB trực tiếp.
- **Dịch vụ dev:** ngày 01/10 đã khởi động lại toàn bộ dev server: API `localhost:3000/health` trả DB up, Metro 8081 running, Admin 3100 phản hồi, Redis healthy; Quick Tunnel giữ nguyên để không đổi callback OAuth. File env API có `DATABASE_URL`, `DIRECT_URL`, `PUBLIC_API_URL`, Google OAuth client và `SECRETS_KEY`, còn thiếu `SUPABASE_SERVICE_ROLE_KEY`. Lần kiểm tra 29/09 API/DB/Redis/Metro/iOS Simulator khỏe; đây là mốc lịch sử. OAuth qua Quick Tunnel từng tới callback, nhưng Google trả 403 vì tài khoản thử chưa nằm trong Test users. Khi host tunnel đổi, cập nhật `PUBLIC_API_URL` và redirect URI.
- **Kiểm tra gần nhất:** đợt auth/palette 29/09 có Turbo build/typecheck/test/lint 12/12, shared 88 test, API 122 unit + 60 e2e, Prisma validate/Prettier qua; integration DB thật gần nhất 51 test. Các lượt tinh chỉnh intro 30/09 chỉ chạy mobile typecheck/lint/format và xem ảnh iOS khi Simulator khả dụng. Không suy rộng kết quả cũ sang code chưa kiểm chứng.

### Đã hoạt động

- Monorepo pnpm + Turborepo; CI chạy build, typecheck, test, lint và Prisma validate.
- API NestJS/Fastify, Prisma/Supabase, auth JWT, CRUD subscription, home, calendar, review, analytics, budget, payment method, reminder, push, FX và account deletion.
- Mobile Expo có đầy đủ các màn lõi, đăng nhập email/mật khẩu, OTP đăng ký/recovery, cache cục bộ, notification, group splitting, Gmail connection và Subca Inbox.
- Chia tiền nhóm chạy end-to-end trên Supabase dev, gồm chia đều/tùy chỉnh, chu kỳ tháng, claim/confirm/waive/reopen, nhắc và VietQR.
- Admin Console v1 chạy thật: đăng nhập email/password, tùy chọn MFA, 5 vai trò và các trang overview, users, catalog, features, system, queues, team, audit.
- Đường ống tự phát hiện từ email đã chạy end-to-end bằng hộp thư mẫu: Gmail adapter → parser → event → reconcile → subscription/Inbox.
- Parser v2 nhận diện khoảng 65 merchant và tách hóa đơn gộp thành nhiều sự kiện.

### Đang ở đâu

Lõi subscription, reminder, nhóm và Admin v1 đã có; Mobile và Admin cùng visual system editorial/bento. Đang hoàn thiện microcopy auth/onboarding và QA các màn. Gmail thật, OTP/password đầu-cuối, Android/push, đăng nhập tài khoản ADMIN mới và accessibility chưa xác nhận. Chưa có production hay bản phát hành. Bước tiếp theo: mở Test users cho Gmail OAuth, QA onboarding → scan → summary → Inbox, rồi QA UI đa thiết bị, bảo mật/pháp lý, EAS/store và beta.

### Blocker/việc cần chủ dự án xử lý

1. Xác minh/hoàn tất xoay thông tin đăng nhập dev từng bị lộ (database và Gmail SMTP); không ghi secret mới vào repo/chat. Trước production chuyển SMTP sang Resend + domain riêng.
2. Đang chặn QA Gmail thật: thêm tài khoản thử nghiệm hiện tại vào Google Auth Platform → Audience → Test users rồi thử consent/scan; callback Quick Tunnel đã truy cập được. Khi Quick Tunnel đổi host phải cập nhật cả `PUBLIC_API_URL` lẫn redirect URI. Go-live phải thay tunnel bằng hostname HTTPS ổn định, cấu hình redirect URI production riêng, lưu secrets production an toàn và hoàn tất yêu cầu xác minh/CASA của Google.
3. `SUPABASE_SERVICE_ROLE_KEY` đang thiếu trong `apps/api/.env` (đã kiểm tra sự hiện diện, không đọc/ghi giá trị). Cần cấu hình để xóa tài khoản và thao tác admin qua Supabase Admin API.
4. Đăng ký Apple Developer / Google Play và RevenueCat khi chốt phát hành, sign-in store, push thiết bị thật và thanh toán.
5. Tạo môi trường production ở Singapore; dev hiện ở Tokyo.
6. Xác minh giá seed và danh sách BIN VietQR với nguồn chính thức trước khi ra mắt.

### Thứ tự kỹ thuật đề xuất

1. Test đầy đủ onboarding → OAuth → enqueue scan → progress/summary → Inbox trên tài khoản Gmail thử nghiệm; xử lý retry, queue unavailable, mở app lại khi run còn chạy.
2. Xác minh/xoay secrets dev, chạy luồng xóa tài khoản thật, rà privacy disclosure/policy và CASA.
3. QA editorial UI trên Android + iOS thật/simulator, push notifications, accessibility và edge states; sửa các lỗi phát hiện được.
4. Cấu hình Sentry/PostHog, `eas.json`, development/preview builds; sau khi có tài khoản thì TestFlight / Google Play Internal testing.
5. Production hosting/DB/Redis Singapore, backup, domain, privacy policy, terms và support.
6. RevenueCat/Subca Plus, deep link mời nhóm và admin pages còn thiếu là các hạng mục sau MVP.

## 4. Bản đồ codebase

| Khu vực | Vai trò | Stack/trạng thái |
| ----------------- | ---------------------- | --------------------------------------------------------------- |
| `apps/api` | API và background jobs | NestJS 12, Fastify, Prisma 7.10, BullMQ 6, Redis, ESM |
| `apps/mobile` | App iOS/Android | Expo SDK 57, RN 0.86, Expo Router, NativeWind 4, TanStack Query |
| `apps/admin` | Admin Console | Next.js 16, React 19, Tailwind 4, TanStack Query |
| `packages/shared` | Hợp đồng dùng chung | zod schemas, DTO, enum, tiền, ngày gia hạn, VietQR, plan limits |
| `apps/api/prisma` | Database | schema, 5 migrations, seed |
| `design` | Nguồn tham chiếu UI | mockup mobile/admin, email OTP và bản thiết kế đang thử nghiệm |
| `docs` | Project memory | knowledge base, kiến trúc, checklist |

Các module API chính: `admin`, `auth`, `catalog`, `connections`, `detection`, `fx`, `groups`, `health`, `home`, `inbox`, `insights`, `me`, `payment-methods`, `push`, `queue`, `reminders`, `subscriptions`.

Mobile routes hiện có: auth/OTP; `welcome`; 4 tabs (home/subscriptions/inbox/analytics); calendar/review là route phụ; subscription list/add/detail/edit, trials, budget, payments, profile, notifications, groups và Gmail connections.

### API calls theo flow mobile V2

Các endpoint dưới đây đều qua API NestJS (không gọi DB trực tiếp từ app):

| Màn/luồng | API chính | Ghi chú |
| ----------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Onboarding và trạng thái người dùng | `GET /me`, `GET /subscriptions`, `GET /connections`, `GET /connections/summary` | Bỏ qua onboarding khi đã có gói/kết nối |
| Kết nối Gmail | `POST /connections/gmail/start`, callback `GET /connections/gmail/callback` | OAuth; token chỉ ở server |
| Quét email | `POST /connections/:id/sync`, `GET /connections/summary` | POST trả run ngay; summary polling 3 giây khi RUNNING |
| Trang chủ | `GET /home`, `GET /me`, `GET /inbox` | Tổng tháng, sắp gia hạn, profile và việc cần xác nhận |
| Danh sách gói | `GET /subscriptions`, `GET /catalog/services` | List có source/confidence/evidence count; catalog phục vụ form |
| Thêm/sửa/ẩn gói | `POST /subscriptions`, `PATCH /subscriptions/:id`, `DELETE /subscriptions/:id` | CRUD hiện hữu |
| Chi tiết gói | `GET /subscriptions/:id` | Detail có thông tin thanh toán, cancel guide, charges và tối đa 5 email evidence; event timeline chưa có endpoint riêng |
| Cần chú ý (Inbox) | `GET /inbox`, `POST /inbox/:id/resolve` | Action theo loại item; invalidate home/list/analytics |
| Phân tích | `GET /analytics` | Không hiển thị breakdown theo category |
| Lịch/nhắc/đánh giá | `GET /calendar`, `GET /reminders`, `GET /reviews` | Route phụ còn được bảo toàn; quyết định review dùng `PUT /reviews/:subscriptionId` |
| Tài khoản và phần phụ | `/payment-methods`, `/groups`, `/me/budget`, `/reminders`, `/connections` | Các module cũ vẫn là API thật, không bị xóa theo việc đổi tabs |

Admin routes hiện có: login, overview, users/detail, catalog, features, system health, queues, team và audit log.

## 5. Kiến trúc runtime

```text
Mobile Expo ── JWT/HTTPS ──▶ NestJS/Fastify API ── Prisma/Supavisor ──▶ Supabase Postgres
     │                            │       │
     └─ Supabase Auth            │       └─ Redis/BullMQ ──▶ Expo Push
                                  └─ Gmail OAuth/read-only ──▶ Detection pipeline

Admin Next.js ── Supabase Auth token ──▶ cùng API NestJS
```

- Client chỉ dùng Supabase trực tiếp cho Auth. Mọi dữ liệu nghiệp vụ đi qua API.
- Tất cả bảng public phải bật RLS ngay trong migration tạo bảng, không có policy cho client.
- API dùng DB owner/service backend; `service_role` tuyệt đối không xuống mobile/browser.
- Job hiện chạy trong API: FX hằng ngày, reminder planner/roll-forward mỗi 5 phút, receipt mỗi 15 phút, email sync scheduler mỗi 6 giờ khi bật; scan do người dùng yêu cầu vào BullMQ email-sync queue.
- Khi scale nhiều API instance, job vẫn có idempotency nhưng nên chỉ bật scheduler trên một instance.

## 6. Database và migrations

Prisma hiện có **31 model** và 31 enum. Năm migration:

1. `20260927000000_init`
2. `20260927000100_rls_and_auth`
3. `20260927000200_reminder_receipts`
4. `20260928000000_email_auto_detect`
5. `20260928010000_aggregated_receipt_events`

Nhóm bảng:

- Account: `profiles`, `user_settings`, `budgets`, `push_tokens`.
- Subscription: `subscriptions`, `renewal_charges`, `reminders`, `reminder_rules`, `monthly_reviews`, `payment_methods`.
- Catalog/finance: `services`, `service_plans`, `price_reports`, `categories` (legacy), `exchange_rates`.
- Groups: `groups`, `group_members`, `group_cycles`, `group_payments`.
- Billing/access: `entitlements`, `billing_events`, `promo_codes`, `promo_redemptions`, `feature_flags`.
- Detection: `connected_accounts`, `email_sync_runs`, `processed_emails`, `subscription_events`, `inbox_items`.
- Admin: `admin_users`, `audit_logs`.

Trigger `auth.users`: tạo user → profile/settings/reminder rules; xóa user → cascade dữ liệu. Mọi bảng mới phải có RLS trong chính migration tạo ra nó.

## 7. Quyết định và invariant không được tự ý phá

- **Tiền:** `BigInt` theo đơn vị nhỏ nhất + currency; API truyền chuỗi. Không dùng float. Quy đổi qua `FxService`/`convertMinor`; thiếu tỷ giá thì trả `missingRates`, không đoán.
- **Ngày:** ngày lịch là `YYYY-MM-DD`, DB `@db.Date`; không parse qua timezone ngầm. “Hôm nay” theo timezone user. Server là nguồn chính tính kỳ gia hạn.
- **Gia hạn:** kỳ k tính từ `startDate`, không cộng dồn; `anchorDay` giữ ngày 29–31; kỳ 0 luôn là `startDate`.
- **Auth:** `AuthGuard` toàn cục; public phải có `@Public()`. Query dữ liệu luôn lọc `userId`; tài nguyên không tồn tại và không thuộc user cùng trả 404.
- **Validation:** zod schema API đặt trong `packages/shared/src/api`; lỗi dùng `{statusCode, code, message, issues?}` và code ổn định.
- **Một màn một request** cho dữ liệu tổng hợp; việc chậm đưa vào queue.
- **Danh mục:** không đưa category trở lại UI/API nếu không có quyết định sản phẩm mới.
- **Admin:** dữ liệu qua API, không query DB từ Next.js client. Permission có một nguồn ở `ADMIN_PERMISSIONS` trong shared. Bí danh đăng nhập `admin` chỉ ánh xạ sang email trên web; Supabase Auth và API vẫn xác thực/phân quyền theo email/UUID.
- **Email detection:** adapter/parser/reconcile tách khỏi ghi DB; chỉ `DetectionService` ghi. Không lưu raw email body. Refresh token mã hóa AES-256-GCM.
- **Manual subscription:** bằng chứng email có thể bổ sung nhưng không được ghi đè dữ liệu user đã nhập.
- **Idempotency email:** chống trùng ở processed message và `(source_ref, event_type, merchant_key)`.
- **Free plan:** 8 subscription đang theo dõi, 1 mốc nhắc, 1 nhóm. Plus dựa trên entitlement còn hiệu lực.
- **Tỷ giá:** ExchangeRate-API là nguồn chính, phải ghi attribution ở UI có số quy đổi.
- **Giao tiếp/code:** trao đổi với chủ dự án bằng tiếng Việt; tên code theo phong cách hiện có; comment giải thích “tại sao”.

Lý do chi tiết nằm trong `docs/ARCHITECTURE.md`; không mở lại tranh luận nếu task không yêu cầu.

## 8. Luồng email auto-detection

1. User bắt đầu OAuth qua `/connections/gmail/start`; callback lưu refresh token đã mã hóa.
2. Adapter Gmail dùng scope `gmail.readonly`, tìm email ứng viên và không lưu nội dung thô.
3. Parser thuần trích merchant, event, giá, currency, ngày và line items; hóa đơn gộp có thể tạo nhiều event.
4. Reconcile engine suy luận trạng thái/chu kỳ/độ tin cậy và tìm subscription khớp.
5. `DetectionService` ghi event, tự tạo/cập nhật khi đủ tin cậy hoặc đưa vào Inbox để user xác nhận.
6. Quét lại an toàn nhờ idempotency; đổi parser thì tăng `PARSER_VERSION`.

Trạng thái detection tách khỏi trạng thái subscription. Email im lặng quá chu kỳ + 45 ngày chỉ thành `POSSIBLY_ACTIVE`, không tự kết luận hủy. Chưa làm: Gmail production OAuth/CASA, Outlook, lớp LLM cho email lạ.

## 9. Luồng chia tiền nhóm

- Một nhóm gắn với subscription và thu theo tháng; mỗi tháng có một `group_cycle`.
- Mở chi tiết nhóm sẽ `syncCycle`; unique `(group_id, period)` chống tạo trùng.
- `EQUAL` chia phần lẻ có kiểm soát; `CUSTOM` bắt buộc tổng phần mọi người bằng giá gói.
- Payment: `PENDING → CLAIMED_PAID → CONFIRMED`, hoặc `WAIVED`; chủ nhóm có thể `REOPEN`.
- Nhắc do user bấm, gửi ngay; cooldown 6 giờ/người. Người chưa join không nhận push.
- Invite code 8 ký tự; deep link thật chưa làm. VietQR chỉ cho VND; BIN hiện là dữ liệu tham khảo.

## 10. Môi trường và dịch vụ ngoài

- Supabase dev project: `lvnjhgmjmgxonbmsvtag`, Tokyo (`ap-northeast-1`); production phải ở Singapore.
- Expo/EAS: account `nvdeekay`, project `@nvdeekay/subca`; có iOS native project local và đã build được simulator; chưa có `eas.json`/build pipeline.
- Redis dev qua `docker compose up -d`.
- Gmail SMTP chỉ dùng dev; production dự kiến Resend.
- ExchangeRate-API có điều kiện attribution và không phân phối lại dữ liệu.

Biến API quan trọng: `DATABASE_URL`, `DIRECT_URL`, tùy chọn `SHADOW_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `FX_SYNC_ENABLED`, `REMINDERS_ENABLED`, `EXPO_ACCESS_TOKEN`, `CORS_ORIGINS`, `ADMIN_REQUIRE_MFA`, `PUBLIC_API_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SECRETS_KEY`, `EMAIL_SYNC_ENABLED`.

Riêng script `apps/api/scripts/create-admin.ts` nhận `ADMIN_CREATE_ROLE` và `ADMIN_CREATE_PASSWORD` tạm thời khi gọi lệnh; không cấu hình cho API runtime. Mẫu comment ở `apps/api/.env.example`.

Mobile chỉ dùng các biến public: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`. Admin tương tự với prefix `NEXT_PUBLIC_`. Mẫu đầy đủ nằm trong `.env.example` của từng app.

## 11. Lệnh chuẩn

```bash
pnpm install
docker compose up -d

# Kiểm tra giống CI; gọi turbo trực tiếp để tránh pnpm 11 tự kiểm dependency khi chạy song song

./node_modules/.bin/turbo run build typecheck test lint
./node_modules/.bin/prettier --check .
pnpm --filter @subca/api exec prisma validate

# Chạy ứng dụng

pnpm --filter @subca/api dev
pnpm --filter @subca/mobile dev
pnpm --filter @subca/admin dev

# DB và integration

pnpm --filter @subca/api prisma:deploy
pnpm --filter @subca/api prisma:seed
pnpm --filter @subca/api test:int
pnpm --filter @subca/api fx:sync
```

Integration test cần Supabase dev + Redis thật và tự tạo/dọn dữ liệu. Sau khi thêm module Nest hoặc đổi constructor, luôn chạy smoke test toàn `AppModule`, vì unit test provider thủ công không bắt được lỗi wiring.

## 12. Bẫy đã biết

- pnpm 11 từng treo do nhiều `pnpm run` cùng kích hoạt install; `verifyDepsBeforeRun: warn` đã được đặt. Sau khi đổi dependency phải chạy `pnpm install` thủ công.
- Prisma 7 lấy URL từ `prisma.config.ts`, client sinh trong `apps/api/src/generated/prisma`; không sửa generated code.
- BullMQ 6 dùng ioredis riêng với `maxRetriesPerRequest: null`.
- Expo start có thể ghi đè `apps/mobile/expo-env.d.ts`; file này được commit có chủ đích.
- Route Expo mới cần Metro sinh lại `.expo/types/router.d.ts` trước khi typecheck nhận route.
- Khi cần tự kiểm tra màn iOS Simulator mà không điều khiển được UI, có thể tạm điều hướng/tự submit bằng code, dùng `xcrun simctl` để launch/chụp ảnh, rồi bắt buộc khôi phục đúng file gốc và kiểm tra bằng `cmp`/Git diff.
- Mobile phải dùng component `Text` của app và prop `weight`, không dùng `font-bold`; ghép class bằng `cn()`.
- Tiền hiển thị qua `formatAmount`; ngày qua formatter chuỗi của app, không qua `Date` tùy tiện.
- Next.js 16 thay đổi nhanh: trước khi sửa admin phải đọc hướng dẫn versioned trong `node_modules/next/dist/docs/` theo `apps/admin/AGENTS.md`.
- Script bootstrap admin cần ép kiểu `text` cho tham số đưa vào `jsonb_build_object` khi dùng PrismaPg; nếu không PostgreSQL báo `42P18`.
- Expo API phải tra docs đúng SDK 57 theo `apps/mobile/AGENTS.md`, không dựa vào trí nhớ.
- Prettier tự căn bảng Markdown; tránh script phụ thuộc nguyên văn spacing của bảng.
- macOS không có lệnh `timeout`; Docker Hub có thể chập chờn nhưng máy dev đã có image Redis.

## 13. Chất lượng, commit và dữ liệu đang có

- Ba tầng test: unit (`src/**/*.spec.ts`), e2e (`test/*.e2e-spec.ts`, có smoke AppModule), integration (`test/integration/*.int-spec.ts`).
- Xác minh ngày 29/09/2026: Turbo build/typecheck/test/lint **12/12 task qua**; shared **88 test**, API **122 unit + 60 e2e** qua; Prisma validate và Prettier qua. Integration không chạy lại trong lượt này; lần chạy DB thật gần nhất có **51 test qua**, trong đó detection có 9 integration.
- Chỉ push khi format + build + typecheck + test + lint qua. Theo dõi GitHub Actions sau push.
- Commit chia theo phần hợp lý, Conventional Commits bằng tiếng Việt; không thêm `Co-Authored-By`/dòng generated by AI.
- Tài khoản dev còn dữ liệu mẫu và một nhóm Netflix test; chỉ dọn khi chủ dự án yêu cầu.
- `design/Subca V2.html` hiện đã được track; kiểm tra `git status --short` mỗi session để giữ mọi thay đổi của người dùng. `apps/mobile/expo-env.d.ts` hay bị `expo start` ghi đè; khôi phục bản đã commit trước khi commit.
- Lượt đồng bộ Admin UI và thêm tài khoản `admin` ngày 29/09/2026: script tạo tài khoản dev thành công; đọc lại DB xác nhận ADMIN/đang bật và có một identity email. Đã dọn bản ghi Auth dở dang do lần chạy script lỗi; chưa chạy kiểm thử hoặc QA UI theo yêu cầu session.
- Lượt 01/10/2026: đọc lại code auth/mobile, Admin, catalog, Prisma schema/migration và Git; local API chưa chạy. Màn tạo mật khẩu rút gọn microcopy và dùng icon hiện/ẩn trong ô nhập. Mobile typecheck/lint qua; Prettier cho file sửa và `git diff --check` qua. Không chạy unit/e2e/integration hoặc QA màn này trên thiết bị. `apps/mobile/expo-env.d.ts` là thay đổi sẵn của người dùng, được giữ nguyên.
- Lượt 01/10/2026 tiếp theo: đổi validate màn tạo mật khẩu sang tối thiểu 6 ký tự có chữ và số, giữ giới hạn 72 ký tự; báo lỗi riêng cho ô mật khẩu/nhập lại sau blur hoặc khi submit, cập nhật lỗi khi sửa. Mobile lint/typecheck, Prettier và `git diff --check` qua; chưa QA trên thiết bị hoặc với Supabase thật.
- Lượt 01/10/2026 tiếp theo: thay chữ “G” giả bằng biểu tượng Gmail 2020 năm màu tại màn kết nối trong onboarding, trạng thái đã kết nối và danh sách tài khoản Gmail. Mobile lint/typecheck, Prettier và `git diff --check` qua; chưa QA trực quan trên thiết bị.
- Lượt 01/10/2026 tiếp theo: xóa hai nhánh giới thiệu cũ và điều hướng quay lại chúng khỏi route `welcome` sau đăng nhập; giữ kết nối Gmail → scan → summary. Ảnh người dùng cho thấy màn “Subca / Bắt đầu” vẫn có thể truy cập qua back từ kết nối email dù trạng thái khởi tạo đã là `connect`. Mobile lint/typecheck, Prettier và `git diff --check` qua; chưa QA trực quan trên thiết bị.
- Lượt 01/10/2026 tiếp theo: nút bỏ qua ở màn Gmail/Outlook đổi thành “Bỏ qua và về trang chủ”, dùng `router.replace('/(app)/(tabs)')` thay cho mở form `/add`. Mobile lint/typecheck và Prettier qua; chưa QA thao tác trên thiết bị.

## 14. Quy trình cập nhật knowledge base

Mỗi agent hoàn thành thay đổi có ý nghĩa phải kiểm tra các mục sau trước khi trả lời:

- Cập nhật ngày và commit snapshot ở đầu file. Nếu chưa commit, ghi rõ `snapshot commit + thay đổi chưa commit` thay vì bịa hash mới.
- Cập nhật “Hiện trạng”, “Đang ở đâu”, blocker và thứ tự tiếp theo.
- Nếu thêm/bỏ app/module/route/model/migration/dependency/env: cập nhật đúng mục tương ứng.
- Nếu đổi invariant/quyết định: cập nhật mục 7 và `docs/ARCHITECTURE.md`, kèm lý do.
- Nếu hoàn tất hoặc thêm backlog: cập nhật `docs/SUBCA-CHECKLIST.md`.
- Nếu gặp bẫy mới có khả năng lặp lại: thêm vào mục 12.
- Nếu test/verification thay đổi: cập nhật mục 13 bằng kết quả thật, không suy đoán.
- Chạy `git diff --check` và kiểm tra diff của tài liệu trước khi kết thúc.

Mẫu handoff ngắn để ghi vào phần hiện trạng khi dừng giữa chừng:

```text
Đang làm: <mục tiêu cụ thể>
Đã xong: <phần đã xác minh>
Còn lại: <bước tiếp theo có thể hành động>
Blocker: <điều cần người dùng/dịch vụ ngoài, hoặc “không”>
Đã kiểm tra: <command/test và kết quả>
File chạm tới: <danh sách ngắn>
```

## 15. Tài liệu tham chiếu

- `docs/ARCHITECTURE.md`: giải thích sâu các quyết định và thuật toán.
- `docs/SUBCA-CHECKLIST.md`: roadmap/checklist đầy đủ theo giai đoạn.
- `README.md`: onboarding cho người phát triển.
- `apps/admin/README.md`: cách chạy, auth và permission admin.
- `design/`: mockup và email template.

File này phải đủ để một session mới hiểu dự án mà không đọc lại toàn codebase; các tài liệu/code khác chỉ dùng để đi sâu vào task cụ thể.
