import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// CLI của Prisma (migrate, studio) dùng kết nối TRỰC TIẾP (cổng 5432).
// Ứng dụng lúc chạy dùng connection pooler (DATABASE_URL, cổng 6543) qua @prisma/adapter-pg.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? '',
    // Chỉ truyền khi có giá trị: Prisma báo lỗi nếu là chuỗi rỗng
    ...(process.env['SHADOW_DATABASE_URL']
      ? { shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'] }
      : {}),
  },
});
