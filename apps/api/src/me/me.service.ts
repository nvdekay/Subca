import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FREE_LIMITS } from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Chỉ ghi lại "hoạt động gần nhất" tối đa 1 lần/giờ để tránh ghi DB mỗi request. */
const LAST_ACTIVE_THROTTLE_MS = 60 * 60 * 1000;

export interface MeResponse {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  referralCode: string;
  createdAt: Date;
  settings: {
    currency: string;
    timezone: string;
    locale: string;
    reminderMinuteOfDay: number;
    notificationsEnabled: boolean;
  } | null;
  plan: {
    tier: 'FREE' | 'PLUS';
    product: string | null;
    status: string | null;
    expiresAt: Date | null;
    willRenew: boolean | null;
  };
  /** Giới hạn gói Free; null khi đang có Plus. */
  limits: typeof FREE_LIMITS | null;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: AuthUser, now = new Date()): Promise<MeResponse> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: user.id },
      include: {
        settings: true,
        entitlements: {
          where: {
            status: { not: 'EXPIRED' },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: [{ expiresAt: { sort: 'desc', nulls: 'first' } }],
          take: 1,
        },
      },
    });
    if (!profile) {
      // Profile được trigger tạo khi đăng ký; thiếu là dấu hiệu trigger chưa chạy hoặc đã bị xóa
      throw new NotFoundException({
        statusCode: 404,
        code: 'PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ',
      });
    }
    if (profile.bannedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ACCOUNT_BANNED',
        message: 'Tài khoản đã bị khóa',
      });
    }

    if (
      !profile.lastActiveAt ||
      now.getTime() - profile.lastActiveAt.getTime() > LAST_ACTIVE_THROTTLE_MS
    ) {
      await this.prisma.profile.update({
        where: { id: user.id },
        data: { lastActiveAt: now },
      });
    }

    const plus = profile.entitlements[0] ?? null;
    const s = profile.settings;
    return {
      id: profile.id,
      email: profile.email ?? user.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      referralCode: profile.referralCode,
      createdAt: profile.createdAt,
      settings: s
        ? {
            currency: s.currency,
            timezone: s.timezone,
            locale: s.locale,
            reminderMinuteOfDay: s.reminderMinuteOfDay,
            notificationsEnabled: s.notificationsEnabled,
          }
        : null,
      plan: {
        tier: plus ? 'PLUS' : 'FREE',
        product: plus?.product ?? null,
        status: plus?.status ?? null,
        expiresAt: plus?.expiresAt ?? null,
        willRenew: plus?.willRenew ?? null,
      },
      limits: plus ? null : FREE_LIMITS,
    };
  }
}
