import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  daysBetween,
  monthlyEquivalentMinor,
  nextRenewalOnOrAfter,
  todayInTimeZone,
  type CreateSubscription,
  type CurrencyCode,
  type IsoDate,
  type ListSubscriptionsQuery,
  type SubscriptionDetailDto,
  type SubscriptionDto,
  type SubscriptionListDto,
  type UpdateSubscription,
} from '@subca/shared';
import { fromDbDate, toDbDate } from '../common/db-date.js';
import type {
  IntervalUnit,
  Prisma,
  SubscriptionStatus,
} from '../generated/prisma/client.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Trạng thái được tính vào giới hạn gói Free. */
export const TRACKED_STATUSES: SubscriptionStatus[] = [
  'ACTIVE',
  'TRIAL',
  'REVIEW',
];
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const subscriptionInclude = {
  service: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoKey: true,
      brandColor: true,
    },
  },
} satisfies Prisma.SubscriptionInclude;
/** Chỉ dùng cho màn Chi tiết (thêm dữ liệu so với danh sách). */
const detailInclude = {
  service: {
    select: {
      ...subscriptionInclude.service.select,
      website: true,
      cancelUrl: true,
      cancelSteps: true,
    },
  },
  paymentMethod: {
    select: { id: true, type: true, brand: true, label: true, last4: true },
  },
  category: { select: { id: true, name: true, icon: true, color: true } },
  renewalCharges: {
    select: { chargedOn: true, amountMinor: true, currency: true },
    orderBy: { chargedOn: 'desc' },
    take: 12,
  },
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionRow = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

interface Schedule {
  startDate: IsoDate;
  anchorDay: number;
  intervalUnit: IntervalUnit;
  intervalCount: number;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plan: PlanService,
  ) {}

  async list(
    userId: string,
    query: ListSubscriptionsQuery,
  ): Promise<SubscriptionListDto> {
    const [today, rows, trackedCount, limit] = await Promise.all([
      this.today(userId),
      this.prisma.subscription.findMany({
        where: {
          userId,
          status: query.status ?? { not: 'ARCHIVED' },
          ...(query.q
            ? {
                OR: [
                  { customName: { contains: query.q, mode: 'insensitive' } },
                  {
                    service: {
                      name: { contains: query.q, mode: 'insensitive' },
                    },
                  },
                ],
              }
            : {}),
        },
        include: subscriptionInclude,
        orderBy: [
          { nextRenewalDate: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
      }),
      this.countTracked(userId),
      this.plan.subscriptionLimit(userId),
    ]);
    return { items: rows.map((r) => toDto(r, today)), trackedCount, limit };
  }

  /** Chi tiết cho màn Chi tiết: kèm phương thức thanh toán, danh mục, hướng dẫn hủy, lịch sử trừ tiền. */
  async get(userId: string, id: string): Promise<SubscriptionDetailDto> {
    const [row, today] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { id, userId, status: { not: 'ARCHIVED' } },
        include: detailInclude,
      }),
      this.today(userId),
    ]);
    if (!row) throw subscriptionNotFound();
    const pm = row.paymentMethod;
    const svc = row.service;
    return {
      ...toDto(row, today),
      paymentMethod: pm
        ? {
            id: pm.id,
            type: pm.type,
            brand: pm.brand,
            label: pm.label,
            last4: pm.last4,
          }
        : null,
      category: row.category,
      cancelGuide: svc
        ? {
            url: svc.cancelUrl,
            website: svc.website,
            steps: cancelSteps(svc.cancelSteps),
          }
        : null,
      charges: row.renewalCharges.map((c) => ({
        chargedOn: fromDbDate(c.chargedOn),
        amountMinor: c.amountMinor.toString(),
        currency: c.currency as CurrencyCode,
      })),
    };
  }

  async create(
    userId: string,
    input: CreateSubscription,
  ): Promise<SubscriptionDto> {
    await this.assertWithinLimit(userId);
    await this.assertReferences(userId, input, input.serviceId ?? null);

    const today = await this.today(userId);
    const schedule = scheduleFrom(
      input.billingDate,
      input.intervalUnit,
      input.intervalCount,
    );
    const row = await this.prisma.subscription.create({
      data: {
        userId,
        serviceId: input.serviceId ?? null,
        servicePlanId: input.servicePlanId ?? null,
        customName: input.customName ?? null,
        planName: input.planName ?? null,
        amountMinor: BigInt(input.amountMinor),
        currency: input.currency,
        intervalUnit: schedule.intervalUnit,
        intervalCount: schedule.intervalCount,
        anchorDay: schedule.anchorDay,
        startDate: toDbDate(schedule.startDate),
        nextRenewalDate: toDbDate(nextRenewalOnOrAfter(schedule, today)),
        trialEndDate: input.isTrial ? toDbDate(input.billingDate) : null,
        status: input.isTrial ? 'TRIAL' : 'ACTIVE',
        autoRenew: input.autoRenew,
        paymentMethodId: input.paymentMethodId ?? null,
        categoryId: input.categoryId ?? null,
        usageFrequency: input.usageFrequency ?? null,
        reminderOffsets: input.reminderOffsets ?? [],
        notes: input.notes ?? null,
      },
      include: subscriptionInclude,
    });
    return toDto(row, today);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateSubscription,
  ): Promise<SubscriptionDto> {
    const existing = await this.findOwned(userId, id);

    // Trạng thái cuối cùng: ưu tiên giá trị gửi lên, sau đó suy ra từ isTrial
    let status: SubscriptionStatus = input.status ?? existing.status;
    if (!input.status && input.isTrial === true) status = 'TRIAL';
    if (!input.status && input.isTrial === false && existing.status === 'TRIAL')
      status = 'ACTIVE';

    const becomesTracked =
      TRACKED_STATUSES.includes(status) &&
      !TRACKED_STATUSES.includes(existing.status);
    if (becomesTracked) await this.assertWithinLimit(userId);

    const serviceId =
      input.serviceId !== undefined ? input.serviceId : existing.serviceId;
    const customName =
      input.customName !== undefined ? input.customName : existing.customName;
    if (!serviceId && !customName) {
      throw badRequest(
        'VALIDATION_ERROR',
        'Chọn một dịch vụ hoặc nhập tên subscription',
      );
    }
    await this.assertReferences(
      userId,
      {
        serviceId: input.serviceId,
        // Đổi dịch vụ mà không gửi gói → kiểm tra lại gói hiện tại với dịch vụ mới
        servicePlanId:
          input.servicePlanId !== undefined
            ? input.servicePlanId
            : input.serviceId !== undefined
              ? existing.servicePlanId
              : undefined,
        paymentMethodId: input.paymentMethodId,
        categoryId: input.categoryId,
      },
      serviceId,
    );

    const today = await this.today(userId);
    const data: Prisma.SubscriptionUncheckedUpdateInput = {
      ...(input.serviceId !== undefined && { serviceId: input.serviceId }),
      ...(input.servicePlanId !== undefined && {
        servicePlanId: input.servicePlanId,
      }),
      ...(input.customName !== undefined && { customName: input.customName }),
      ...(input.planName !== undefined && { planName: input.planName }),
      ...(input.amountMinor !== undefined && {
        amountMinor: BigInt(input.amountMinor),
      }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.autoRenew !== undefined && { autoRenew: input.autoRenew }),
      ...(input.paymentMethodId !== undefined && {
        paymentMethodId: input.paymentMethodId,
      }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.usageFrequency !== undefined && {
        usageFrequency: input.usageFrequency,
      }),
      ...(input.reminderOffsets !== undefined && {
        reminderOffsets: input.reminderOffsets,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      status,
    };

    if (status === 'CANCELLED') {
      data.nextRenewalDate = null;
      data.cancelledAt = existing.cancelledAt ?? new Date();
    } else {
      // Tính lại lịch khi đổi ngày, chu kỳ, trial, hoặc khi mở lại gói đã hủy
      const schedule: Schedule = input.billingDate
        ? scheduleFrom(
            input.billingDate,
            input.intervalUnit ?? existing.intervalUnit,
            input.intervalCount ?? existing.intervalCount,
          )
        : {
            startDate: fromDbDate(existing.startDate),
            anchorDay:
              existing.anchorDay ??
              Number(fromDbDate(existing.startDate).slice(8)),
            intervalUnit: input.intervalUnit ?? existing.intervalUnit,
            intervalCount: input.intervalCount ?? existing.intervalCount,
          };
      data.startDate = toDbDate(schedule.startDate);
      data.anchorDay = schedule.anchorDay;
      data.intervalUnit = schedule.intervalUnit;
      data.intervalCount = schedule.intervalCount;
      data.nextRenewalDate = toDbDate(nextRenewalOnOrAfter(schedule, today));
      data.cancelledAt = null;
      if (status === 'TRIAL') {
        data.trialEndDate = input.billingDate
          ? toDbDate(input.billingDate)
          : (existing.trialEndDate ?? existing.startDate);
      } else if (input.isTrial === false || existing.status === 'TRIAL') {
        data.trialEndDate = null;
      }
    }

    const row = await this.prisma.subscription.update({
      where: { id: existing.id },
      data,
      include: subscriptionInclude,
    });
    return toDto(row, today);
  }

  /** "Xóa" = lưu trữ: ẩn khỏi danh sách, không tính vào tổng và giới hạn, không nhắc nữa. */
  async archive(userId: string, id: string): Promise<void> {
    const existing = await this.findOwned(userId, id);
    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        nextRenewalDate: null,
      },
    });
  }

  // ─────────────────────────────────────────────

  private async findOwned(
    userId: string,
    id: string,
  ): Promise<SubscriptionRow> {
    const row = await this.prisma.subscription.findFirst({
      where: { id, userId, status: { not: 'ARCHIVED' } },
      include: subscriptionInclude,
    });
    // Không phân biệt "không tồn tại" và "của người khác" để không lộ thông tin
    if (!row) throw subscriptionNotFound();
    return row;
  }

  private countTracked(userId: string): Promise<number> {
    return this.prisma.subscription.count({
      where: { userId, status: { in: TRACKED_STATUSES } },
    });
  }

  private async assertWithinLimit(userId: string): Promise<void> {
    const limit = await this.plan.subscriptionLimit(userId);
    if (limit === null) return;
    if ((await this.countTracked(userId)) >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAN_LIMIT_REACHED',
        message: `Gói Free theo dõi tối đa ${limit} subscription. Nâng cấp Subca Plus để thêm không giới hạn.`,
        limit,
      });
    }
  }

  /** Kiểm tra các ID tham chiếu tồn tại và thuộc về người dùng. Trường `undefined` = không đổi, bỏ qua. */
  private async assertReferences(
    userId: string,
    refs: {
      serviceId?: string | null | undefined;
      servicePlanId?: string | null | undefined;
      paymentMethodId?: string | null | undefined;
      categoryId?: string | null | undefined;
    },
    finalServiceId: string | null,
  ): Promise<void> {
    const checks: Promise<void>[] = [];
    if (refs.serviceId) {
      checks.push(
        this.prisma.service
          .count({ where: { id: refs.serviceId, isActive: true } })
          .then((n) => void (n || fail('serviceId', 'Dịch vụ không tồn tại'))),
      );
    }
    if (refs.servicePlanId) {
      checks.push(
        this.prisma.servicePlan
          .findUnique({
            where: { id: refs.servicePlanId },
            select: { serviceId: true },
          })
          .then(
            (p) =>
              void (
                p?.serviceId === finalServiceId ||
                fail('servicePlanId', 'Gói không thuộc dịch vụ đã chọn')
              ),
          ),
      );
    }
    if (refs.paymentMethodId) {
      checks.push(
        this.prisma.paymentMethod
          .count({
            where: { id: refs.paymentMethodId, userId, archivedAt: null },
          })
          .then(
            (n) =>
              void (
                n ||
                fail('paymentMethodId', 'Phương thức thanh toán không tồn tại')
              ),
          ),
      );
    }
    if (refs.categoryId) {
      checks.push(
        this.prisma.category
          .count({
            where: { id: refs.categoryId, OR: [{ userId: null }, { userId }] },
          })
          .then(
            (n) => void (n || fail('categoryId', 'Danh mục không tồn tại')),
          ),
      );
    }
    await Promise.all(checks);
  }

  private async today(userId: string): Promise<IsoDate> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return todayInTimeZone(settings?.timezone ?? DEFAULT_TIMEZONE);
  }
}

function scheduleFrom(
  billingDate: IsoDate,
  intervalUnit: IntervalUnit,
  intervalCount: number,
): Schedule {
  return {
    startDate: billingDate,
    anchorDay: Number(billingDate.slice(8, 10)),
    intervalUnit,
    intervalCount,
  };
}

function subscriptionNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'SUBSCRIPTION_NOT_FOUND',
    message: 'Không tìm thấy subscription',
  });
}

/** `cancel_steps` là JSON do admin nhập; chỉ nhận mảng chuỗi, còn lại coi như không có. */
function cancelSteps(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function badRequest(
  code: string,
  message: string,
  field?: string,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code,
    message,
    ...(field ? { issues: [{ path: field, message }] } : {}),
  });
}

function fail(field: string, message: string): never {
  throw badRequest('INVALID_REFERENCE', message, field);
}

export function toDto(row: SubscriptionRow, today: IsoDate): SubscriptionDto {
  const next = row.nextRenewalDate ? fromDbDate(row.nextRenewalDate) : null;
  return {
    id: row.id,
    name: row.customName ?? row.service?.name ?? 'Subscription',
    service: row.service,
    servicePlanId: row.servicePlanId,
    planName: row.planName,
    amountMinor: row.amountMinor.toString(),
    currency: row.currency as CurrencyCode,
    intervalUnit: row.intervalUnit,
    intervalCount: row.intervalCount,
    monthlyEquivalentMinor: monthlyEquivalentMinor(
      row.amountMinor,
      row.intervalUnit,
      row.intervalCount,
    ).toString(),
    startDate: fromDbDate(row.startDate),
    nextRenewalDate: next,
    daysUntilRenewal: next ? daysBetween(today, next) : null,
    trialEndDate: row.trialEndDate ? fromDbDate(row.trialEndDate) : null,
    status: row.status,
    autoRenew: row.autoRenew,
    paymentMethodId: row.paymentMethodId,
    categoryId: row.categoryId,
    usageFrequency: row.usageFrequency,
    reminderOffsets: row.reminderOffsets,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
