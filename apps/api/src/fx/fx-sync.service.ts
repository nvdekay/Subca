import {
  CURRENCY_DECIMALS,
  type CurrencyCode,
  type IsoDate,
} from '@subca/shared';
import { fromDbDate, toDbDate } from '../common/db-date.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Tiền tệ Subca hỗ trợ; lưu tỷ giá cho mọi cặp giữa các tiền tệ này. */
export const SUPPORTED_CURRENCIES = Object.keys(
  CURRENCY_DECIMALS,
) as CurrencyCode[];

export interface UsdRates {
  /** Ngày dữ liệu tỷ giá (theo UTC của nhà cung cấp). */
  date: IsoDate;
  /** Số đơn vị tiền tệ cho 1 USD. */
  rates: Record<CurrencyCode, number>;
  source: string;
}

export interface FxProvider {
  name: string;
  fetchUsdRates(fetchFn: typeof fetch): Promise<UsdRates>;
}

type Json = Record<string, unknown>;

async function getJson(fetchFn: typeof fetch, url: string): Promise<Json> {
  const res = await fetchFn(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${url} trả về HTTP ${res.status}`);
  return (await res.json()) as Json;
}

function pickRates(
  source: Record<string, unknown>,
  key: (c: CurrencyCode) => string,
): Record<CurrencyCode, number> {
  const out = {} as Record<CurrencyCode, number>;
  for (const c of SUPPORTED_CURRENCIES)
    out[c] = c === 'USD' ? 1 : Number(source[key(c)]);
  return out;
}

/**
 * ExchangeRate-API, gói Open Access (không cần key). Điều khoản: được dùng thương mại để quy đổi,
 * PHẢI ghi nguồn nơi hiển thị số đã quy đổi, không phân phối lại dữ liệu, nên gọi tối đa 1 lần/ngày.
 * https://www.exchangerate-api.com/docs/free
 */
export const exchangeRateApi: FxProvider = {
  name: 'exchangerate-api.com',
  async fetchUsdRates(fetchFn) {
    const body = await getJson(
      fetchFn,
      'https://open.er-api.com/v6/latest/USD',
    );
    if (
      body['result'] !== 'success' ||
      typeof body['rates'] !== 'object' ||
      body['rates'] === null
    ) {
      throw new Error('exchangerate-api.com: phản hồi không hợp lệ');
    }
    const updated = new Date(String(body['time_last_update_utc']));
    if (Number.isNaN(updated.getTime()))
      throw new Error('exchangerate-api.com: thiếu ngày cập nhật');
    return {
      date: updated.toISOString().slice(0, 10),
      rates: pickRates(body['rates'] as Json, (c) => c),
      source: this.name,
    };
  },
};

/** Nguồn dự phòng: fawazahmed0/currency-api qua jsDelivr (miễn phí, không giới hạn). */
export const fawazCurrencyApi: FxProvider = {
  name: 'fawazahmed0/currency-api',
  async fetchUsdRates(fetchFn) {
    const body = await getJson(
      fetchFn,
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
    );
    const date = String(body['date'] ?? '');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof body['usd'] !== 'object' ||
      body['usd'] === null
    ) {
      throw new Error('fawazahmed0/currency-api: phản hồi không hợp lệ');
    }
    return {
      date,
      rates: pickRates(body['usd'] as Json, (c) => c.toLowerCase()),
      source: this.name,
    };
  },
};

/** Khoảng hợp lý của tỷ giá so với USD, để chặn dữ liệu hỏng (VD VND = 0 hoặc lệch hàng nghìn lần). */
const SANITY: Record<CurrencyCode, [number, number]> = {
  USD: [1, 1],
  VND: [10_000, 100_000],
  EUR: [0.3, 3],
  JPY: [50, 500],
};

export function validateUsdRates(data: UsdRates): void {
  for (const c of SUPPORTED_CURRENCIES) {
    const rate = data.rates[c];
    const [min, max] = SANITY[c];
    if (!Number.isFinite(rate) || rate < min || rate > max) {
      throw new Error(
        `${data.source}: tỷ giá ${c} = ${rate} nằm ngoài khoảng hợp lý [${min}, ${max}]`,
      );
    }
  }
}

/** Mọi cặp (base → quote) giữa các tiền tệ hỗ trợ, tính chéo qua USD. */
export function crossRates(
  usd: Record<CurrencyCode, number>,
): { base: CurrencyCode; quote: CurrencyCode; rate: number }[] {
  const pairs: { base: CurrencyCode; quote: CurrencyCode; rate: number }[] = [];
  for (const base of SUPPORTED_CURRENCIES) {
    for (const quote of SUPPORTED_CURRENCIES) {
      if (base !== quote)
        pairs.push({ base, quote, rate: usd[quote] / usd[base] });
    }
  }
  return pairs;
}

export interface FxSyncResult {
  status: 'synced' | 'skipped';
  date: IsoDate;
  source?: string;
  pairs?: number;
}

/**
 * Lấy tỷ giá mới nhất và lưu vào bảng exchange_rates. Không phụ thuộc Nest để chạy được
 * cả trong job hằng ngày lẫn script `pnpm --filter @subca/api fx:sync`.
 */
export class FxSyncRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: FxProvider[] = [
      exchangeRateApi,
      fawazCurrencyApi,
    ],
    private readonly fetchFn: typeof fetch = fetch,
    private readonly log: (message: string) => void = () => undefined,
  ) {}

  /** Ngày của tỷ giá mới nhất đang có, hoặc null nếu bảng trống. */
  async latestDate(): Promise<IsoDate | null> {
    const row = await this.prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return row ? fromDbDate(row.date) : null;
  }

  /**
   * @param todayUtc ngày hiện tại theo UTC; nếu đã có tỷ giá của ngày này thì bỏ qua (trừ khi `force`).
   */
  async run(todayUtc: IsoDate, force = false): Promise<FxSyncResult> {
    if (!force && (await this.latestDate()) === todayUtc)
      return { status: 'skipped', date: todayUtc };

    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        const data = await provider.fetchUsdRates(this.fetchFn);
        validateUsdRates(data);
        const pairs = crossRates(data.rates);
        const date = toDbDate(data.date);
        await this.prisma.$transaction(
          pairs.map((p) =>
            this.prisma.exchangeRate.upsert({
              where: {
                base_quote_date: { base: p.base, quote: p.quote, date },
              },
              create: {
                base: p.base,
                quote: p.quote,
                date,
                rate: p.rate.toFixed(8),
                source: data.source,
              },
              update: { rate: p.rate.toFixed(8), source: data.source },
            }),
          ),
        );
        this.log(
          `Đã lưu ${pairs.length} cặp tỷ giá ngày ${data.date} từ ${data.source} (1 USD = ${data.rates.VND} VND)`,
        );
        return {
          status: 'synced',
          date: data.date,
          source: data.source,
          pairs: pairs.length,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${provider.name}: ${message}`);
        this.log(`Nguồn ${provider.name} lỗi, thử nguồn tiếp theo: ${message}`);
      }
    }
    throw new Error(
      `Không lấy được tỷ giá từ nguồn nào:\n${errors.join('\n')}`,
    );
  }
}
