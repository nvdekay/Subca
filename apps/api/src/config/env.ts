import { z } from 'zod';

/** Biến môi trường của API, kiểm tra ngay khi khởi động để lỗi cấu hình lộ ra sớm. */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  // Dùng để xác minh token đăng nhập (JWKS + issuer)
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Redis cho hàng đợi BullMQ (dev: docker compose up -d)
  REDIS_URL: z.url().default('redis://localhost:6379'),
  // Tắt bộ lập lịch nhắc nhở (worker vẫn chạy để xử lý job còn trong hàng đợi)
  REMINDERS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Tùy chọn: bật "Enhanced Push Security" trên Expo thì cần access token
  EXPO_ACCESS_TOKEN: z.string().optional(),
  // Tắt job cập nhật tỷ giá (VD khi chạy nhiều instance chỉ cần 1 nơi chạy, hoặc khi test)
  FX_SYNC_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Biến môi trường không hợp lệ:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
