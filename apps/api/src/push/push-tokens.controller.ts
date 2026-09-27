import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  RegisterPushTokenSchema,
  UnregisterPushTokenSchema,
  type RegisterPushToken,
  type UnregisterPushToken,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PushTokensService } from './push-tokens.service.js';

@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly tokens: PushTokensService) {}

  /** App gọi sau khi đăng nhập và mỗi lần mở app (cập nhật lastSeenAt). */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RegisterPushTokenSchema))
    body: RegisterPushToken,
  ): Promise<void> {
    return this.tokens.register(user.id, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  unregister(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UnregisterPushTokenSchema))
    body: UnregisterPushToken,
  ): Promise<void> {
    return this.tokens.unregister(user.id, body.token);
  }
}
