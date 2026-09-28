import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { AccountService } from './account.service.js';
import { MeService } from './me.service.js';

@Module({
  controllers: [MeController],
  providers: [MeService, AccountService],
  // AdminModule dùng lại AccountService để xóa tài khoản người dùng
  exports: [AccountService],
})
export class MeModule {}
