import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MeService, type MeResponse } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Hồ sơ + cài đặt + gói hiện tại của người dùng đang đăng nhập. App gọi ngay sau khi đăng nhập. */
  @Get()
  getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.me.getMe(user);
  }
}
