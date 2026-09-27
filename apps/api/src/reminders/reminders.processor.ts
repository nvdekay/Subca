import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReminderSender, type SendOutcome } from './reminder-sender.service.js';
import {
  REMINDERS_QUEUE,
  type ReminderJobData,
} from './reminders.constants.js';

/** Worker lấy job từ hàng đợi và gửi nhắc. Lỗi tạm thời được BullMQ thử lại theo cấu hình của queue. */
@Processor(REMINDERS_QUEUE, { concurrency: 10 })
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly sender: ReminderSender,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  process(job: Job<ReminderJobData>): Promise<SendOutcome> {
    return this.sender.send(job.data.reminderId);
  }

  /** Hết số lần thử → đánh dấu FAILED để admin thấy, thay vì để PENDING rồi hết hạn. */
  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<ReminderJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    this.logger.error(
      `Lượt nhắc ${job.data.reminderId} thất bại sau ${job.attemptsMade} lần: ${error.message}`,
    );
    await this.prisma.reminder.updateMany({
      where: { id: job.data.reminderId, status: 'PENDING' },
      data: { status: 'FAILED', error: error.message.slice(0, 500) },
    });
  }
}
