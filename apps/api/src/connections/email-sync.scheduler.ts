import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { ConnectionsService } from './connections.service.js';

/** Quét lại hộp thư sau bao lâu. */
const SYNC_EVERY_HOURS = 6;

/**
 * Quét định kỳ các hộp thư đã kết nối. Mỗi lượt chỉ lấy email mới kể từ `lastSyncAt`,
 * và email đã xử lý không bao giờ xử lý lại, nên chạy trùng cũng không sinh dữ liệu sai.
 */
@Injectable()
export class EmailSyncScheduler {
  private readonly logger = new Logger(EmailSyncScheduler.name);
  private running = false;

  constructor(
    private readonly connections: ConnectionsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (!this.config.get('EMAIL_SYNC_ENABLED', { infer: true })) return;
    // Lượt trước chưa xong thì bỏ qua, tránh hai lượt chồng nhau trên cùng hộp thư
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.connections.dueForSync(
        new Date(Date.now() - SYNC_EVERY_HOURS * 3600 * 1000),
      );
      for (const account of due) {
        await this.connections.sync(account.userId, account.id);
      }
      if (due.length > 0) this.logger.log(`Đã quét ${due.length} hộp thư`);
    } catch (error) {
      this.logger.error(
        `Lượt quét định kỳ lỗi: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
