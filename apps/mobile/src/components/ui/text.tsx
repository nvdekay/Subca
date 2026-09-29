import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/cn';
import { fontFamily, type FontWeight } from '@/theme';

export type TextProps = RNTextProps & {
  weight?: FontWeight;
  /** Số dạng bảng (các chữ số rộng bằng nhau) cho tiền và số đếm. */
  tabular?: boolean;
  className?: string;
};

/** Kiểu chữ duy nhất của app: Nunito; map weight tĩnh để đồng nhất iOS và Android. */
export function Text({ weight = 'regular', tabular, className, style, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-[15px] leading-[22px] text-ink', className)}
      style={[
        {
          fontFamily: fontFamily[weight],
        },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...props}
    />
  );
}
