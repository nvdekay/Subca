import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly prisma: PrismaService) {}

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
