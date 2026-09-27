import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { addDays } from '@subca/shared';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FxSyncRunner } from './fx-sync.service.js';

const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Cập nhật tỷ giá mỗi ngày lúc 00:30 UTC (07:30 giờ Việt Nam), sau khi nhà cung cấp
 * cập nhật (~00:02 UTC). Khi khởi động, nếu tỷ giá đã cũ hơn 1 ngày thì cập nhật ngay.
 * Chạy nhiều instance cũng an toàn: ghi bằng upsert và bỏ qua nếu đã có tỷ giá hôm nay.
 */
@Injectable()
export class FxSyncJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(FxSyncJob.name);
  private readonly runner: FxSyncRunner;
  private readonly enabled: boolean;

  constructor(prisma: PrismaService, config: ConfigService<Env, true>) {
    this.runner = new FxSyncRunner(prisma, undefined, undefined, (m) =>
      this.logger.log(m),
    );
    this.enabled = config.get('FX_SYNC_ENABLED', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    // Không chặn quá trình khởi động
    void this.runner
      .latestDate()
      .then((latest) => {
        if (!latest || latest < addDays(todayUtc(), -1)) return this.sync();
        return undefined;
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Kiểm tra tỷ giá khi khởi động lỗi: ${String(error)}`,
        ),
      );
  }

  @Cron('30 0 * * *', { name: 'fx-sync', timeZone: 'UTC' })
  async sync(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.runner.run(todayUtc());
    } catch (error) {
      // Giữ tỷ giá cũ; FxService dùng tỷ giá mới nhất đang có
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
