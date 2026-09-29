import tokens from './tokens.json';

export const colors = tokens.colors;
export const radius = tokens.radius;

/** Bóng đổ của mockup (--shadow-sm / --shadow-md), dùng thuộc tính `boxShadow` của New Architecture. */
export const shadow = {
  sm: '0 1px 2px rgba(73,56,35,0.05), 0 3px 10px rgba(73,56,35,0.06)',
  md: '0 2px 5px rgba(73,56,35,0.05), 0 9px 22px rgba(73,56,35,0.09)',
  nav: '0 8px 28px rgba(64,49,30,0.16)',
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
