/**
 * Cập nhật tỷ giá một lần, ngay lập tức (bỏ qua kiểm tra "đã có tỷ giá hôm nay").
 * Chạy: pnpm --filter @subca/api fx:sync
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { FxSyncRunner } from '../src/fx/fx-sync.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  }),
});

new FxSyncRunner(
  prisma as unknown as PrismaService,
  undefined,
  undefined,
  (m) => console.log(m),
)
  .run(new Date().toISOString().slice(0, 10), true)
  .then((r) => console.log(JSON.stringify(r)))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
