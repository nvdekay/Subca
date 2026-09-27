import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  BudgetDto,
  CurrencyCode,
  SettingsDto,
  UpdateProfile,
  UpdateSettings,
  UpsertBudget,
} from '@subca/shared';
import type { Budget, UserSettings } from '../generated/prisma/client.js';
import { AccountStatusService } from '../auth/account-status.service.js';
import { SupabaseAdminClient } from '../auth/supabase-admin.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Sửa hồ sơ, cài đặt và ngân sách của người dùng hiện tại. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminClient,
    private readonly accountStatus: AccountStatusService,
  ) {}

  /**
   * Xóa vĩnh viễn tài khoản (Apple bắt buộc có trong app). Xóa tài khoản đăng nhập trên Supabase;
   * trigger on_auth_user_deleted xóa profile và toàn bộ dữ liệu liên quan (cascade).
   * Lưu ý: gói Subca Plus mua qua App Store / Google Play phải được người dùng hủy ở store.
   */
  async deleteAccount(userId: string): Promise<void> {
    if (!this.supabaseAdmin.configured) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'ACCOUNT_DELETION_UNAVAILABLE',
        message:
          'Chưa cấu hình xóa tài khoản trên máy chủ. Vui lòng liên hệ hỗ trợ.',
      });
    }
    const existed = await this.supabaseAdmin.deleteUser(userId);
    // Phòng khi tài khoản auth đã mất mà profile còn (trigger không chạy): xóa trực tiếp
    await this.prisma.profile.deleteMany({ where: { id: userId } });
    this.accountStatus.invalidate(userId);
    this.logger.log(
      `Đã xóa tài khoản ${userId}${existed ? '' : ' (tài khoản auth đã không còn)'}`,
    );
  }

  async updateProfile(
    userId: string,
    input: UpdateProfile,
  ): Promise<{ displayName: string | null }> {
    const result = await this.prisma.profile.updateMany({
      where: { id: userId },
      data: input,
    });
    if (result.count === 0) throw profileNotFound();
    return { displayName: input.displayName ?? null };
  }

  async updateSettings(
    userId: string,
    input: UpdateSettings,
  ): Promise<SettingsDto> {
    // upsert phòng khi trigger chưa tạo dòng cài đặt; chỉ tạo được nếu profile tồn tại
    const exists = await this.prisma.profile.count({ where: { id: userId } });
    if (!exists) throw profileNotFound();
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return settingsDto(settings);
  }

  async getBudget(userId: string): Promise<BudgetDto | null> {
    const budget = await this.prisma.budget.findUnique({ where: { userId } });
    return budget ? budgetDto(budget) : null;
  }

  async upsertBudget(userId: string, input: UpsertBudget): Promise<BudgetDto> {
    const exists = await this.prisma.profile.count({ where: { id: userId } });
    if (!exists) throw profileNotFound();
    const data = {
      amountMinor: BigInt(input.amountMinor),
      currency: input.currency,
      alertAtPercent: input.alertAtPercent,
    };
    const budget = await this.prisma.budget.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return budgetDto(budget);
  }

  async deleteBudget(userId: string): Promise<void> {
    await this.prisma.budget.deleteMany({ where: { userId } });
  }
}

function profileNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'PROFILE_NOT_FOUND',
    message: 'Không tìm thấy hồ sơ',
  });
}

function settingsDto(s: UserSettings): SettingsDto {
  return {
    currency: s.currency as CurrencyCode,
    timezone: s.timezone,
    locale: s.locale,
    reminderMinuteOfDay: s.reminderMinuteOfDay,
    notificationsEnabled: s.notificationsEnabled,
    marketingOptIn: s.marketingOptIn,
  };
}

function budgetDto(b: Budget): BudgetDto {
  return {
    amountMinor: b.amountMinor.toString(),
    currency: b.currency as CurrencyCode,
    alertAtPercent: b.alertAtPercent,
  };
}
