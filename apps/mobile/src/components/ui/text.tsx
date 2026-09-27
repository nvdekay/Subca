import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/cn';
import { fontFamily, type FontWeight } from '@/theme';

export type TextProps = RNTextProps & {
  weight?: FontWeight;
  /** Số dạng bảng (các chữ số rộng bằng nhau) cho tiền và số đếm. */
  tabular?: boolean;
  className?: string;
};

/** Chữ mặc định của app: Be Vietnam Pro, cỡ 15, màu ink. Dùng `weight` thay cho class font-bold. */
export function Text({ weight = 'regular', tabular, className, style, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-[15px] leading-[22px] text-ink', className)}
      style={[
        { fontFamily: fontFamily[weight] },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...props}
    />
  );
}
