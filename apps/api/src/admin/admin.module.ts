import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MeModule } from '../me/me.module.js';
import { REMINDERS_QUEUE } from '../reminders/reminders.constants.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import { AdminOverviewService } from './admin-overview.service.js';
import { AdminQueueService } from './admin-queue.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AuditService } from './audit.service.js';

@Module({
  // Dùng lại hàng đợi nhắc (chỉ đọc số liệu) và AccountService để xóa tài khoản
  imports: [BullModule.registerQueue({ name: REMINDERS_QUEUE }), MeModule],
  controllers: [AdminController],
  providers: [
    AdminGuard,
    AuditService,
    AdminOverviewService,
    AdminUsersService,
    AdminCatalogService,
    AdminQueueService,
  ],
})
export class AdminModule {}
