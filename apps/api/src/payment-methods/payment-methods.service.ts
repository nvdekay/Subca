import { Injectable, NotFoundException } from '@nestjs/common';
import {
  monthlyEquivalentMinor,
  todayInTimeZone,
  type CreatePaymentMethod,
  type CurrencyCode,
  type PaymentMethodDto,
  type UpdatePaymentMethod,
} from '@subca/shared';
import { FxService } from '../fx/fx.service.js';
import type { PaymentMethod } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TIMEZONE,
  TRACKED_STATUSES,
} from '../subscriptions/subscriptions.service.js';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  /** Danh sách kèm số subscription đang dùng và tổng chi phí tháng (quy đổi về tiền tệ chính). */
  async list(userId: string): Promise<PaymentMethodDto[]> {
    const [methods, subs, settings] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where: { userId, archivedAt: null },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.subscription.findMany({
        where: {
          userId,
          status: { in: TRACKED_STATUSES },
          paymentMethodId: { not: null },
        },
        select: {
          paymentMethodId: true,
          status: true,
          amountMinor: true,
          currency: true,
          intervalUnit: true,
          intervalCount: true,
        },
      }),
      this.prisma.userSettings.findUnique({
        where: { userId },
        select: { currency: true, timezone: true },
      }),
    ]);
    const currency = (settings?.currency ?? 'VND') as CurrencyCode;
    const rates = await this.fx.rateTable(
      currency,
      subs.map((s) => s.currency),
      todayInTimeZone(settings?.timezone ?? DEFAULT_TIMEZONE),
    );

    const stats = new Map<string, { count: number; total: bigint }>();
    for (const s of subs) {
      const entry = stats.get(s.paymentMethodId!) ?? { count: 0, total: 0n };
      entry.count++;
      if (s.status !== 'TRIAL') {
        const monthly = monthlyEquivalentMinor(
          s.amountMinor,
          s.intervalUnit,
          s.intervalCount,
        );
        entry.total += rates.convert(monthly, s.currency as CurrencyCode) ?? 0n;
      }
      stats.set(s.paymentMethodId!, entry);
    }
    return methods.map((m) => toDto(m, stats.get(m.id)));
  }

  async create(
    userId: string,
    input: CreatePaymentMethod,
  ): Promise<PaymentMethodDto> {
    const method = await this.prisma.$transaction(async (tx) => {
      // Phương thức đầu tiên tự động là mặc định
      const isFirst =
        (await tx.paymentMethod.count({
          where: { userId, archivedAt: null },
        })) === 0;
      const isDefault = input.isDefault || isFirst;
      if (isDefault)
        await tx.paymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      return tx.paymentMethod.create({
        data: {
          userId,
          type: input.type,
          brand: input.brand ?? null,
          label: input.label,
          last4: input.last4 ?? null,
          isDefault,
        },
      });
    });
    return toDto(method, undefined);
  }

  async update(
    userId: string,
    id: string,
    input: UpdatePaymentMethod,
  ): Promise<PaymentMethodDto> {
    await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.paymentMethod.updateMany({
          where: { userId, id: { not: id } },
          data: { isDefault: false },
        });
      }
      await tx.paymentMethod.update({
        where: { id },
        data: {
          ...(input.type !== undefined && { type: input.type }),
          ...(input.brand !== undefined && { brand: input.brand }),
          ...(input.label !== undefined && { label: input.label }),
          ...(input.last4 !== undefined && { last4: input.last4 }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        },
      });
    });
    return (await this.list(userId)).find((m) => m.id === id)!;
  }

  /** Lưu trữ phương thức và gỡ khỏi các subscription đang dùng nó. */
  async archive(userId: string, id: string): Promise<void> {
    const method = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId, paymentMethodId: id },
        data: { paymentMethodId: null },
      });
      await tx.paymentMethod.update({
        where: { id },
        data: { archivedAt: new Date(), isDefault: false },
      });
      // Nếu vừa lưu trữ phương thức mặc định → chọn phương thức còn lại cũ nhất làm mặc định
      if (method.isDefault) {
        const next = await tx.paymentMethod.findFirst({
          where: { userId, archivedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        if (next)
          await tx.paymentMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
      }
    });
  }

  private async findOwned(userId: string, id: string): Promise<PaymentMethod> {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id, userId, archivedAt: null },
    });
    if (!method) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'PAYMENT_METHOD_NOT_FOUND',
        message: 'Không tìm thấy phương thức thanh toán',
      });
    }
    return method;
  }
}

function toDto(
  m: PaymentMethod,
  stat: { count: number; total: bigint } | undefined,
): PaymentMethodDto {
  return {
    id: m.id,
    type: m.type,
    brand: m.brand,
    label: m.label,
    last4: m.last4,
    isDefault: m.isDefault,
    subscriptionCount: stat?.count ?? 0,
    monthlyTotalMinor: (stat?.total ?? 0n).toString(),
  };
}
