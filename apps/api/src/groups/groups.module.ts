import { Module } from '@nestjs/common';
import { GroupNotifier } from './group-notifier.service.js';
import { GroupPaymentsService } from './group-payments.service.js';
import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, GroupPaymentsService, GroupNotifier],
})
export class GroupsModule {}
