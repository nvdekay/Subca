import tokens from './tokens.json';

export const colors = tokens.colors;
export const radius = tokens.radius;

/** Bóng đổ offset cứng theo phong cách editorial/bento của app. */
export const shadow = {
  sm: '0 3px 0 #202B34',
  md: '0 5px 0 #202B34',
  nav: '0 4px 0 #202B34',
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
