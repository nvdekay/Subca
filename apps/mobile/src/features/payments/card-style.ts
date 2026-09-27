import type { PaymentMethodType } from '@subca/shared';

/** Nền thẻ theo thương hiệu (mockup: .pcard), không có thì theo loại. */
const BY_BRAND: Record<string, [string, string]> = {
  VISA: ['#1A1F71', '#3A62B8'],
  MASTERCARD: ['#2B2B2B', '#5A4A42'],
  JCB: ['#0B4EA2', '#2E86C1'],
  AMEX: ['#1F6F8B', '#4FA3C0'],
  NAPAS: ['#0E4C92', '#E0312B'],
  MOMO: ['#A50064', '#D82D8B'],
  ZALOPAY: ['#0068FF', '#00A2FF'],
  VNPAY: ['#005BAA', '#E42127'],
  SHOPEEPAY: ['#EE4D2D', '#F7794E'],
};

const BY_TYPE: Record<PaymentMethodType, [string, string]> = {
  CARD: ['#2F3A31', '#4F6655'],
  PAYPAL: ['#003087', '#0070E0'],
  APP_STORE: ['#1C1C1E', '#4A4A4F'],
  GOOGLE_PLAY: ['#1E6B45', '#34A853'],
  E_WALLET: ['#3F8797', '#6FB3C2'],
  BANK_TRANSFER: ['#2E5B45', '#4F8A6C'],
  OTHER: ['#657166', '#8A968B'],
};

export function cardGradient(type: PaymentMethodType, brand: string | null): string {
  const [from, to] = (brand && BY_BRAND[brand]) || BY_TYPE[type];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

/** Thương hiệu gợi ý theo loại để chọn nhanh trong form. */
export const BRANDS_BY_TYPE: Partial<Record<PaymentMethodType, string[]>> = {
  CARD: ['VISA', 'MASTERCARD', 'JCB', 'AMEX', 'NAPAS'],
  E_WALLET: ['MOMO', 'ZALOPAY', 'VNPAY', 'SHOPEEPAY'],
};

export const BRAND_LABEL: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  JCB: 'JCB',
  AMEX: 'Amex',
  NAPAS: 'Napas',
  MOMO: 'MoMo',
  ZALOPAY: 'ZaloPay',
  VNPAY: 'VNPay',
  SHOPEEPAY: 'ShopeePay',
};
