import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { shadow } from '@/theme';
import { Text } from './text';

/** Chip chọn (mockup: .chip): trắng có bóng, đang chọn thì nền ink chữ trắng. */
export function Chip({
  label,
  selected = false,
  count,
  onPress,
  left,
}: {
  label: string;
  selected?: boolean;
  /** Số nhỏ bên phải (bộ lọc danh sách). */
  count?: number;
  onPress?: () => void;
  left?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'h-[38px] flex-row items-center gap-[6px] rounded-full px-[15px] active:opacity-80',
        selected ? 'bg-ink' : 'bg-surface',
      )}
      style={selected ? undefined : { boxShadow: shadow.sm }}
    >
      {left}
      <Text
        weight="semibold"
        className={cn('text-[13.5px] leading-[18px]', selected ? 'text-white' : 'text-ink-2')}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <View
          className={cn(
            'rounded-full px-[7px] py-[1px]',
            selected ? 'bg-[rgba(255,255,255,0.18)]' : 'bg-bg',
          )}
        >
          <Text
            weight="semibold"
            className={cn('text-[11.5px] leading-[16px]', selected ? 'text-white' : 'text-ink-2')}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
