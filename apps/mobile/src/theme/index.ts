import tokens from './tokens.json';

export const colors = tokens.colors;
export const radius = tokens.radius;

/** Bóng đổ của mockup (--shadow-sm / --shadow-md), dùng thuộc tính `boxShadow` của New Architecture. */
export const shadow = {
  sm: '0 1px 2px rgba(47,58,49,0.04), 0 4px 14px rgba(47,58,49,0.05)',
  md: '0 2px 6px rgba(47,58,49,0.05), 0 14px 34px rgba(47,58,49,0.09)',
  nav: '0 10px 36px rgba(47,58,49,0.14)',
} as const;

/**
 * Nunito nạp theo từng độ đậm: font tùy chỉnh trên Android không tự chọn độ đậm theo
 * `fontWeight`, nên đổi độ đậm bằng cách đổi hẳn fontFamily (component Text lo việc này).
 */
export const fontFamily = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;
export type FontWeight = keyof typeof fontFamily;
