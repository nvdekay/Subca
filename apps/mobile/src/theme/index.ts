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
 * Be Vietnam Pro nạp theo từng độ đậm: font tùy chỉnh trên Android không tự chọn độ đậm theo
 * `fontWeight`, nên đổi độ đậm bằng cách đổi hẳn fontFamily (component Text lo việc này).
 */
export const fontFamily = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extrabold: 'BeVietnamPro_800ExtraBold',
} as const;
export type FontWeight = keyof typeof fontFamily;
