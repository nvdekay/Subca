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
} from '@nestjs/common';
import {
  CreatePaymentMethodSchema,
  UpdatePaymentMethodSchema,
  type CreatePaymentMethod,
  type PaymentMethodDto,
  type UpdatePaymentMethod,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PaymentMethodsService } from './payment-methods.service.js';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PaymentMethodDto[]> {
    return this.methods.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreatePaymentMethodSchema))
    body: CreatePaymentMethod,
  ): Promise<PaymentMethodDto> {
    return this.methods.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(UpdatePaymentMethodSchema))
    body: UpdatePaymentMethod,
  ): Promise<PaymentMethodDto> {
    return this.methods.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<void> {
    return this.methods.archive(user.id, id);
  }
}
