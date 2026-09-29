import { Switch, View } from 'react-native';
import { colors, shadow } from '@/theme';
import { Text } from './text';

/** Dòng bật/tắt (mockup: .toggle-row). */
export function ToggleRow({
  title,
  note,
  value,
  onChange,
}: {
  title: string;
  note?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View
      className="flex-row items-center justify-between gap-3 rounded-[16px] bg-surface px-4 py-[14px]"
      style={{ boxShadow: shadow.sm }}
    >
      <View className="flex-1">
        <Text weight="bold">{title}</Text>
        {note ? <Text className="text-[13px] leading-[18px] text-ink-3">{note}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ true: colors['ink-brand'], false: colors.line }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.line}
      />
    </View>
  );
}
