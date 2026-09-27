import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  UpdateReminderRulesSchema,
  type ReminderRuleDto,
  type RemindersDto,
  type UpdateReminderRules,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReminderFeedService } from './reminder-feed.service.js';

@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feed: ReminderFeedService,
  ) {}

  /** Màn Thông báo: nhắc đã gửi 30 ngày qua + nhắc sẽ gửi 30 ngày tới (1 request). */
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<RemindersDto> {
    return this.feed.feed(user.id);
  }

  @Get('rules')
  rules(@CurrentUser() user: AuthUser): Promise<ReminderRuleDto[]> {
    return this.feed.rules(user.id);
  }

  @Put('rules')
  replaceRules(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateReminderRulesSchema))
    body: UpdateReminderRules,
  ): Promise<ReminderRuleDto[]> {
    return this.feed.replaceRules(user.id, body);
  }

  /** App gọi khi người dùng bấm vào thông báo nhắc (đo tỷ lệ mở). Chỉ ghi lần đầu. */
  @Post(':id/opened')
  @HttpCode(HttpStatus.NO_CONTENT)
  async opened(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<void> {
    await this.prisma.reminder.updateMany({
      where: { id, userId: user.id, openedAt: null },
      data: { openedAt: new Date() },
    });
  }
}
