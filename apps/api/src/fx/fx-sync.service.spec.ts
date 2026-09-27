import type { PrismaService } from '../prisma/prisma.service.js';
import {
  crossRates,
  FxSyncRunner,
  validateUsdRates,
  type UsdRates,
} from './fx-sync.service.js';

const ER_API_OK = {
  result: 'success',
  time_last_update_utc: 'Sun, 27 Sep 2026 00:02:31 +0000',
  rates: { USD: 1, VND: 26000, EUR: 0.8, JPY: 156, GBP: 0.75 },
};
const FAWAZ_OK = {
  date: '2026-09-26',
  usd: { usd: 1, vnd: 25900, eur: 0.81, jpy: 155 },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** fetch giả: trả phản hồi theo URL. */
function fakeFetch(routes: {
  erApi?: Response | Error;
  fawaz?: Response | Error;
}): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const r = url.includes('open.er-api.com')
      ? routes.erApi
      : url.includes('fawazahmed0')
        ? routes.fawaz
        : undefined;
    if (!r) throw new Error(`URL không mong đợi: ${url}`);
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
}

function fakePrisma(latestDate: string | null = null) {
  const upserts: {
    create: {
      base: string;
      quote: string;
      rate: string;
      source: string;
      date: Date;
    };
  }[] = [];
  const prisma = {
    exchangeRate: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          latestDate ? { date: new Date(`${latestDate}T00:00:00Z`) } : null,
        ),
      upsert: vi.fn((args: (typeof upserts)[number]) => {
        upserts.push(args);
        return Promise.resolve(args);
      }),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { prisma: prisma as unknown as PrismaService, upserts, raw: prisma };
}

const rateOf = (
  upserts: ReturnType<typeof fakePrisma>['upserts'],
  base: string,
  quote: string,
) =>
  Number(
    upserts.find((u) => u.create.base === base && u.create.quote === quote)
      ?.create.rate,
  );

describe('crossRates', () => {
  it('tính mọi cặp qua USD, chiều ngược là nghịch đảo', () => {
    const pairs = crossRates({ USD: 1, VND: 26000, EUR: 0.8, JPY: 156 });
    expect(pairs).toHaveLength(12);
    const get = (b: string, q: string) =>
      pairs.find((p) => p.base === b && p.quote === q)!.rate;
    expect(get('USD', 'VND')).toBe(26000);
    expect(get('VND', 'USD')).toBeCloseTo(1 / 26000, 12);
    expect(get('EUR', 'VND')).toBeCloseTo(32500, 6);
    expect(get('JPY', 'VND')).toBeCloseTo(166.6667, 3);
  });
});

describe('validateUsdRates', () => {
  const base: UsdRates = {
    date: '2026-09-27',
    source: 't',
    rates: { USD: 1, VND: 26000, EUR: 0.8, JPY: 156 },
  };
  it('chấp nhận dữ liệu hợp lý', () => {
    expect(() => validateUsdRates(base)).not.toThrow();
  });
  it('chặn giá trị hỏng hoặc thiếu', () => {
    expect(() =>
      validateUsdRates({ ...base, rates: { ...base.rates, VND: 0 } }),
    ).toThrow(/VND/);
    expect(() =>
      validateUsdRates({ ...base, rates: { ...base.rates, VND: 26 } }),
    ).toThrow(/VND/);
    expect(() =>
      validateUsdRates({ ...base, rates: { ...base.rates, JPY: Number.NaN } }),
    ).toThrow(/JPY/);
  });
});

describe('FxSyncRunner', () => {
  it('lấy từ nguồn chính, lưu 12 cặp với ngày của nhà cung cấp', async () => {
    const { prisma, upserts } = fakePrisma();
    const result = await new FxSyncRunner(
      prisma,
      undefined,
      fakeFetch({ erApi: json(ER_API_OK) }),
    ).run('2026-09-27');
    expect(result).toEqual({
      status: 'synced',
      date: '2026-09-27',
      source: 'exchangerate-api.com',
      pairs: 12,
    });
    expect(upserts).toHaveLength(12);
    expect(rateOf(upserts, 'USD', 'VND')).toBe(26000);
    expect(rateOf(upserts, 'VND', 'USD')).toBeCloseTo(0.00003846, 8);
    expect(upserts[0]!.create.date.toISOString()).toBe(
      '2026-09-27T00:00:00.000Z',
    );
  });

  it('nguồn chính lỗi HTTP → dùng nguồn dự phòng', async () => {
    const { prisma, upserts } = fakePrisma();
    const result = await new FxSyncRunner(
      prisma,
      undefined,
      fakeFetch({ erApi: json({}, 503), fawaz: json(FAWAZ_OK) }),
    ).run('2026-09-27');
    expect(result).toMatchObject({
      status: 'synced',
      source: 'fawazahmed0/currency-api',
      date: '2026-09-26',
    });
    expect(rateOf(upserts, 'USD', 'VND')).toBe(25900);
  });

  it('nguồn chính trả số bất thường → không lưu, dùng nguồn dự phòng', async () => {
    const { prisma, upserts } = fakePrisma();
    const broken = { ...ER_API_OK, rates: { ...ER_API_OK.rates, VND: 0 } };
    await new FxSyncRunner(
      prisma,
      undefined,
      fakeFetch({ erApi: json(broken), fawaz: json(FAWAZ_OK) }),
    ).run('2026-09-27');
    expect(new Set(upserts.map((u) => u.create.source))).toEqual(
      new Set(['fawazahmed0/currency-api']),
    );
  });

  it('cả hai nguồn lỗi → báo lỗi, không ghi gì', async () => {
    const { prisma, upserts } = fakePrisma();
    await expect(
      new FxSyncRunner(
        prisma,
        undefined,
        fakeFetch({ erApi: new Error('mất mạng'), fawaz: json({}, 500) }),
      ).run('2026-09-27'),
    ).rejects.toThrow(/exchangerate-api\.com: mất mạng[\s\S]*fawazahmed0/);
    expect(upserts).toHaveLength(0);
  });

  it('đã có tỷ giá hôm nay → bỏ qua, không gọi mạng; force → vẫn cập nhật', async () => {
    const { prisma, raw } = fakePrisma('2026-09-27');
    const fetchFn = fakeFetch({ erApi: json(ER_API_OK) });
    expect(
      await new FxSyncRunner(prisma, undefined, fetchFn).run('2026-09-27'),
    ).toEqual({ status: 'skipped', date: '2026-09-27' });
    expect(fetchFn).not.toHaveBeenCalled();
    await new FxSyncRunner(prisma, undefined, fetchFn).run('2026-09-27', true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(raw.exchangeRate.upsert).toHaveBeenCalledTimes(12);
  });
});
