import type { PaymentMethodType } from '@subca/shared';

/** Màu phẳng, tiết chế theo từng loại thanh toán để hợp bảng màu vintage. */
const BY_BRAND: Record<string, string> = {
  VISA: '#796A51',
  MASTERCARD: '#695B4E',
  JCB: '#5E6C61',
  AMEX: '#586B68',
  NAPAS: '#626348',
  MOMO: '#8D5B68',
  ZALOPAY: '#66718A',
  VNPAY: '#89594D',
  SHOPEEPAY: '#975C49',
};

const BY_TYPE: Record<PaymentMethodType, string> = {
  CARD: '#626348',
  PAYPAL: '#66718A',
  APP_STORE: '#625D56',
  GOOGLE_PLAY: '#5E6C61',
  E_WALLET: '#8D5B68',
  BANK_TRANSFER: '#626348',
  OTHER: '#786D5D',
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
