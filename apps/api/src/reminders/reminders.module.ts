import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ReceiptChecker } from './receipt-checker.service.js';
import { ReminderFeedService } from './reminder-feed.service.js';
import { ReminderSender } from './reminder-sender.service.js';
import { RemindersController } from './reminders.controller.js';
import { REMINDERS_QUEUE } from './reminders.constants.js';
import { RemindersProcessor } from './reminders.processor.js';
import { RemindersScheduler } from './reminders.scheduler.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: REMINDERS_QUEUE,
      defaultJobOptions: {
        // Lỗi tạm thời (mạng, Expo) thử lại 3 lần: sau 1, 2, 4 phút
        attempts: 4,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    }),
  ],
  controllers: [RemindersController],
  providers: [
    RemindersScheduler,
    ReminderSender,
    RemindersProcessor,
    ReceiptChecker,
    ReminderFeedService,
  ],
})
export class RemindersModule {}
