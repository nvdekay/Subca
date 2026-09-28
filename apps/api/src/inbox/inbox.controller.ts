import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ResolveInboxItemSchema,
  type InboxDto,
  type ResolveInboxItem,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { InboxService } from './inbox.service.js';

/** Subca Inbox — chỉ những việc cần người dùng quyết định. */
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<InboxDto> {
    return this.inbox.list(user.id);
  }

  @Post(':id/resolve')
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(ResolveInboxItemSchema)) body: ResolveInboxItem,
  ): Promise<InboxDto> {
    return this.inbox.resolve(user.id, id, body);
  }
}
