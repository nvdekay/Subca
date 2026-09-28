# Subca Admin Console

Bảng quản trị Subca (Next.js 16 + Tailwind 4). Dữ liệu lấy qua API NestJS (`apps/api`), không đọc thẳng database.

## Chạy

```bash
cp .env.example .env.local     # điền SUPABASE URL + anon key
pnpm --filter @subca/api dev   # API phải chạy trước
pnpm --filter @subca/admin dev # http://localhost:3000 (đổi cổng: -p 3100)
```

## Đăng nhập

Đăng nhập bằng **email + mật khẩu** (tài khoản Supabase Auth). Email phải có trong bảng `admin_users` và đang bật, nếu không API trả `NOT_ADMIN`.

Tài khoản đầu tiên tạo bằng script (ghi thẳng vào `auth.users`, dùng được cả khi máy chủ chưa có service role key):

```bash
pnpm --filter @subca/api admin:create -- admin@subca.app "Tên hiển thị"
# mật khẩu sinh ngẫu nhiên, ghi vào .admin-account.local ở gốc repo (đã gitignore)
```

Các tài khoản sau thêm ngay trong trang **Nhân sự & phân quyền** — cần `SUPABASE_SERVICE_ROLE_KEY` trong `apps/api/.env` (thiếu thì trang báo rõ và chỉ cho đổi vai trò / bật tắt).

**Xác thực hai bước:** tắt mặc định để đăng nhập bằng mật khẩu. Đặt `ADMIN_REQUIRE_MFA=true` trong `apps/api/.env` (nên bật ở production) thì API trả `MFA_REQUIRED` và trang đăng nhập tự chuyển sang bước quét QR / nhập mã TOTP.

**CORS:** API chỉ nhận request từ origin khai trong `CORS_ORIGINS` (mặc định `http://localhost:3100,http://localhost:3101`).

## Trang

| Trang                | Nội dung                                                                      |
| -------------------- | ----------------------------------------------------------------------------- |
| Tổng quan            | Người dùng, subscription, tiền đang theo dõi, nhắc nhở 7 ngày, nhóm chia tiền |
| Người dùng           | Tìm kiếm, lọc gói / trạng thái, chi tiết, khóa, tặng Plus, xóa dữ liệu        |
| Thư viện dịch vụ     | Thêm / sửa dịch vụ, duyệt đề xuất giá của người dùng                          |
| Hàng đợi nhắc        | Số liệu BullMQ và job lỗi gần nhất (thay cho Bull Board)                      |
| Nhân sự & phân quyền | Thêm / gỡ tài khoản quản trị, đổi vai trò, bật tắt, đặt lại mật khẩu          |
| Nhật ký hoạt động    | Mọi thao tác admin kèm IP và mức độ                                           |

## Phân quyền

`OWNER` toàn quyền (kể cả nhân sự) · `ADMIN` toàn quyền trừ nhân sự · `SUPPORT` xử lý người dùng · `MARKETING` sửa thư viện dịch vụ · `VIEWER` chỉ xem.
Nguồn chung: `ADMIN_PERMISSIONS` trong `packages/shared/src/api/admin.ts` (API chặn, giao diện ẩn nút).
