import { Pressable, View } from 'react-native';
import { colors, shadow } from '@/theme';
import { Icon, type IconName } from './icon';

/** Nút 44×44 dạng khối, viền mực và bóng offset. `dot` báo có thông báo mới. */
export function IconButton({
  icon,
  label,
  onPress,
  dot = false,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      className="h-11 w-11 items-center justify-center rounded-sm border-2 border-ink bg-surface active:translate-y-[3px]"
      style={{ boxShadow: shadow.sm }}
    >
      <Icon name={icon} />
      {dot ? (
        <View
          className="absolute right-[11px] top-[10px] h-2 w-2 rounded-full border-2 border-white bg-coral-deep"
          style={{ borderColor: colors.surface }}
        />
      ) : null}
    </Pressable>
  );
}
