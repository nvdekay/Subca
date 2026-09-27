import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
} from '@nestjs/common';
import {
  UpdateProfileSchema,
  UpdateSettingsSchema,
  UpsertBudgetSchema,
  type BudgetDto,
  type SettingsDto,
  type UpdateProfile,
  type UpdateSettings,
  type UpsertBudget,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AccountService } from './account.service.js';
import { MeService, type MeResponse } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly account: AccountService,
  ) {}

  /** Hồ sơ + cài đặt + gói hiện tại của người dùng đang đăng nhập. App gọi ngay sau khi đăng nhập. */
  @Get()
  getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.me.getMe(user);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfile,
  ): Promise<{ displayName: string | null }> {
    return this.account.updateProfile(user.id, body);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) body: UpdateSettings,
  ): Promise<SettingsDto> {
    return this.account.updateSettings(user.id, body);
  }

  @Get('budget')
  getBudget(@CurrentUser() user: AuthUser): Promise<BudgetDto | null> {
    return this.account.getBudget(user.id);
  }

  @Put('budget')
  upsertBudget(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpsertBudgetSchema)) body: UpsertBudget,
  ): Promise<BudgetDto> {
    return this.account.upsertBudget(user.id, body);
  }

  @Delete('budget')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBudget(@CurrentUser() user: AuthUser): Promise<void> {
    return this.account.deleteBudget(user.id);
  }
}
