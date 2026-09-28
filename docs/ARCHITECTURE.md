# Subca — Kiến trúc & quyết định kỹ thuật

> Cập nhật: 27/09/2026. Ghi lại **vì sao** chọn như hiện tại để không phải bàn lại. Đổi quyết định nào thì sửa file này.

## Tổng quan

```
 App mobile (Expo)  ──HTTPS + JWT──▶  API (NestJS/Fastify)  ──Prisma (pooler 6543)──▶  Supabase Postgres (RLS chặn client)
        │                                   │   ▲
        │ đăng nhập                         │   └── cron: tỷ giá (07:30 VN), nhắc nhở (5 phút), push receipt (15 phút)
        ▼                                   ▼
  Supabase Auth                        Redis ◀── BullMQ (hàng đợi gửi nhắc) ──▶ Expo Push ──▶ APNs / FCM
  (Apple / Google / email OTP)
 Admin (Next.js) ──▶ API (chưa làm)
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
| Hàng đợi | **BullMQ 6 + Redis** | Dev: `docker compose` (OrbStack). Production: Redis cùng khu vực với API, giá cố định. Không dùng Upstash tính theo số lệnh (BullMQ gọi Redis liên tục). Phương án thay thế đã cân nhắc: pg-boss trên Postgres |
| Push | **Expo Push Service** | 1 API cho iOS + Android; có thể chuyển FCM/APNs trực tiếp sau |
| Tỷ giá | **ExchangeRate-API (Open Access)**, dự phòng fawazahmed0/currency-api | ECB không có VND. Điều khoản: dùng thương mại được, **bắt buộc ghi nguồn**, không phân phối lại, gọi ≤ 1 lần/ngày |
| Mua trong app | **RevenueCat** (chưa làm) | Lo App Store + Google Play, webhook → bảng `entitlements` |
| Admin | **Next.js + shadcn/ui** (chưa làm) | |
| Hosting | Railway / Render / Fly.io, **Singapore** (chưa chọn) | Cùng khu vực với Supabase production |
| Danh mục | **Bỏ khỏi sản phẩm** (27/09/2026) | Chủ dự án thấy thừa: không chọn danh mục khi thêm subscription, Phân tích không chia theo danh mục, API không còn `/catalog/categories` và `categoryId`. Bảng `categories` và cột `category_id` vẫn còn trong DB (không dùng) để khỏi migration xóa dữ liệu |

## Dữ liệu

- 26 bảng (xem `apps/api/prisma/schema.prisma`). Nhóm chính: người dùng (`profiles`, `user_settings`, `push_tokens`, `budgets`), subscription (`subscriptions`, `renewal_charges`, `reminders`, `reminder_rules`, `monthly_reviews`), thư viện (`services`, `service_plans`, `categories`, `price_reports`), thanh toán (`payment_methods`, `entitlements`, `billing_events`, `promo_codes`), chia tiền nhóm (`groups`, `group_members`, `group_cycles`, `group_payments`), hệ thống (`exchange_rates`, `feature_flags`, `admin_users`, `audit_logs`).
- Trigger trên `auth.users`: đăng ký → tạo `profiles` + `user_settings` + 4 quy tắc nhắc mặc định; xóa → xóa `profiles` (cascade toàn bộ).
- Migration: `20260927000000_init`, `20260927000100_rls_and_auth`, `20260927000200_reminder_receipts`.

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
