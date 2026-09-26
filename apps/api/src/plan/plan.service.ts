import { Injectable } from '@nestjs/common';
import { FREE_LIMITS } from '@subca/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Điều kiện một quyền Plus còn hiệu lực tại thời điểm `now`. */
export function activeEntitlementWhere(
  now: Date,
): Prisma.EntitlementWhereInput {
  return {
    status: { not: 'EXPIRED' },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async isPlus(userId: string, now = new Date()): Promise<boolean> {
    const count = await this.prisma.entitlement.count({
      where: { userId, ...activeEntitlementWhere(now) },
    });
    return count > 0;
  }

  /** Giới hạn số subscription đang theo dõi; null = không giới hạn. */
  async subscriptionLimit(
    userId: string,
    now = new Date(),
  ): Promise<number | null> {
    return (await this.isPlus(userId, now))
      ? null
      : FREE_LIMITS.maxSubscriptions;
  }
}
