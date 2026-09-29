# Subca — Kiến trúc & quyết định kỹ thuật

> Cập nhật: 29/09/2026. Ghi lại **vì sao** chọn như hiện tại để không phải bàn lại. Đổi quyết định nào thì sửa file này. Snapshot vận hành ngắn gọn nằm ở `docs/PROJECT-KNOWLEDGE.md`.

## Tổng quan

```
 App mobile (Expo)  ──HTTPS + JWT──▶  API (NestJS/Fastify)  ──Prisma (pooler 6543)──▶  Supabase Postgres (RLS chặn client)
        │                                   │   ▲
        │ đăng nhập                         │   └── cron: tỷ giá (07:30 VN), nhắc nhở (5 phút), push receipt (15 phút)
        ▼                                   ▼
  Supabase Auth                        Redis ◀── BullMQ (reminders + Gmail scan) ──▶ Expo Push ──▶ APNs / FCM
  (email OTP đang dùng; Apple/Google sign-in chưa làm)
 Admin (Next.js) ──JWT──▶ API
```

- App **không** đọc/ghi DB trực tiếp: mọi bảng bật RLS không có policy, thu hồi quyền `anon`/`authenticated`. App chỉ dùng Supabase để đăng nhập, rồi gọi API bằng access token.
- API kết nối DB bằng user `postgres` (chủ bảng, không bị RLS chặn) qua Supavisor transaction mode.

## Quyết định đã chốt

| Chủ đề | Chọn | Lý do / lựa chọn đã loại |
|---|---|---|
| Mobile | **React Native + Expo** | 1 codebase, 1 dev mobile, chung TypeScript với API/admin, sửa lỗi qua EAS Update. Đã so với Native (Swift+Kotlin: gấp đôi công, lệch 2 nền tảng) và Flutter (không chung ngôn ngữ). Widget / Live Activity viết native qua Expo Modules khi cần |
| Backend | **NestJS 12 trên Fastify** | Đã cân nhắc Go: ở quy mô Subca phần xử lý backend chỉ vài ms trên 50–100 ms người dùng chờ; giữ TypeScript để dùng chung schema và logic. Tách service nặng sang Go nếu sau này cần (VD đọc email hóa đơn) |
| DB + Auth | **Supabase** (Postgres 17 + Auth) | Đăng nhập Apple/Google/email OTP sẵn có; Postgres đầy đủ. Không dùng Edge Functions / truy cập DB từ client |
| ORM | **Prisma 7.10** + `@prisma/adapter-pg` | Không dùng 8.0 (đang RC) |
| Hàng đợi | **BullMQ 6 + Redis** | Dùng cho reminder/push và Gmail scan theo yêu cầu (run trả ngay, worker lưu tiến độ từng trang). Dev: `docker compose`; production: Redis cùng khu vực với API. Không dùng Upstash tính theo lệnh. Phương án thay thế đã cân nhắc: pg-boss trên Postgres |
| Push | **Expo Push Service** | 1 API cho iOS + Android; có thể chuyển FCM/APNs trực tiếp sau |
| Tỷ giá | **ExchangeRate-API (Open Access)**, dự phòng fawazahmed0/currency-api | ECB không có VND. Điều khoản: dùng thương mại được, **bắt buộc ghi nguồn**, không phân phối lại, gọi ≤ 1 lần/ngày |
| Mua trong app | **RevenueCat** (chưa làm) | Lo App Store + Google Play, webhook → bảng `entitlements` |
| Admin | **Next.js 16 + Tailwind 4**, bộ UI nhỏ theo token sản phẩm | Admin Console v1 đã chạy; không dùng shadcn/ui để giữ giao diện gọn và nhất quán với app |
| Visual system | **Modern vintage**: giấy kem, olive, dusty red, brass; Nunito bo tròn, dễ đọc và hỗ trợ tiếng Việt; hạt giấy cực nhẹ, viền mảnh và bóng dịu; không gradient | Dùng Nunito weights 400–800 trên mobile/Admin; font tải riêng theo nền tảng, giữ palette/layout token riêng NativeWind và Tailwind |
| Mobile information architecture | **4 đích chính + CTA thêm trung tâm**; dashboard theo thứ tự tổng quan → quyết định → mốc gần nhất → ngân sách → lối tắt; phân tích theo tổng → xu hướng → chi tiết | Giữ nguyên route nghiệp vụ/API; các màn phụ dùng cùng header trái biên, nội dung/CTA ưu tiên theo nhiệm vụ của màn |
| Hosting | Railway / Render / Fly.io, **Singapore** (chưa chọn) | Cùng khu vực với Supabase production |
| Danh mục | **Bỏ khỏi sản phẩm** (27/09/2026) | Chủ dự án thấy thừa: không chọn danh mục khi thêm subscription, Phân tích không chia theo danh mục, API không còn `/catalog/categories` và `categoryId`. Bảng `categories` và cột `category_id` vẫn còn trong DB (không dùng) để khỏi migration xóa dữ liệu |

## Dữ liệu

- 31 bảng (xem `apps/api/prisma/schema.prisma`). Nhóm chính: người dùng (`profiles`, `user_settings`, `push_tokens`, `budgets`), subscription (`subscriptions`, `renewal_charges`, `reminders`, `reminder_rules`, `monthly_reviews`), thư viện (`services`, `service_plans`, `categories`, `price_reports`), thanh toán (`payment_methods`, `entitlements`, `billing_events`, `promo_codes`, `promo_redemptions`), chia tiền nhóm (`groups`, `group_members`, `group_cycles`, `group_payments`), tự phát hiện (`connected_accounts`, `email_sync_runs`, `processed_emails`, `subscription_events`, `inbox_items`), hệ thống (`exchange_rates`, `feature_flags`, `admin_users`, `audit_logs`).
- Trigger trên `auth.users`: đăng ký → tạo `profiles` + `user_settings` + 4 quy tắc nhắc mặc định; xóa → xóa `profiles` (cascade toàn bộ).
- Migration: `20260927000000_init`, `20260927000100_rls_and_auth`, `20260927000200_reminder_receipts`, `20260928000000_email_auto_detect`, `20260928010000_aggregated_receipt_events`.

## Logic lõi

### Ngày gia hạn (`packages/shared/src/renewal.ts`)
- Kỳ thứ k = `startDate` + k chu kỳ (không cộng dồn) → gói ngày 31 đi qua tháng 2 vẫn quay lại 31. `anchorDay` giữ ngày gốc; kỳ 0 luôn là `startDate`.
- Người dùng nhập **một ngày bị trừ tiền** (`billingDate`), server dùng làm `startDate` và tính `nextRenewalDate` theo "hôm nay" của người dùng. Trial: `billingDate` = ngày hết trial = ngày tính phí đầu.
- Đã test: 38 unit test + đối chiếu ngẫu nhiên với cách lặp từng kỳ.

### Nhắc nhở (`apps/api/src/reminders`)
Mỗi 5 phút:
1. **Đẩy kỳ** (`roll-forward.ts`): gói đã qua ngày gia hạn → ghi `renewal_charges`, tính kỳ tới; trial hết → ACTIVE (hoặc CANCELLED nếu tắt tự gia hạn).
2. **Lập lịch** (`planner.ts`): lượt nhắc có thời điểm trong [now − 6 giờ, now + 26 giờ), theo giờ nhắc + múi giờ từng người; mốc riêng của gói hoặc `reminder_rules` (lọc chu kỳ tối thiểu, số tiền tối thiểu); gói Free 1 mốc.
3. **Hàng đợi:** job hẹn giờ, `jobId` = ID lượt nhắc; khóa unique `(subscription_id, kind, offset_days, due_date)` → không gửi trùng.
- Worker kiểm tra lại trước khi gửi (hủy / đổi ngày / tắt thông báo / trễ > 6 giờ → CANCELLED), thử lại 3 lần khi lỗi mạng, xóa token `DeviceNotRegistered`.
- Mỗi 15 phút kiểm tra push receipt.

### Chia tiền nhóm (`apps/api/src/groups`)
- Nhóm thu theo **tháng**: mỗi tháng một `group_cycles`, mỗi thành viên (trừ chủ nhóm) một `group_payments`. Kỳ được tạo/đồng bộ **ngay khi mở màn nhóm** (`syncCycle`), không cần job nền; khóa unique `(group_id, period)` nên gọi song song vẫn an toàn.
- Đổi giá gói hoặc cách chia chỉ sửa khoản còn `PENDING`; khoản đã báo chuyển / đã xác nhận giữ nguyên số tiền để lịch sử không đổi theo.
- `EQUAL` chia bằng `splitEvenly` (phần lẻ dồn cho người đầu, chủ nhóm đứng đầu danh sách) nên tổng luôn khớp giá gói. `CUSTOM` bắt buộc gửi phần của **mọi** thành viên và tổng khớp giá gói (`SPLIT_TOTAL_MISMATCH`).
- Trạng thái khoản: `PENDING` → thành viên bấm "Tôi đã chuyển" (`CLAIMED_PAID`) → chủ nhóm xác nhận (`CONFIRMED`) hoặc miễn (`WAIVED`). Chủ nhóm còn **chờ tiền** khi khoản là PENDING hoặc CLAIMED_PAID; với thành viên thì CLAIMED_PAID đã coi như xong nên không hiện trong "cần trả".
- Nhắc trả tiền gửi push ngay (không qua BullMQ) vì luôn do người dùng bấm; chặn nhắc lại cùng một người trong 6 giờ (`REMIND_TOO_SOON`, 429). Người chưa tham gia nhóm thì không nhắc được (`MEMBER_NOT_JOINED`) — gửi lại link mời.
- Link mời `subca.app/j/<mã>`: mã 8 ký tự không có 0/O, 1/I. Vào nhóm nhận **chỗ trống đầu tiên**; hết chỗ thì `GROUP_FULL`. **Chưa có Universal Links / App Links** (cần tên miền), tạm thời app nhập mã bằng tay.
- **Mã QR VietQR** (`packages/shared/src/vietqr.ts`): server sinh chuỗi EMVCo + NAPAS247 (QRIBFTTA) kèm CRC-16/CCITT-FALSE, app chỉ vẽ lại. Thành viên nhận QR đúng phần của mình; chủ nhóm chỉ điền sẵn số tiền khi chia đều. Chỉ có QR với nhóm tính bằng VND. Danh sách BIN ngân hàng là **danh sách tham khảo, cần đối chiếu với NAPAS trước khi ra mắt**.

### Admin Console (`apps/api/src/admin`, `apps/admin`)
- **Đăng nhập:** email + **mật khẩu** (Supabase Auth `signInWithPassword`) theo yêu cầu của chủ dự án; tài khoản phải có trong `admin_users` và đang bật. Xác thực hai bước chuyển thành cờ `ADMIN_REQUIRE_MFA` (mặc định tắt, **bật ở production**): bật thì `AdminGuard` đòi phiên đạt `aal2` và trang đăng nhập tự hiện bước TOTP.
- **Tài khoản admin đầu tiên** tạo bằng `pnpm --filter @subca/api admin:create` — ghi thẳng vào `auth.users` (bcrypt của pgcrypto) vì lúc đó máy chủ chưa cần service role key. Các tài khoản sau thêm trong trang Nhân sự (qua Supabase Admin API, cần `SUPABASE_SERVICE_ROLE_KEY`).
- **CORS:** API mở theo `CORS_ORIGINS` cho đúng origin của Admin Console; app mobile là ứng dụng gốc nên không đi qua CORS.
- **Phân quyền** khai ở một chỗ (`ADMIN_PERMISSIONS` trong shared): API chặn bằng `@RequireAdmin('manageUsers')`, giao diện ẩn nút bằng `can('manageUsers')`.
- **Nhật ký:** mọi thao tác đổi dữ liệu ghi `audit_logs` kèm IP; khóa tài khoản / tặng Plus là `SENSITIVE`, xóa dữ liệu là `CRITICAL`. Ghi nhật ký lỗi thì chỉ log, không làm hỏng thao tác chính.
- **Tặng Plus** tạo `entitlements` với store `PROMO` (không đi qua RevenueCat); tặng thêm khi đang còn hạn thì cộng dồn vào quyền cũ.
- **Hàng đợi:** không dùng Bull Board vì giao diện riêng của nó khó đặt sau lớp đăng nhập có MFA; thay bằng `GET /admin/queues` (số liệu BullMQ + job lỗi) để admin tự vẽ. Redis chết thì trả `connected: false`.
- Admin không đọc thẳng database: mọi thứ qua API, anon key trong trình duyệt không vượt được RLS.

### Tự phát hiện subscription từ email (`apps/api/src/detection`, `integrations/mail`)
- **Ba lớp tách rời:** adapter hộp thư (chỉ nói chuyện với Gmail) → parser (chỉ đọc, trả `DetectedEvent`) → engine đối soát (chỉ suy luận, không đụng DB) → `DetectionService` là nơi **duy nhất** ghi dữ liệu. Nhờ vậy parser và engine test được bằng hàm thuần.
- **Idempotency** hai lớp: `processed_emails(account_id, provider_message_id)` và unique `(source_ref, event_type, merchant_key)` trên `subscription_events`. Quét lại cả hộp thư không sinh thêm gì; đổi parser thì tăng `PARSER_VERSION` để quét lại.
- **`subscription_events` là bằng chứng từ email, khác `renewal_charges`** (tiền đã trừ thật, do job roll-forward ghi) — không gộp hai bảng.
- **Trạng thái:** `DetectionState` (ACTIVE / TRIAL / POSSIBLY_ACTIVE / CANCELLED / EXPIRED / PAYMENT_ISSUE / UNKNOWN) tách khỏi `SubscriptionStatus` người dùng thấy; `toStatus()` ánh xạ sang. Im lặng quá chu kỳ + 45 ngày → POSSIBLY_ACTIVE (hạ tin cậy), **không** tự kết luận đã hủy.
- **Chu kỳ** lấy theo thứ tự: email nói rõ → trung vị khoảng cách các lần thanh toán → mặc định tháng. Ngày gia hạn ưu tiên ngày email ghi, không có thì chiếu từ lần trừ tiền gần nhất.
- **Hóa đơn gộp** (Apple, Google Play, PayPal, ví điện tử): parser đọc từng dòng "tên dịch vụ + tiền" (`extractLineItems`) và trả **nhiều** `DetectedEvent`, mỗi dịch vụ một giá — coi cả biên nhận là một subscription thì số tiền sai và các dịch vụ còn lại biến mất. Chỉ tách khi đọc được từ hai dòng trở lên; một dòng thì đường thường xử lý tốt hơn vì còn lấy được ngày gia hạn trong thư. Dòng lạ vẫn thành sự kiện nhưng độ tin cậy thấp → vào Inbox chứ không tự thêm.
- **Gộp với gói nhập tay:** khớp theo `merchant_key` → `service_id` → tên gần giống + giá lệch dưới 25%. Gói `source = MANUAL` chỉ được bổ sung bằng chứng, số liệu người dùng nhập không bị ghi đè.
- **Quét:** `POST /connections/:id/sync` tạo `EmailSyncRun` rồi enqueue BullMQ; processor chạy scan, cập nhật scanned/candidate/event counts sau mỗi trang và hoàn tất run. API có thể đọc trạng thái qua `/connections/summary`. Scheduler định kỳ 6 giờ còn dùng luồng sync riêng.
- **Riêng tư:** chỉ xin `gmail.readonly`; refresh token mã hóa AES-256-GCM (`SECRETS_KEY`), không bao giờ xuống client; ngắt kết nối thì revoke ở Google rồi xóa; không lưu nội dung thư, chỉ lưu trường đã trích + băm tiêu đề.
- **Chưa xác minh/hoàn thiện:** OAuth Gmail trên tài khoản thật và CASA; còn thiếu Outlook và lớp LLM cho email lạ (đã chừa chỗ trong `parser.ts`).

### Tiền & tỷ giá
- `FxService.rateTable(target, sources, today)` lấy tỷ giá mới nhất ≤ hôm nay; job lưu đủ 12 cặp VND/USD/EUR/JPY mỗi ngày; kiểm tra khoảng hợp lý trước khi lưu.

### Gói Free / Plus
- `FREE_LIMITS` (shared): 8 subscription đang theo dõi (ACTIVE/TRIAL/REVIEW), 1 mốc nhắc, 1 nhóm. Plus = có `entitlements` còn hiệu lực (`activeEntitlementWhere`).
- Giá dự kiến: Plus tháng 29.000đ, năm 199.000đ, trọn đời 399.000đ; dùng thử 7 ngày.

## Email đăng nhập (Supabase Auth)

- App đăng nhập bằng **mã OTP 6 số** qua email (`signInWithOtp` → `verifyOtp`), không dùng link. Supabase chỉ cho OTP dài 6–10 số.
- Template "Confirm sign up" và "Magic Link" dùng chung `design/email/otp-code.html` (bảng + style inline, màu theo mockup). Sửa file rồi áp lại bằng Management API (cần `supabase login`):
  ```bash
  TOKEN=$(security find-generic-password -s "Supabase CLI" -w); TOKEN=$(echo "${TOKEN#go-keyring-base64:}" | base64 -d)
  python3 -c "import json,re;h=re.sub(r'<!--.*?-->\s*','',open('design/email/otp-code.html').read(),flags=re.S);print(json.dumps({'mailer_templates_confirmation_content':h,'mailer_templates_magic_link_content':h}))" \
    | curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @- \
      https://api.supabase.com/v1/projects/<project_ref>/config/auth
  ```
- Supabase bắt buộc SMTP riêng mới cho sửa template. Dev đang dùng **Gmail SMTP** (mật khẩu ứng dụng, ~500 email/ngày); trước khi ra mắt chuyển sang **Resend + tên miền riêng** (chỉ đổi form SMTP, app không đổi). Giới hạn gửi: 30 email/giờ, gửi lại cùng email sau 60 giây (app có đếm ngược).

## Hạn chế đã biết

- Xu hướng 6 tháng trong `/analytics` là **ước tính** (lịch sử trừ tiền mới bắt đầu ghi).
- Chi phí mỗi lần dùng dựa trên mức độ sử dụng người dùng tự chọn (`USES_PER_MONTH`).
- Giá các gói trong seed là **giá tham khảo**, chưa xác minh.
- Chia tiền nhóm chỉ hỗ trợ chu kỳ **tháng** (kỳ thu = 1 tháng), chưa chia gói năm.
- Lượt chạy nhắc nhở / tỷ giá chạy trên mọi instance API (an toàn nhờ khóa unique + upsert); khi scale nên chỉ bật ở 1 instance.
