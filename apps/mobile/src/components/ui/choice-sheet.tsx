import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Text } from './text';

/** Bottom sheet chọn một giá trị trong danh sách (tiền tệ, múi giờ, giờ nhắc…). */
export function ChoiceSheet<T extends string | number>({
  visible,
  title,
  subtitle,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: { value: T; label: string; note?: string }[];
  value: T | null | undefined;
  onPick: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View className="overflow-hidden rounded-[20px] bg-surface">
        {options.map((o, i) => (
          <Pressable
            key={String(o.value)}
            onPress={() => onPick(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: o.value === value }}
            className={cn(
              'flex-row items-center gap-3 px-4 py-[14px] active:bg-bg',
              i > 0 && 'border-t border-line',
            )}
          >
            <View className="flex-1">
              <Text weight={o.value === value ? 'bold' : 'regular'}>{o.label}</Text>
              {o.note ? <Text className="text-[12.5px] text-ink-3">{o.note}</Text> : null}
            </View>
            {o.value === value ? <Icon name="check" color={colors['ink-brand']} /> : null}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
