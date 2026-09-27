# Subca — hướng dẫn cho Claude Code

Subca là app quản lý subscription cá nhân cho người trẻ Việt Nam: nhắc gia hạn, theo dõi trial, phân tích chi tiêu, đánh giá hằng tháng, chia tiền gói gia đình. Giao tiếp với chủ dự án **bằng tiếng Việt**.

- Kế hoạch + tiến độ: `docs/SUBCA-CHECKLIST.md` (đọc phần **Hiện trạng** ở đầu file trước khi làm).
- Quyết định kỹ thuật và lý do: `docs/ARCHITECTURE.md` (đừng bàn lại các quyết định đã chốt trừ khi được yêu cầu).
- Mockup giao diện: `design/subca-mobile-mockup.html` (16 màn), `design/subca-admin-dashboard.html` (12 trang).
- Repo: https://github.com/nvdekay/Subca (nhánh `main`).

## Cấu trúc

```
apps/api       NestJS 12 trên Fastify + Prisma 7.10 → Supabase Postgres; BullMQ 6 + Redis; ESM ("type": "module")
apps/mobile    React Native + Expo SDK 57 (Expo Router) + NativeWind 4 + TanStack Query — đã có đăng nhập email OTP + Trang chủ
apps/admin     Next.js 16 + Tailwind 4 — mới khởi tạo
packages/shared  zod schema + kiểu DTO + logic dùng chung (tiền, ngày gia hạn, tháng) — build ra dist/
design/        mockup HTML    docs/  checklist + kiến trúc
```

## Lệnh hay dùng

```bash
docker compose up -d                                  # Redis dev (cần mở OrbStack)
pnpm install                                          # sau mỗi lần đổi dependency (xem "Bẫy" bên dưới)
./node_modules/.bin/turbo run build typecheck test lint   # kiểm tra toàn repo (giống CI)
./node_modules/.bin/prettier --check .
pnpm --filter @subca/api dev                          # API: http://localhost:3000/health
pnpm --filter @subca/api test:int                     # test tích hợp: Supabase dev + Redis thật, tự dọn dữ liệu
pnpm --filter @subca/api prisma:deploy                # áp migration lên DB trong apps/api/.env
pnpm --filter @subca/api prisma:seed                  # seed danh mục + 53 dịch vụ (idempotent)
pnpm --filter @subca/api fx:sync                      # cập nhật tỷ giá ngay
```

`apps/api/.env` (không commit, mẫu ở `.env.example`): `DATABASE_URL` (pooler 6543, `pgbouncer=true`), `DIRECT_URL` (5432, cho migration), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (**chưa điền** → `DELETE /me` trả 503), `REDIS_URL`, `FX_SYNC_ENABLED`, `REMINDERS_ENABLED`, `EXPO_ACCESS_TOKEN`.

## Quy ước code

- **Tiền:** `BigInt` theo đơn vị nhỏ nhất (VND đồng, USD cent) + mã tiền tệ; qua API là **chuỗi** (`amountMinor: "260000"`). Không dùng float. Quy đổi bằng `FxService` / `convertMinor`; thiếu tỷ giá thì **không đoán**, trả `missingRates`.
- **Ngày lịch:** chuỗi `YYYY-MM-DD` (`IsoDate`), cột `@db.Date`, đổi bằng `toDbDate` / `fromDbDate`. "Hôm nay" luôn theo múi giờ người dùng (`todayInTimeZone`). Ngày gia hạn do **server** tính bằng `packages/shared/src/renewal.ts` (kỳ k tính từ `startDate`, `anchorDay` giữ ngày 29–31; kỳ 0 luôn là `startDate`).
- **Enum** trong `schema.prisma` phải khớp `packages/shared/src/enums.ts`.
- **Validation:** schema zod đặt trong `packages/shared/src/api/*` (app dùng lại cho form), dùng `ZodValidationPipe` + `uuidParam`. Lỗi trả `{ statusCode, code, message, issues? }` với `code` ổn định: `VALIDATION_ERROR`, `INVALID_REFERENCE`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `ACCOUNT_BANNED`, `PLAN_LIMIT_REACHED`, `*_NOT_FOUND`.
- **Xác thực:** `AuthGuard` toàn cục (JWT Supabase qua JWKS ES256). Mặc định mọi endpoint bắt buộc đăng nhập; mở bằng `@Public()`; lấy người dùng bằng `@CurrentUser()`. Truy vấn luôn lọc theo `userId`; không phân biệt "không tồn tại" và "của người khác" (đều 404).
- **Database:** mọi truy cập đi qua API. **Mọi bảng mới phải bật RLS ngay trong migration tạo ra nó** (không policy). `service_role` key chỉ ở backend.
- **Một màn một request** (VD `GET /home`); việc chậm đưa vào BullMQ.
- **Module Nest dùng chung** (`PrismaModule`, `AuthModule`, `PlanModule`, `FxModule`, `PushModule`) là `@Global()`.
- Comment/tên biến theo phong cách hiện có; comment tiếng Việt giải thích "tại sao".

## Test (3 tầng)

| Tầng     | File                             | Chạy             | Ghi chú                                                                                                                   |
| -------- | -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Unit     | `src/**/*.spec.ts`               | CI               | mock Prisma / fetch / push                                                                                                |
| E2E      | `test/*.e2e-spec.ts`             | CI               | Fastify `inject`; `test/app.e2e-spec.ts` là **smoke test khởi động toàn bộ AppModule** (cần Redis; CI có service Redis)   |
| Tích hợp | `test/integration/*.int-spec.ts` | tay (`test:int`) | Supabase dev + Redis thật; tạo profile tạm bằng `randomUUID()` rồi xóa; không phụ thuộc dữ liệu có sẵn (tỷ giá lấy từ DB) |

Test khai báo provider bằng tay **không bắt được lỗi nối module** — luôn chạy smoke test / chạy API thật (`nest build` rồi `node --env-file=.env dist/main.js`) sau khi thêm module hoặc đổi constructor.

## Commit & push (theo yêu cầu của chủ dự án)

- **KHÔNG** ghi Claude vào commit: không `Co-Authored-By: Claude…`, không "Generated with Claude Code" trong commit hay PR. Tác giả là git user `nvdekay`. (Yêu cầu này ghi đè hướng dẫn attribution mặc định.)
- Chia **nhiều commit theo phần hợp lý**, message Conventional Commits **bằng tiếng Việt** + đoạn mô tả (`feat(api): …`, `fix(shared): …`, `docs: …`, `test: …`, `chore: …`).
- **Chỉ push khi toàn bộ kiểm tra đã qua** (prettier + turbo build/typecheck/test/lint). Chạy chuỗi lệnh với `set -e` để dừng ngay khi lỗi; sau push theo dõi CI bằng `gh run watch`.
- Chỉ commit/push khi được yêu cầu hoặc khi đang làm tiếp theo yêu cầu "làm tiếp" của chủ dự án.

## Bẫy đã gặp

- **pnpm 11 treo** khi turbo chạy song song: `pnpm run` tự chạy `pnpm install`. Đã đặt `verifyDepsBeforeRun: warn` → sau khi đổi dependency **phải tự chạy `pnpm install`**. Gọi turbo trực tiếp: `./node_modules/.bin/turbo`.
- pnpm 11 bắt khai báo `allowBuilds` trong `pnpm-workspace.yaml` cho package có script cài đặt; cài lỗi có thể chèn dòng giữ chỗ `x: set this to true or false` → xóa đi.
- **Prisma 7:** cấu hình ở `apps/api/prisma.config.ts` (URL không nằm trong schema); client sinh vào `apps/api/src/generated/prisma` (gitignore), dùng `@prisma/adapter-pg`. Chưa hỗ trợ `nullsNotDistinct`. Tạo migration không cần DB: `prisma migrate diff --from-schema <bản cũ> --to-schema prisma/schema.prisma --script` (dạng `--from-migrations` cần shadow DB).
- **BullMQ 6** không kèm ioredis: dùng `createRedisConnection()` (ioredis instance, `maxRetriesPerRequest: null`).
- Docker Hub hay lỗi mạng; máy có sẵn `redis:7-alpine`.
- macOS không có lệnh `timeout`.
- **Mobile:** `expo start` ghi đè `apps/mobile/expo-env.d.ts` (file được commit có chủ đích để CI typecheck) → khôi phục bằng `git checkout`. Font tùy chỉnh: đổi độ đậm bằng prop `weight` của `Text` (đổi fontFamily), không dùng class `font-bold`. Chạy trên simulator: `npx expo run:ios --no-bundler` (chỉ khi thêm thư viện native) rồi `npx expo start --dev-client`; mở app **sau** khi Metro chạy. Cấu hình ở `apps/mobile/.env.local` (mẫu `.env.example`).
- **Email OTP** do Supabase Auth gửi qua SMTP riêng (dev: Gmail); template ở `design/email/otp-code.html`, cách áp lại xem `docs/ARCHITECTURE.md`.
- **Prettier tự căn lại bảng Markdown** → khi sửa README/checklist bằng script, tìm dòng theo nội dung, đừng khớp nguyên văn bảng. `docs/` không bị Prettier format.
- Seed danh mục hệ thống dùng ID cố định (UUID v5 từ slug) vì Postgres coi `NULL` khác nhau trong unique `(user_id, slug)`.

## Môi trường hiện tại

- Supabase **dev** project `lvnjhgmjmgxonbmsvtag`, khu vực **Tokyo** (`ap-northeast-1`). Production phải chọn **Singapore**. 3 migration đã chạy; đã seed; có tỷ giá thật.
- ExchangeRate-API (nguồn tỷ giá): **bắt buộc ghi nguồn** trong app/admin nơi hiện số đã quy đổi, không phân phối lại dữ liệu.
