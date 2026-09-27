import { Injectable } from '@nestjs/common';
import { convertMinor, type CurrencyCode, type IsoDate } from '@subca/shared';
import { toDbDate } from '../common/db-date.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Bảng tỷ giá để quy đổi về một tiền tệ đích: `rates.get('USD')` = số VND cho 1 USD. */
export class RateTable {
  constructor(
    readonly target: CurrencyCode,
    private readonly rates: Map<string, number>,
  ) {}

  /** Quy đổi; trả về null nếu thiếu tỷ giá (không đoán). */
  convert(amountMinor: bigint, from: CurrencyCode): bigint | null {
    if (from === this.target) return amountMinor;
    const rate = this.rates.get(from);
    return rate === undefined
      ? null
      : convertMinor(amountMinor, from, this.target, rate);
  }
}

@Injectable()
export class FxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy tỷ giá mới nhất (tính đến ngày `onDate`) để đổi các `sources` sang `target`.
   * Chấp nhận cả chiều ngược lại trong bảng (VD có VND→USD thì dùng 1/rate).
   */
  async rateTable(
    target: CurrencyCode,
    sources: Iterable<string>,
    onDate: IsoDate,
  ): Promise<RateTable> {
    const needed = [...new Set(sources)].filter((c) => c !== target);
    const rates = new Map<string, number>();
    if (needed.length === 0) return new RateTable(target, rates);

    const rows = await this.prisma.exchangeRate.findMany({
      where: {
        date: { lte: toDbDate(onDate) },
        OR: [
          { base: { in: needed }, quote: target },
          { base: target, quote: { in: needed } },
        ],
      },
      orderBy: { date: 'desc' },
    });
    // Hàng đầu tiên cho mỗi tiền tệ là mới nhất; ưu tiên chiều thuận nếu cùng ngày
    const seen = new Map<string, { date: number; direct: boolean }>();
    for (const row of rows) {
      const direct = row.quote === target;
      const currency = direct ? row.base : row.quote;
      const rate = direct ? Number(row.rate) : 1 / Number(row.rate);
      const prev = seen.get(currency);
      const date = row.date.getTime();
      if (!prev || (prev.date === date && direct && !prev.direct)) {
        seen.set(currency, { date, direct });
        rates.set(currency, rate);
      }
    }
    return new RateTable(target, rates);
  }
}
