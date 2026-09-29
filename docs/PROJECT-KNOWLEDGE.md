# Subca — Project Knowledge Base

> **Nguồn sự thật trung tâm cho Claude, Codex và người phát triển.**  
> Cập nhật: **29/09/2026** · Snapshot commit: `dbe6de1` · Repo: `nvdekay/Subca`
> Đợt auth mật khẩu, chọn khoảng quét Gmail + bằng chứng email, palette thương hiệu mới và BackButton đã commit/push. Chạy `git status` / `git diff` để nhận biết thay đổi sau snapshot.

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

### Cập nhật triển khai Mobile V2 và editorial/bento UI (29/09/2026)

- Tham chiếu UX: `design/Subca V2.html` (24 trạng thái; gồm cả demo controls và màn minh họa). Mobile tabs đang chuyển sang Trang chủ / Gói của tôi / Cần chú ý / Phân tích; Lịch và Review vẫn giữ làm route phụ, các màn nhóm/ngân sách/thanh toán/thông báo/hồ sơ không bị bỏ.
- Intro trước đăng nhập mới: chữ “Xin chào.” lớn ở giữa → gom gói đăng ký → nhắc gia hạn → tổng quan chi tiêu/chia tiền. Lời chào tự chuyển sau 3 giây một lần; ba cảnh còn lại người dùng tự bấm tiếp/quay lại. Có bỏ qua/đăng nhập ở mọi cảnh. Tiếp sau intro: chọn đăng nhập email+mật khẩu hoặc đăng ký qua email OTP một lần → tạo mật khẩu Subca → kết nối Gmail → xác nhận đã kết nối → scan → summary. Đăng nhập thường không gửi OTP. Đặt lại mật khẩu/di chuyển tài khoản cũ OTP-only dùng OTP recovery; không tự động phân biệt email đã có tài khoản trên màn email để tránh lộ membership. Tài khoản có phiên được đưa tới bước tạo mật khẩu nếu đang hoàn thành đăng ký; nếu có dữ liệu thì vào tabs.
- Luồng auth code mobile: `(auth)/sign-in.tsx`, `(auth)/verify.tsx`, `set-password.tsx`; password calls và marker pending nằm ở `features/auth/password-flow.ts` + `password.ts`; session gate ở `features/auth/session.tsx`. Chỉ lưu email pending được xác minh trong encrypted MMKV, không lưu password. Password dùng Supabase Auth `signInWithPassword`/`updateUser`; không thêm API/migration/dependency. OTP `shouldCreateUser` chỉ bật signup, recovery không tự tạo user. Thực tế gửi email/reset vẫn cần Supabase Email OTP provider/SMTP cấu hình.
- Mobile đang chuyển từ vintage mềm sang phong cách editorial/bento theo ảnh tham chiếu: nền giấy sáng, mực navy-charcoal, viền dày, góc vuông gọn, bóng cứng offset; cam, xanh nhạt, mint, peach làm mảng nhấn. Card và control dùng chung nhận diện mới; logo dịch vụ ngoài giữ màu nhận diện. Admin chưa được đổi trong lượt này.
- Intro nằm tại `apps/mobile/src/features/onboarding/intro.tsx` và `intro-art.tsx`, route auth index chỉ re-export. Dùng Reanimated hiện có, minh hoạ code-native, không thêm dependency/API. Tắt tự chuyển và animation khi Reduce Motion; tắt tự chuyển khi screen reader; timer được dọn khi blur/background/unmount. Nội dung cuộn được và CTA nằm ngoài vùng cuộn. Màn “Xin chào.” không còn logo Subca ở góc trên trái.
- Tinh chỉnh intro: bỏ biểu tượng sao trên “Xin chào.”; cảnh gom gói dùng `intro-phone.tsx` với nửa trên khung điện thoại, thẻ dịch vụ xuất hiện bên trong màn hình. Cảnh bức tranh chi tiêu dùng biểu đồ nhiều màu hơn trong palette hiện có; cảnh nhắc gia hạn có header tint coral và số ngày/icon chuông màu cam. Đã kiểm tra ảnh lời chào và khung điện thoại trên iOS Simulator; mobile typecheck/lint qua trước tinh chỉnh màu nhắc.
- Màn đăng nhập email+mật khẩu dùng icon eye/eye-off nằm trong ô mật khẩu qua slot `right` của `components/ui/input.tsx`, không còn nút ghost tách riêng bên dưới.
- Chuyển giữa đăng nhập/đăng ký/khôi phục mật khẩu có hiệu ứng trượt nhẹ bằng Reanimated; tự tắt khi Reduce Motion bật.
- Nút quay lại mobile thống nhất qua `components/ui/back-button.tsx`: IconButton 44×44, bo 12, nền giấy, viền mảnh, cùng icon/màu/bóng/pressed state. Áp dụng qua TopBar cho màn con/auth, intro, các bước Gmail và trạng thái lỗi chi tiết gói. Nút đóng modal giữ icon X nhưng cùng style; mũi tên chuyển tháng không phải back navigation nên không đổi.
- QA intro: mobile typecheck/lint qua; xem ảnh cả bốn cảnh trên iPhone 17 Pro Simulator, xác nhận greeting tự chuyển sang cảnh đầu. Chưa kiểm thử thao tác từng nút, VoiceOver/Reduce Motion và Android trên thiết bị; trạng thái preview tạm đã khôi phục về bước 0.
- Mobile và Admin cùng dùng nền giấy sáng, palette navy-charcoal/cam/pastel, Nunito weights 400–800, viền mực dày, góc gọn và bóng offset. Admin đã đổi tokens, layout, login và UI components dùng chung; các trang hiện hữu kế thừa style này. Không đổi nghiệp vụ.
- Tạo tài khoản quản trị dev riêng `admin-login@subca.app` (vai trò ADMIN, đang bật); web cho đăng nhập bằng tên `admin` qua bí danh email phía client. Tài khoản OWNER `admin@subca.app` giữ nguyên. Mật khẩu chỉ lưu ở Supabase Auth và `.admin-account-admin-login.local` đã gitignore; không ghi vào tài liệu. Script bootstrap nhận tùy chọn `ADMIN_CREATE_ROLE`/`ADMIN_CREATE_PASSWORD`; sửa ép kiểu tham số identity JSON của PostgreSQL. Chưa xác minh đăng nhập qua UI.
- Layout Admin trên desktop giữ sidebar trong chiều cao viewport, cuộn riêng phần nội dung chính; sidebar chỉ tự cuộn khi danh sách mục vượt chiều cao màn hình. Màn hẹp giữ luồng cuộn trang hiện có.
- Font: mobile nạp Nunito từ `@expo-google-fonts/nunito` trước khi ẩn splash; admin dùng `next/font/google` với subset `latin` + `vietnamese`. Font Nunito theo OFL-1.1.
- Đợt product-architecture redesign mobile: thanh tab có 4 đích chính cân quanh CTA thêm ở giữa; dashboard ưu tiên tổng chi → việc cần xác nhận → mốc tiếp theo → ngân sách → lối tắt; Inbox đưa số việc chờ xử lý lên đầu; analytics đặt tổng chi và xu hướng trước phần phân tích phụ. Header màn con dùng căn trái; form tạo gói gom tuỳ chọn ít dùng vào phần mở rộng (edit để mở sẵn), chi tiết gói đưa thao tác chính lên gần đầu trang.
- Trang chủ có phân cấp tổng chi → việc cần xác nhận → mốc tiếp theo → ngân sách → lối tắt; phần tổng quan bỏ nền charcoal lớn, dùng số tiền lớn trên nền sáng và ba ô chỉ số màu pastel viền mực/bóng cứng. Không thêm số liệu so sánh tháng trước vì API chưa cung cấp.
- Mobile tokens tập trung tại `apps/mobile/src/theme/tokens.json`; component dùng chung đã được làm mới gồm `Text`, `Card`, `Button`, `Input`, tab navigation, segmented, pill, sheet, date/search controls. Admin tokens và form states nằm trong `apps/admin/src/app/globals.css` + `src/components/ui.tsx`.
- Subscription DTO list/detail bổ sung source, detection state, confidence, needsReview, reviewReason, lastDetectedAt và evidenceCount để UI nêu nguồn/bằng chứng. Dữ liệu này lấy từ bảng/event hiện có.
- `POST /connections/:id/sync` dùng BullMQ; run được lưu trước khi enqueue và tiến độ scanned/candidate/event cập nhật mỗi trang Gmail. Không đổi schema/migration; Redis cần chạy. Scheduler định kỳ vẫn có luồng riêng.
- Tóm tắt lượt quét trả `runId`; onboarding dùng ID này để tránh nhận nhầm trạng thái cũ, tự khôi phục lượt quét đầu đang chạy sau khi mở lại app và hiển thị retry khi worker thất bại. API/DB/Redis local khỏe. `apps/api/.env` đã có các biến OAuth/`SECRETS_KEY` và `PUBLIC_API_URL` trỏ tới Cloudflare Quick Tunnel tạm; public `/health` trả DB up và callback trả HTTP 200. API đã restart và OAuth tới được Google; hiện Google trả 403 vì tài khoản đăng nhập chưa nằm trong Test users của project Testing.
- Màn kết nối hộp thư và onboarding dùng chung thẻ tiến độ scan nhiều màu, thanh tiến độ indeterminate, trạng thái theo giai đoạn và số đếm email đọc/email liên quan. Không hiển thị phần trăm vì Gmail không cung cấp trước tổng số email; màn kết nối giữ sẵn chỗ cho thẻ trong lúc tải và kích thước thẻ ổn định khi polling để tránh nội dung bị đẩy xuống.
- Trước lượt quét Gmail thủ công, người dùng chọn 1/3/6/12 tháng (mặc định 3); API áp phạm vi vào Gmail `after:` query và lưu mốc vào `EmailSyncRun.since`. Scheduled incremental vẫn quét từ `lastSyncAt`; mỗi lượt giới hạn tối đa 400 email và UI nêu rõ điều này. Chưa QA Gmail thật với các lựa chọn thời gian.
- Thẻ hộp thư thể hiện trạng thái kết nối thành công bằng pill xanh lá; thao tác ngắt kết nối dùng nút danger đỏ nhạt với chữ đỏ để phân biệt hành động phá huỷ quyền truy cập.
- Thẻ kết quả scan trên màn Kết nối hộp thư tách các số trạng thái (hoạt động/dùng thử/đã hủy) khỏi số cần kiểm tra. `needsReview` có thể trùng với các trạng thái và UI ghi rõ số này đã nằm trong tổng, tránh người dùng cộng nhầm.
- Màn Kết nối hộp thư tách spinner kéo xuống do người dùng chủ động khỏi refetch polling tiến độ 3 giây; chỉ thao tác kéo tay mới bật `RefreshControl`, tránh màn tự nảy trong lúc quét. Chi tiết subscription có thẻ “Nguồn phát hiện” với domain/ngày nhận email và liên kết mở thread Gmail khi metadata có sẵn. Event mới lưu thêm `threadId` và `receivedAt` trong JSON metadata; không lưu sender email, subject gốc hay body. Event cũ vẫn hiện nguồn/domain nếu có nhưng không bịa ngày nhận hoặc link Gmail.
- Prototype giả lập OCR ảnh và email forwarding; chưa có backend/API cho các luồng đó nên không giả làm tính năng thật. Prototype có analytics theo category nhưng quyết định sản phẩm hiện tại là bỏ category, không đưa lại.
- Kiểm tra đợt auth/palette: mobile typecheck/lint qua sau tinh chỉnh intro/sign-in; Admin typecheck/lint/build qua. iOS Simulator đã mở được màn intro sau đổi palette. Chưa kiểm thử đăng ký/OTP/password với tài khoản Supabase thật, chưa QA màn auth/màn khác trên Android và accessibility. Trước khi push đợt này: Turbo build/typecheck/test/lint 12/12, shared 88 test, API 122 unit + 60 e2e, Prisma validate, Prettier và `git diff --check` qua.
- Kiểm tra sửa scan/source: shared build, API/mobile typecheck, API/mobile lint và `git diff --check` đều qua; chưa chạy test theo quy định của session.
- Kiểm tra giao diện editorial/bento: mobile typecheck/lint và `git diff --check` qua; chưa xem được ảnh simulator do CoreSimulatorService không kết nối được trong phiên.
- Kiểm tra local khi mở app: `GET /health` trả `{"status":"ok","db":"up"}`, Redis healthy, Metro báo running trên 8081; app build/cài/mở được trên iPhone 17 Pro Simulator (iOS 26.2). Build đầu với prebuilt React thất bại vì thiếu binary; build thành công sau `pod install` với `RCT_USE_RN_DEP=0 RCT_USE_PREBUILT_RNCORE=0`. Đây là trạng thái máy dev, không phải bảo đảm các thiết bị/CI khác.

### Đã hoạt động

- Monorepo pnpm + Turborepo; CI chạy build, typecheck, test, lint và Prisma validate.
- API NestJS/Fastify, Prisma/Supabase, auth JWT, CRUD subscription, home, calendar, review, analytics, budget, payment method, reminder, push, FX và account deletion.
- Mobile Expo có đầy đủ các màn lõi, auth email OTP, cache cục bộ, notification, group splitting, Gmail connection và Subca Inbox.
- Chia tiền nhóm chạy end-to-end trên Supabase dev, gồm chia đều/tùy chỉnh, chu kỳ tháng, claim/confirm/waive/reopen, nhắc và VietQR.
- Admin Console v1 chạy thật: đăng nhập email/password, tùy chọn MFA, 5 vai trò và các trang overview, users, catalog, features, system, queues, team, audit.
- Đường ống tự phát hiện từ email đã chạy end-to-end bằng hộp thư mẫu: Gmail adapter → parser → event → reconcile → subscription/Inbox.
- Parser v2 nhận diện khoảng 65 merchant và tách hóa đơn gộp thành nhiều sự kiện.

### Đang ở đâu

Các chức năng lõi subscription, reminder, nhóm và Admin v1 đã có. Mobile và Admin cùng palette editorial/bento; scan onboarding đã có retry cho run lỗi. Tài khoản `admin` mới đã tạo trong Supabase dev; còn cần QA đăng nhập/UI. Chưa xác nhận Google OAuth/Gmail thật, chưa QA Android/push thật, chưa phát hành. Trọng tâm tiếp theo: cấu hình OAuth Gmail thử nghiệm và QA onboarding → scan → summary → Inbox, sau đó QA editorial mobile trên iOS/Android cùng Admin, bảo mật/pháp lý, EAS/store và beta.

### Blocker/việc cần chủ dự án xử lý

1. Xác minh/hoàn tất xoay thông tin đăng nhập dev từng bị lộ (database và Gmail SMTP); không ghi secret mới vào repo/chat. Trước production chuyển SMTP sang Resend + domain riêng.
2. Đang chặn QA Gmail thật: thêm tài khoản thử nghiệm hiện tại vào Google Auth Platform → Audience → Test users rồi thử consent/scan; callback Quick Tunnel đã truy cập được. Khi Quick Tunnel đổi host phải cập nhật cả `PUBLIC_API_URL` lẫn redirect URI. Go-live phải thay tunnel bằng hostname HTTPS ổn định, cấu hình redirect URI production riêng, lưu secrets production an toàn và hoàn tất yêu cầu xác minh/CASA của Google.
3. Thêm/xác minh `SUPABASE_SERVICE_ROLE_KEY` ở API để xóa tài khoản và thao tác admin cần Supabase Admin API.
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
- Tại lúc tạo snapshot, workspace có file untracked `design/Subca V2.html`; coi là thay đổi của người dùng, không xóa/ghi đè ngoài task liên quan.
- Lượt đồng bộ Admin UI và thêm tài khoản `admin` ngày 29/09/2026: script tạo tài khoản dev thành công; đọc lại DB xác nhận ADMIN/đang bật và có một identity email. Đã dọn bản ghi Auth dở dang do lần chạy script lỗi; chưa chạy kiểm thử hoặc QA UI theo yêu cầu session.

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
