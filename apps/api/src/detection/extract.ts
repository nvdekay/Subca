import {
  CURRENCY_DECIMALS,
  type CurrencyCode,
  type IntervalUnit,
  type IsoDate,
} from '@subca/shared';

/**
 * Trích số tiền, ngày và chu kỳ từ nội dung email. Dùng chung cho parser của từng merchant
 * và parser tổng quát — chỗ nào cũng phải ra tiền dạng **đơn vị nhỏ nhất + mã tiền tệ**.
 */

const CURRENCY_SYMBOLS: Record<string, CurrencyCode> = {
  $: 'USD',
  us$: 'USD',
  usd: 'USD',
  '€': 'EUR',
  eur: 'EUR',
  '¥': 'JPY',
  jpy: 'JPY',
  '₫': 'VND',
  đ: 'VND',
  vnd: 'VND',
  vnđ: 'VND',
};

export interface ExtractedAmount {
  amountMinor: bigint;
  currency: CurrencyCode;
}

/**
 * Tìm số tiền đầu tiên trông giống giá: `$20.00`, `US$20`, `260.000₫`, `260,000 VND`, `19,99 €`.
 * VND viết theo kiểu Việt Nam (dấu chấm ngăn nghìn) nên phải tách theo tiền tệ, không đoán chung.
 */
export function extractAmount(text: string): ExtractedAmount | null {
  const patterns: RegExp[] = [
    // Ký hiệu đứng trước: $20.00 · US$20 · €19,99 · ₫260.000
    /(us\$|\$|€|¥|₫)\s?([\d.,]+)/gi,
    // Số đứng trước, đơn vị đứng sau: 260.000đ · 260,000 VND · 20 USD
    // (không dùng \b vì ₫ và đ nằm ngoài ASCII nên \b không nhận ra ranh giới)
    /([\d.,]+)\s?(vnđ|vnd|usd|eur|jpy|đ|₫)(?![\p{L}\d])/giu,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const symbolFirst = Boolean(CURRENCY_SYMBOLS[match[1]!.toLowerCase()]);
      const rawSymbol = (symbolFirst ? match[1]! : match[2]!).toLowerCase();
      const rawNumber = symbolFirst ? match[2]! : match[1]!;
      const currency = CURRENCY_SYMBOLS[rawSymbol];
      if (!currency) continue;
      const amountMinor = toMinorFromRaw(rawNumber, currency);
      if (amountMinor !== null && amountMinor > 0n)
        return { amountMinor, currency };
    }
  }
  return null;
}

/** "260.000" (VND) → 260000n · "19.99" (USD) → 1999n · "1,234.56" (USD) → 123456n. */
export function toMinorFromRaw(
  raw: string,
  currency: CurrencyCode,
): bigint | null {
  const decimals = CURRENCY_DECIMALS[currency];
  // Bỏ dấu câu dính hai đầu: "$9.00." trong câu văn vẫn phải đọc là 9.00
  const cleaned = raw
    .trim()
    .replace(/\s/g, '')
    .replace(/^[.,]+/, '')
    .replace(/[.,]+$/, '');
  if (!/^[\d.,]+$/.test(cleaned)) return null;

  let normalized: string;
  if (decimals === 0) {
    // VND/JPY không có phần lẻ: mọi dấu chấm/phẩy đều là ngăn nghìn
    normalized = cleaned.replace(/[.,]/g, '');
  } else {
    // Dấu cuối cùng là dấu thập phân nếu theo sau đúng 2 chữ số
    const lastSeparator = Math.max(
      cleaned.lastIndexOf('.'),
      cleaned.lastIndexOf(','),
    );
    const isDecimal =
      lastSeparator > -1 && cleaned.length - lastSeparator - 1 === decimals;
    const whole = (
      isDecimal ? cleaned.slice(0, lastSeparator) : cleaned
    ).replace(/[.,]/g, '');
    const fraction = isDecimal ? cleaned.slice(lastSeparator + 1) : '';
    normalized = whole + fraction.padEnd(decimals, '0');
  }
  if (!/^\d{1,15}$/.test(normalized)) return null;
  return BigInt(normalized);
}

const MONTHS_EN = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Tìm ngày trong text: `2026-10-18`, `18/10/2026`, `October 18, 2026`, `18 October 2026`,
 * `ngày 18 tháng 10 năm 2026`. Trả về chuỗi `YYYY-MM-DD` (không qua Date để khỏi lệch múi giờ).
 */
export function extractDate(text: string, near?: RegExp): IsoDate | null {
  const scope = near ? scopeAround(text, near) : text;
  if (!scope) return null;

  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(scope);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const vi = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i.exec(
    scope,
  );
  if (vi) return pad(vi[3] ?? String(new Date().getFullYear()), vi[2]!, vi[1]!);

  const dmy = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/.exec(scope);
  if (dmy) return pad(dmy[3]!, dmy[2]!, dmy[1]!);

  const monthFirst = new RegExp(
    `\\b(${MONTHS_EN.join('|')})\\w*\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i',
  ).exec(scope);
  if (monthFirst) {
    return pad(
      monthFirst[3]!,
      String(MONTHS_EN.indexOf(monthFirst[1]!.toLowerCase()) + 1),
      monthFirst[2]!,
    );
  }

  const dayFirst = new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTHS_EN.join('|')})\\w*\\s+(\\d{4})`,
    'i',
  ).exec(scope);
  if (dayFirst) {
    return pad(
      dayFirst[3]!,
      String(MONTHS_EN.indexOf(dayFirst[2]!.toLowerCase()) + 1),
      dayFirst[1]!,
    );
  }
  return null;
}

/** Lấy đoạn text quanh chỗ khớp `near` để ngày lấy được đúng ngữ cảnh (VD "next billing date"). */
function scopeAround(text: string, near: RegExp): string | null {
  const match = near.exec(text);
  if (!match) return null;
  const start = match.index;
  return text.slice(start, start + 220);
}

const pad = (year: string, month: string, day: string): IsoDate =>
  `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

export interface ExtractedInterval {
  intervalUnit: IntervalUnit;
  intervalCount: number;
}

/** Nhận chu kỳ: monthly/yearly/annual/hằng tháng/mỗi năm/3 tháng… */
export function extractInterval(text: string): ExtractedInterval | null {
  const lower = text.toLowerCase();
  if (
    /(yearly|annual|per year|\/year|một năm|mỗi năm|hằng năm|hàng năm|12 tháng)/.test(
      lower,
    )
  ) {
    return { intervalUnit: 'YEAR', intervalCount: 1 };
  }
  const quarterly = /(quarterly|mỗi quý|3 tháng)/.test(lower);
  if (quarterly) return { intervalUnit: 'MONTH', intervalCount: 3 };
  if (/(weekly|mỗi tuần|hằng tuần|hàng tuần)/.test(lower)) {
    return { intervalUnit: 'WEEK', intervalCount: 1 };
  }
  if (
    /(monthly|per month|\/month|\/mo\b|mỗi tháng|hằng tháng|hàng tháng|một tháng)/.test(
      lower,
    )
  ) {
    return { intervalUnit: 'MONTH', intervalCount: 1 };
  }
  return null;
}

/** Tên gói nếu email có nói: "Premium", "Pro", "Plus", "Family", "Standard with ads"… */
export function extractPlanName(text: string): string | null {
  const match =
    /\b(premium|pro\b|plus\b|family|standard|basic|individual|duo|student|team|business|essential)([\w +-]{0,24})/i.exec(
      text,
    );
  if (!match) return null;
  return `${match[1]}${match[2] ?? ''}`
    .trim()
    .replace(/\s{2,}/g, ' ')
    .slice(0, 40);
}
