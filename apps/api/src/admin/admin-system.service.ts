import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AUDIT_ACTIONS,
  todayInTimeZone,
  type AdminFeaturesDto,
  type AdminHealthCheckDto,
  type AdminSystemDto,
  type FeatureFlagDto,
  type FeatureUsageRowDto,
  type UpdateFeatureFlag,
} from '@subca/shared';
import type { Queue } from 'bullmq';
import { fromDbDate } from '../common/db-date.js';
import type { Env } from '../config/env.js';
import type { AdminUser } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REMINDERS_QUEUE } from '../reminders/reminders.constants.js';
import {
  DEFAULT_TIMEZONE,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';
import { AuditService } from './audit.service.js';

/** Lượt nhắc quá hạn quá mức này mà vẫn PENDING → bộ lập lịch có vấn đề. */
const REMINDER_LAG_MS = 30 * 60 * 1000;
/** Tỷ giá cũ hơn mức này thì cảnh báo (job chạy hằng ngày). */
const FX_STALE_DAYS = 2;

/** Trang Sức khỏe hệ thống và Sử dụng tính năng. */
@Injectable()
export class AdminSystemService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  async system(now = new Date()): Promise<AdminSystemDto> {
    const [database, redis, reminders, exchangeRates, push] = await Promise.all(
      [
        this.checkDatabase(),
        this.checkRedis(),
        this.checkReminders(now),
        this.checkExchangeRates(now),
        this.checkPush(),
      ],
    );
    return {
      checks: [database, redis, reminders, exchangeRates, push],
      api: {
        env: this.config.get('NODE_ENV', { infer: true }),
        uptimeSeconds: Math.round(process.uptime()),
        remindersEnabled: this.config.get('REMINDERS_ENABLED', { infer: true }),
        fxSyncEnabled: this.config.get('FX_SYNC_ENABLED', { infer: true }),
        adminRequireMfa: this.config.get('ADMIN_REQUIRE_MFA', { infer: true }),
      },
    };
  }

  private async checkDatabase(): Promise<AdminHealthCheckDto> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`select 1`;
      const ms = Date.now() - started;
      return {
        key: 'database',
        label: 'Database (Supabase)',
        status: ms > 500 ? 'warn' : 'ok',
        detail: `Phản hồi ${ms} ms`,
      };
    } catch (error) {
      return {
        key: 'database',
        label: 'Database (Supabase)',
        status: 'down',
        detail: message(error),
      };
    }
  }

  private async checkRedis(): Promise<AdminHealthCheckDto> {
    try {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      return {
        key: 'redis',
        label: 'Redis & hàng đợi nhắc',
        status: (counts['failed'] ?? 0) > 0 ? 'warn' : 'ok',
        detail: `${counts['waiting'] ?? 0} chờ · ${counts['delayed'] ?? 0} hẹn giờ · ${counts['failed'] ?? 0} lỗi`,
      };
    } catch (error) {
      return {
        key: 'redis',
        label: 'Redis & hàng đợi nhắc',
        status: 'down',
        detail: message(error),
      };
    }
  }

  /** Lượt nhắc đến hạn lâu rồi mà vẫn PENDING nghĩa là bộ lập lịch không chạy. */
  private async checkReminders(now: Date): Promise<AdminHealthCheckDto> {
    const enabled = this.config.get('REMINDERS_ENABLED', { infer: true });
    const overdue = await this.prisma.reminder.count({
      where: {
        status: 'PENDING',
        scheduledAt: { lt: new Date(now.getTime() - REMINDER_LAG_MS) },
      },
    });
    if (!enabled) {
      return {
        key: 'reminders',
        label: 'Bộ lập lịch nhắc',
        status: 'warn',
        detail: 'Đang tắt (REMINDERS_ENABLED=false)',
      };
    }
    return {
      key: 'reminders',
      label: 'Bộ lập lịch nhắc',
      status: overdue > 0 ? 'warn' : 'ok',
      detail:
        overdue > 0
          ? `${overdue} lượt nhắc quá hạn chưa gửi`
          : 'Không có lượt nhắc quá hạn',
    };
  }

  private async checkExchangeRates(now: Date): Promise<AdminHealthCheckDto> {
    const latest = await this.prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!latest) {
      return {
        key: 'exchangeRates',
        label: 'Tỷ giá',
        status: 'down',
        detail: 'Chưa có tỷ giá nào trong database',
      };
    }
    const asOf = fromDbDate(latest.date);
    const today = todayInTimeZone(DEFAULT_TIMEZONE, now);
    const days = Math.round(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) /
        86_400_000,
    );
    return {
      key: 'exchangeRates',
      label: 'Tỷ giá',
      status: days > FX_STALE_DAYS ? 'warn' : 'ok',
      detail:
        days <= 0
          ? `Mới nhất hôm nay (${asOf})`
          : `Mới nhất ${asOf} (${days} ngày trước)`,
    };
  }

  private async checkPush(): Promise<AdminHealthCheckDto> {
    const [tokens, failed7d] = await Promise.all([
      this.prisma.pushToken.count(),
      this.prisma.reminder.count({
        where: {
          status: 'FAILED',
          scheduledAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
      }),
    ]);
    return {
      key: 'push',
      label: 'Thông báo đẩy',
      status: tokens === 0 ? 'warn' : failed7d > 0 ? 'warn' : 'ok',
      detail:
        tokens === 0
          ? 'Chưa có thiết bị nào đăng ký nhận thông báo'
          : `${tokens} thiết bị · ${failed7d} lượt gửi lỗi trong 7 ngày`,
    };
  }

  // ─────────────── Sử dụng tính năng ───────────────

  async features(): Promise<AdminFeaturesDto> {
    const [
      totalUsers,
      withSubscription,
      withThreeSubs,
      withBudget,
      withGroup,
      withReview,
      withPaymentMethod,
      withCustomReminder,
      notificationsOff,
      withUsage,
      flags,
    ] = await Promise.all([
      this.prisma.profile.count(),
      this.prisma.subscription
        .findMany({
          where: { status: { in: TRACKED_STATUSES } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length),
      this.prisma.subscription
        .groupBy({
          by: ['userId'],
          where: { status: { in: TRACKED_STATUSES } },
          _count: { _all: true },
        })
        .then((rows) => rows.filter((r) => r._count._all >= 3).length),
      this.prisma.budget.count(),
      this.prisma.groupMember
        .findMany({
          where: { status: { not: 'LEFT' }, userId: { not: null } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length),
      this.prisma.monthlyReview
        .findMany({ select: { userId: true }, distinct: ['userId'] })
        .then((rows) => rows.length),
      this.prisma.paymentMethod
        .findMany({
          where: { archivedAt: null },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length),
      this.prisma.subscription
        .findMany({
          where: { reminderOffsets: { isEmpty: false } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length),
      this.prisma.userSettings.count({
        where: { notificationsEnabled: false },
      }),
      this.prisma.subscription
        .findMany({
          where: { usageFrequency: { not: null } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length),
      this.prisma.featureFlag.findMany({
        orderBy: { key: 'asc' },
        include: { updatedBy: { select: { name: true } } },
      }),
    ]);

    const row = (
      key: string,
      label: string,
      users: number,
      note?: string,
    ): FeatureUsageRowDto => ({
      key,
      label,
      users,
      percent: totalUsers > 0 ? Math.round((users / totalUsers) * 100) : 0,
      ...(note ? { note } : {}),
    });

    return {
      totalUsers,
      usage: [
        row('subscription', 'Thêm subscription', withSubscription),
        row(
          'activated',
          'Kích hoạt (từ 3 subscription)',
          withThreeSubs,
          'Chỉ số kích hoạt chính',
        ),
        row('paymentMethod', 'Phương thức thanh toán', withPaymentMethod),
        row('budget', 'Đặt ngân sách tháng', withBudget),
        row('review', 'Đánh giá hằng tháng', withReview),
        row('group', 'Chia tiền nhóm', withGroup),
        row('customReminder', 'Mốc nhắc riêng cho gói', withCustomReminder),
        row('usageFrequency', 'Khai mức độ sử dụng', withUsage),
        row(
          'notificationsOff',
          'Đã tắt thông báo',
          notificationsOff,
          'Càng thấp càng tốt',
        ),
      ],
      flags: flags.map(toFlagDto),
    };
  }

  async setFlag(
    admin: AdminUser,
    key: string,
    input: UpdateFeatureFlag,
    ip: string | null,
  ): Promise<FeatureFlagDto> {
    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled: input.enabled, updatedById: admin.id },
      include: { updatedBy: { select: { name: true } } },
    });
    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.featureFlagUpdate,
      targetType: 'feature_flag',
      targetId: key,
      metadata: { enabled: input.enabled },
      severity: 'SENSITIVE',
      ip,
    });
    return toFlagDto(updated);
  }
}

function toFlagDto(row: {
  key: string;
  description: string | null;
  enabled: boolean;
  updatedAt: Date;
  updatedBy: { name: string } | null;
}): FeatureFlagDto {
  return {
    key: row.key,
    description: row.description,
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy?.name ?? null,
  };
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
