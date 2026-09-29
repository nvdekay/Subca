import { ActivityIndicator, Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { colors, shadow } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

type Variant = 'primary' | 'sky' | 'soft' | 'coral' | 'ghost';

const VARIANT: Record<Variant, { box: string; text: string; color: string }> = {
  primary: { box: 'border border-ink bg-ink', text: 'text-bg', color: colors.bg },
  sky: { box: 'border border-sky-deep bg-sky', text: 'text-on-sky', color: colors['on-sky'] },
  soft: { box: 'border border-line bg-surface', text: 'text-ink', color: colors.ink },
  coral: {
    box: 'border border-coral-deep/30 bg-coral',
    text: 'text-on-coral',
    color: colors['on-coral'],
  },
  ghost: { box: 'bg-transparent', text: 'text-ink-2', color: colors['ink-2'] },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  className,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  /** Icon đặt sau chữ (VD mũi tên "chev"). */
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const v = VARIANT[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={cn(
        'flex-row items-center justify-center gap-2 active:scale-[0.97]',
        size === 'md' ? 'h-[52px] rounded-[14px] px-5' : 'h-10 rounded-[11px] px-[14px]',
        v.box,
        inactive && 'opacity-60',
        className,
      )}
      style={{ boxShadow: shadow.sm }}
    >
      {loading ? <ActivityIndicator color={v.color} /> : null}
      <Text
        weight={variant === 'ghost' ? 'semibold' : 'bold'}
        className={`${size === 'md' ? 'text-[15px]' : 'text-[13px]'} ${v.text}`}
      >
        {title}
      </Text>
      {icon && !loading ? (
        <View>
          <Icon name={icon} color={v.color} />
        </View>
      ) : null}
    </Pressable>
  );
}
