import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateSubscriptionSchema,
  ListSubscriptionsQuerySchema,
  UpdateSubscriptionSchema,
  type CreateSubscription,
  type ListSubscriptionsQuery,
  type SubscriptionDto,
  type SubscriptionListDto,
  type UpdateSubscription,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListSubscriptionsQuerySchema))
    query: ListSubscriptionsQuery,
  ): Promise<SubscriptionListDto> {
    return this.subscriptions.list(user.id, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<SubscriptionDto> {
    return this.subscriptions.get(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateSubscriptionSchema))
    body: CreateSubscription,
  ): Promise<SubscriptionDto> {
    return this.subscriptions.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(UpdateSubscriptionSchema))
    body: UpdateSubscription,
  ): Promise<SubscriptionDto> {
    return this.subscriptions.update(user.id, id, body);
  }

  /** Lưu trữ (xóa mềm). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<void> {
    return this.subscriptions.archive(user.id, id);
  }
}
