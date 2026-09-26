import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SubscriptionsService } from './subscriptions.service.js';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'ID không hợp lệ',
    }),
});

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
    @Param('id', uuidPipe) id: string,
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
    @Param('id', uuidPipe) id: string,
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
    @Param('id', uuidPipe) id: string,
  ): Promise<void> {
    return this.subscriptions.archive(user.id, id);
  }
}
