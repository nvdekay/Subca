import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { AdminQueueDto } from '@subca/shared';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  REMINDERS_QUEUE,
  type ReminderJobData,
} from '../reminders/reminders.constants.js';

/**
 * Trang Hàng đợi của admin. Thay cho Bull Board (giao diện riêng, khó đặt sau lớp đăng nhập
 * có MFA của admin): trả số liệu hàng đợi qua API để admin tự vẽ.
 */
@Injectable()
export class AdminQueueService {
  private readonly logger = new Logger(AdminQueueService.name);

  constructor(
    @InjectQueue(REMINDERS_QUEUE)
    private readonly queue: Queue<ReminderJobData>,
    private readonly prisma: PrismaService,
  ) {}

  async get(now = new Date()): Promise<AdminQueueDto> {
    const since7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const reminders7d = await this.prisma.reminder
      .groupBy({
        by: ['status'],
        where: { scheduledAt: { gte: since7d } },
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((r) => ({ status: r.status, count: r._count._all })),
      );

    const empty: AdminQueueDto = {
      name: REMINDERS_QUEUE,
      connected: false,
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      recentFailed: [],
      reminders7d,
    };

    try {
      const [counts, failed, paused] = await Promise.all([
        this.queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'completed',
          'failed',
        ),
        this.queue.getFailed(0, 9),
        this.queue.isPaused(),
      ]);
      return {
        ...empty,
        connected: true,
        counts: {
          waiting: counts['waiting'] ?? 0,
          active: counts['active'] ?? 0,
          delayed: counts['delayed'] ?? 0,
          completed: counts['completed'] ?? 0,
          failed: counts['failed'] ?? 0,
          // BullMQ tạm dừng cả hàng đợi chứ không đếm job "paused"
          paused: paused ? (counts['waiting'] ?? 0) : 0,
        },
        recentFailed: failed.map((job) => ({
          id: String(job.id),
          reminderId: job.data?.reminderId ?? null,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason ?? null,
          finishedAt: job.finishedOn
            ? new Date(job.finishedOn).toISOString()
            : null,
        })),
      };
    } catch (error) {
      // Redis chết không được làm sập cả trang admin: trả `connected: false` để admin hiện cảnh báo
      this.logger.warn(
        `Không đọc được hàng đợi ${REMINDERS_QUEUE}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return empty;
    }
  }
}
