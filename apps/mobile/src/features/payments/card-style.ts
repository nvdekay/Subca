import type { PaymentMethodType } from '@subca/shared';

/** Thẻ thanh toán dùng màu slate chung; tên ngân hàng/thương hiệu vẫn giữ nguyên. */
const BY_BRAND: Record<string, string> = {
  VISA: '#393E46',
  MASTERCARD: '#393E46',
  JCB: '#393E46',
  AMEX: '#393E46',
  NAPAS: '#393E46',
  MOMO: '#393E46',
  ZALOPAY: '#393E46',
  VNPAY: '#393E46',
  SHOPEEPAY: '#393E46',
};

const BY_TYPE: Record<PaymentMethodType, string> = {
  CARD: '#393E46',
  PAYPAL: '#393E46',
  APP_STORE: '#393E46',
  GOOGLE_PLAY: '#393E46',
  E_WALLET: '#393E46',
  BANK_TRANSFER: '#393E46',
  OTHER: '#393E46',
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
