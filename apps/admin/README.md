# Subca Admin Console

Bảng quản trị Subca (Next.js 16 + Tailwind 4). Dữ liệu lấy qua API NestJS (`apps/api`), không đọc thẳng database.

## Chạy

```bash
cp .env.example .env.local     # điền SUPABASE URL + anon key
pnpm --filter @subca/api dev   # API phải chạy trước
pnpm --filter @subca/admin dev # http://localhost:3000 (đổi cổng: -p 3100)
```

## Đăng nhập

1. Nhập email quản trị → Supabase gửi mã 6 số (cùng luồng OTP với app).
2. **Bắt buộc xác thực hai bước:** lần đầu quét mã QR bằng Google Authenticator / 1Password, các lần sau nhập mã 6 số. API từ chối mọi request `/admin/*` nếu phiên chưa đạt `aal2`.
3. Email phải có trong bảng `admin_users` và đang bật, nếu không API trả `NOT_ADMIN`.

Thêm admin đầu tiên (chạy trên database, sau khi tài khoản đã đăng nhập app ít nhất 1 lần để có trong `auth.users`):

```sql
insert into admin_users (id, email, name, role)
select id, email, 'Tên hiển thị', 'OWNER' from auth.users where email = 'ban@subca.app';
```

## Trang

| Trang             | Nội dung                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| Tổng quan         | Người dùng, subscription, tiền đang theo dõi, nhắc nhở 7 ngày, nhóm chia tiền |
| Người dùng        | Tìm kiếm, lọc gói / trạng thái, chi tiết, khóa, tặng Plus, xóa dữ liệu        |
| Thư viện dịch vụ  | Thêm / sửa dịch vụ, duyệt đề xuất giá của người dùng                          |
| Hàng đợi nhắc     | Số liệu BullMQ và job lỗi gần nhất (thay cho Bull Board)                      |
| Nhật ký hoạt động | Mọi thao tác admin kèm IP và mức độ                                           |

## Phân quyền

`OWNER`, `ADMIN` toàn quyền · `SUPPORT` xử lý người dùng · `MARKETING` sửa thư viện dịch vụ · `VIEWER` chỉ xem.
Nguồn chung: `ADMIN_PERMISSIONS` trong `packages/shared/src/api/admin.ts` (API chặn, giao diện ẩn nút).
