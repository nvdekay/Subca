import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface CacheEntry {
  banned: boolean;
  expiresAt: number;
}

/**
 * Kiểm tra tài khoản có bị khóa không, cache trong bộ nhớ để không truy vấn DB mỗi request.
 * Sau khi admin khóa/mở khóa, gọi `invalidate(userId)` để có hiệu lực ngay trên instance này;
 * các instance khác nhận thay đổi sau tối đa TTL.
 */
@Injectable()
export class AccountStatusService {
  static readonly TTL_MS = 60_000;
  private static readonly MAX_ENTRIES = 50_000;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async isBanned(userId: string, now = Date.now()): Promise<boolean> {
    const hit = this.cache.get(userId);
    if (hit && hit.expiresAt > now) return hit.banned;

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { bannedAt: true },
    });
    const banned = Boolean(profile?.bannedAt);
    if (this.cache.size >= AccountStatusService.MAX_ENTRIES) this.cache.clear();
    this.cache.set(userId, {
      banned,
      expiresAt: now + AccountStatusService.TTL_MS,
    });
    return banned;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }
}
