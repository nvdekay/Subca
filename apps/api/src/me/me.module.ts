import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { AccountService } from './account.service.js';
import { MeService } from './me.service.js';

@Module({
  controllers: [MeController],
  providers: [MeService, AccountService],
})
export class MeModule {}
