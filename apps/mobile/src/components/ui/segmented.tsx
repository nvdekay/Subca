import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { shadow } from '@/theme';
import { Text } from './text';

/** Nhóm nút chọn một (mockup: .seg). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row gap-1 rounded-[16px] bg-[rgba(101,113,102,0.1)] p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className={cn(
              'h-10 flex-1 items-center justify-center rounded-[12px]',
              on && 'bg-surface',
            )}
            style={on ? { boxShadow: shadow.sm } : undefined}
          >
            <Text
              weight="semibold"
              className={cn('text-[13.5px] leading-[18px]', on ? 'text-ink' : 'text-ink-2')}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
