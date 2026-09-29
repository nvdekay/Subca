# Subca Mobile

Ứng dụng iOS/Android của Subca — React Native 0.86, Expo SDK 57, Expo Router, TypeScript, NativeWind và TanStack Query. App dùng Supabase Auth cho phiên đăng nhập; dữ liệu nghiệp vụ đi qua API NestJS.

## Chạy local

Yêu cầu Node 22+, pnpm 11, Xcode/iOS Simulator cho iOS hoặc Android Studio cho Android. App có native modules (đặc biệt MMKV), vì vậy dùng development build thay vì Expo Go.

```bash
cp .env.example .env.local
# Điền EXPO_PUBLIC_SUPABASE_ANON_KEY và kiểm tra EXPO_PUBLIC_API_URL
pnpm --filter @subca/mobile dev
```

Chạy API + Redis trong terminal khác:

```bash
docker compose up -d
pnpm --filter @subca/api dev
```

Build/cài lên simulator hoặc emulator:

```bash
pnpm --filter @subca/mobile ios
pnpm --filter @subca/mobile android
```

Trên simulator iOS dùng `http://localhost:3000`; Android emulator dùng `http://10.0.2.2:3000`; điện thoại thật cần IP LAN của máy chạy API. Chỉ `EXPO_PUBLIC_*` được nhúng vào app; tuyệt đối không đặt service-role key hoặc bí mật server trong `.env.local`.

Nếu Xcode báo `framework 'React' not found` khi cài Pods trên cấu hình máy này, Pods prebuilt có thể thiếu binary. Thử build React Native từ source:

```bash
cd ios
RCT_USE_RN_DEP=0 RCT_USE_PREBUILT_RNCORE=0 pod install
cd ../..
RCT_USE_RN_DEP=0 RCT_USE_PREBUILT_RNCORE=0 pnpm --filter @subca/mobile ios
```

## Điều hướng hiện tại

- Tab chính: Trang chủ, Gói của tôi, Cần chú ý (Inbox), Phân tích.
- Onboarding đầu tiên: giới thiệu → kết nối Gmail → scan nền → kết quả; có thể bỏ qua hoặc tự thêm gói.
- Route phụ vẫn có: Lịch, Review, chi tiết/chỉnh sửa subscription, Trial, Ngân sách, Phương thức thanh toán, Nhóm, Kết nối Gmail, Thông báo và Hồ sơ.
- Prototype `design/Subca V2.html` là tham chiếu tương tác, không phải hợp đồng API. OCR ảnh/forward email trong prototype chưa được backend hỗ trợ. Category analytics không thuộc quyết định sản phẩm hiện tại.

## Kiểm tra

```bash
pnpm --filter @subca/mobile typecheck
pnpm --filter @subca/mobile lint
```

Đọc [`AGENTS.md`](AGENTS.md) trước khi đổi Expo/React Native API; tài liệu Expo phải khớp SDK 57. Tổng quan dự án và backlog ở [`docs/PROJECT-KNOWLEDGE.md`](../../docs/PROJECT-KNOWLEDGE.md) và [`docs/SUBCA-CHECKLIST.md`](../../docs/SUBCA-CHECKLIST.md).
