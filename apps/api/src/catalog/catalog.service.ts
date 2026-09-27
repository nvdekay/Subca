import { Injectable } from '@nestjs/common';
import type { CatalogServiceDto, CurrencyCode } from '@subca/shared';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CatalogQuery {
  q?: string | undefined;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Thư viện dịch vụ đang hoạt động, kèm các gói giá tại Việt Nam. */
  async services(query: CatalogQuery): Promise<CatalogServiceDto[]> {
    const rows = await this.prisma.service.findMany({
      where: {
        isActive: true,
        ...(query.q
          ? { name: { contains: query.q, mode: 'insensitive' } }
          : {}),
      },
      include: {
        plans: {
          where: { isActive: true, region: 'VN' },
          orderBy: { amountMinor: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      logoKey: s.logoKey,
      brandColor: s.brandColor,
      website: s.website,
      cancelUrl: s.cancelUrl,
      plans: s.plans.map((p) => ({
        id: p.id,
        name: p.name,
        amountMinor: p.amountMinor.toString(),
        currency: p.currency as CurrencyCode,
        intervalUnit: p.intervalUnit,
        intervalCount: p.intervalCount,
        isFamily: p.isFamily,
        maxMembers: p.maxMembers,
      })),
    }));
  }
}
