import type { PaymentMethodType } from '@subca/shared';

/** Màu phẳng theo thương hiệu/loại; UI không dùng gradient. */
const BY_BRAND: Record<string, string> = {
  VISA: '#263B86',
  MASTERCARD: '#4C4038',
  JCB: '#155CA8',
  AMEX: '#236E86',
  NAPAS: '#245B94',
  MOMO: '#A7196D',
  ZALOPAY: '#1472D4',
  VNPAY: '#1D69A6',
  SHOPEEPAY: '#D95235',
};

const BY_TYPE: Record<PaymentMethodType, string> = {
  CARD: '#3D5547',
  PAYPAL: '#24549A',
  APP_STORE: '#414149',
  GOOGLE_PLAY: '#38734F',
  E_WALLET: '#347D8B',
  BANK_TRANSFER: '#357051',
  OTHER: '#718075',
};

export function cardColor(type: PaymentMethodType, brand: string | null): string {
  return (brand && BY_BRAND[brand]) || BY_TYPE[type];
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
