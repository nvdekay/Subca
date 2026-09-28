import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  type AdminServiceDto,
  type AdminServicesQuery,
  type AuditLogDto,
  type AuditLogsDto,
  type AuditLogsQuery,
  type CreateService,
  type CurrencyCode,
  type PriceReportDto,
  type PriceReportsDto,
  type PriceReportsQuery,
  type ReviewPriceReport,
  type UpdateService,
  type UpsertServicePlan,
} from '@subca/shared';
import type { AdminUser, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TRACKED_STATUSES } from '../subscriptions/subscriptions.service.js';
import { AuditService } from './audit.service.js';

/** Thư viện dịch vụ, đề xuất giá của người dùng và nhật ký thao tác. */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async services(query: AdminServicesQuery): Promise<AdminServiceDto[]> {
    const rows = await this.prisma.service.findMany({
      where: {
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.q
          ? { name: { contains: query.q, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        plans: { orderBy: [{ isActive: 'desc' }, { amountMinor: 'asc' }] },
        _count: {
          select: {
            subscriptions: { where: { status: { in: TRACKED_STATUSES } } },
            priceReports: { where: { status: 'PENDING' } },
          },
        },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      logoKey: s.logoKey,
      brandColor: s.brandColor,
      website: s.website,
      cancelUrl: s.cancelUrl,
      cancelSteps: cancelSteps(s.cancelSteps),
      isActive: s.isActive,
      subscriptionCount: s._count.subscriptions,
      pendingReports: s._count.priceReports,
      plans: s.plans.map((p) => ({
        id: p.id,
        name: p.name,
        amountMinor: p.amountMinor.toString(),
        currency: p.currency as CurrencyCode,
        intervalUnit: p.intervalUnit,
        intervalCount: p.intervalCount,
        isFamily: p.isFamily,
        maxMembers: p.maxMembers,
        isActive: p.isActive,
      })),
    }));
  }

  async createService(
    admin: AdminUser,
    input: CreateService,
    ip: string | null,
  ): Promise<AdminServiceDto> {
    const taken = await this.prisma.service.count({
      where: { slug: input.slug },
    });
    if (taken) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'SLUG_TAKEN',
        message: `Slug "${input.slug}" đã có dịch vụ khác dùng`,
        issues: [{ path: 'slug', message: 'Slug đã tồn tại' }],
      });
    }
    const created = await this.prisma.service.create({
      data: {
        slug: input.slug,
        name: input.name,
        logoKey: input.logoKey ?? null,
        brandColor: input.brandColor ?? null,
        website: input.website ?? null,
        cancelUrl: input.cancelUrl ?? null,
        cancelSteps: input.cancelSteps ?? [],
        isActive: input.isActive,
      },
    });
    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.serviceCreate,
      targetType: 'service',
      targetId: created.id,
      metadata: { slug: created.slug, name: created.name },
      ip,
    });
    return this.one(created.id);
  }

  async updateService(
    admin: AdminUser,
    id: string,
    input: UpdateService,
    ip: string | null,
  ): Promise<AdminServiceDto> {
    await this.assertService(id);
    await this.prisma.service.update({
      where: { id },
      data: {
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.logoKey !== undefined && { logoKey: input.logoKey }),
        ...(input.brandColor !== undefined && { brandColor: input.brandColor }),
        ...(input.website !== undefined && { website: input.website }),
        ...(input.cancelUrl !== undefined && { cancelUrl: input.cancelUrl }),
        ...(input.cancelSteps !== undefined && {
          cancelSteps: input.cancelSteps,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.serviceUpdate,
      targetType: 'service',
      targetId: id,
      metadata: input as Prisma.InputJsonValue,
      ip,
    });
    return this.one(id);
  }

  /** Thêm gói giá mới, hoặc sửa gói đang có (trùng tên + khu vực VN). */
  async upsertPlan(
    admin: AdminUser,
    serviceId: string,
    input: UpsertServicePlan,
    ip: string | null,
    planId?: string,
  ): Promise<AdminServiceDto> {
    await this.assertService(serviceId);
    const data = {
      serviceId,
      name: input.name,
      amountMinor: BigInt(input.amountMinor),
      currency: input.currency,
      intervalUnit: input.intervalUnit,
      intervalCount: input.intervalCount,
      isFamily: input.isFamily,
      maxMembers: input.maxMembers ?? null,
      isActive: input.isActive,
    };
    if (planId) {
      const owned = await this.prisma.servicePlan.count({
        where: { id: planId, serviceId },
      });
      if (!owned) throw planNotFound();
      await this.prisma.servicePlan.update({ where: { id: planId }, data });
    } else {
      await this.prisma.servicePlan.upsert({
        where: {
          serviceId_name_region: { serviceId, name: input.name, region: 'VN' },
        },
        create: data,
        update: data,
      });
    }
    await this.audit.log(admin, {
      action: AUDIT_ACTIONS.servicePlanUpsert,
      targetType: 'service',
      targetId: serviceId,
      metadata: {
        plan: input.name,
        amountMinor: input.amountMinor,
        currency: input.currency,
      },
      ip,
    });
    return this.one(serviceId);
  }

  // ─────────────── Đề xuất giá ───────────────

  async priceReports(query: PriceReportsQuery): Promise<PriceReportsDto> {
    const where: Prisma.PriceReportWhereInput = { status: query.status };
    const [total, rows] = await Promise.all([
      this.prisma.priceReport.count({ where }),
      this.prisma.priceReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          service: { select: { id: true, name: true, slug: true } },
          servicePlan: {
            select: { id: true, name: true, amountMinor: true, currency: true },
          },
          user: { select: { email: true } },
        },
      }),
    ]);
    return {
      items: rows.map(toPriceReportDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Duyệt = cập nhật giá gói theo đề xuất (nếu đề xuất gắn với một gói cụ thể). */
  async reviewPriceReport(
    admin: AdminUser,
    id: string,
    input: ReviewPriceReport,
    ip: string | null,
  ): Promise<PriceReportDto> {
    const report = await this.prisma.priceReport.findUnique({ where: { id } });
    if (!report || report.status !== 'PENDING') {
      throw new NotFoundException({
        statusCode: 404,
        code: 'PRICE_REPORT_NOT_FOUND',
        message: 'Không tìm thấy đề xuất giá đang chờ duyệt',
      });
    }
    const approve = input.decision === 'APPROVE';
    await this.prisma.$transaction(async (tx) => {
      if (approve && report.servicePlanId) {
        await tx.servicePlan.update({
          where: { id: report.servicePlanId },
          data: {
            amountMinor: report.reportedAmountMinor,
            currency: report.currency,
          },
        });
      }
      await tx.priceReport.update({
        where: { id },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
    });
    await this.audit.log(admin, {
      action: approve
        ? AUDIT_ACTIONS.priceReportApprove
        : AUDIT_ACTIONS.priceReportReject,
      targetType: 'price_report',
      targetId: id,
      metadata: {
        serviceId: report.serviceId,
        amountMinor: report.reportedAmountMinor.toString(),
        currency: report.currency,
      },
      ip,
    });
    const updated = await this.prisma.priceReport.findUniqueOrThrow({
      where: { id },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        servicePlan: {
          select: { id: true, name: true, amountMinor: true, currency: true },
        },
        user: { select: { email: true } },
      },
    });
    return toPriceReportDto(updated);
  }

  // ─────────────── Nhật ký ───────────────

  async auditLogs(query: AuditLogsQuery): Promise<AuditLogsDto> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    const items: AuditLogDto[] = rows.map((row) => ({
      id: row.id,
      actorType: row.actorType,
      actor: row.actor,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: (row.metadata ?? null) as Record<string, unknown> | null,
      ip: row.ip,
      severity: row.severity,
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  // ─────────────────────────────────────────────

  private async one(id: string): Promise<AdminServiceDto> {
    const [service] = await this.services({
      q: undefined,
      includeInactive: true,
    }).then((all) => all.filter((s) => s.id === id));
    if (!service) throw serviceNotFound();
    return service;
  }

  private async assertService(id: string): Promise<void> {
    const found = await this.prisma.service.count({ where: { id } });
    if (!found) throw serviceNotFound();
  }
}

function toPriceReportDto(row: {
  id: string;
  service: { id: string; name: string; slug: string };
  servicePlan: {
    id: string;
    name: string;
    amountMinor: bigint;
    currency: string;
  } | null;
  reportedAmountMinor: bigint;
  currency: string;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: { email: string | null } | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): PriceReportDto {
  return {
    id: row.id,
    service: row.service,
    plan: row.servicePlan
      ? {
          id: row.servicePlan.id,
          name: row.servicePlan.name,
          amountMinor: row.servicePlan.amountMinor.toString(),
          currency: row.servicePlan.currency as CurrencyCode,
        }
      : null,
    reportedAmountMinor: row.reportedAmountMinor.toString(),
    currency: row.currency as CurrencyCode,
    note: row.note,
    status: row.status,
    reportedBy: row.user?.email ?? null,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

/** `cancel_steps` là JSON do admin nhập; chỉ nhận mảng chuỗi. */
function cancelSteps(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function serviceNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'SERVICE_NOT_FOUND',
    message: 'Không tìm thấy dịch vụ',
  });
}

function planNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'SERVICE_PLAN_NOT_FOUND',
    message: 'Không tìm thấy gói giá của dịch vụ này',
  });
}
