import { Pressable, View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';
import { shadow } from '@/theme';

type Tone = 'surface' | 'mint' | 'peach' | 'coral' | 'sky';

const TONE_CLASS: Record<Tone, string> = {
  surface: 'bg-surface',
  mint: 'bg-mint',
  peach: 'bg-peach',
  coral: 'bg-coral',
  sky: 'bg-sky-soft',
};

export type CardProps = ViewProps & { tone?: Tone; className?: string; onPress?: () => void };

/** Khối nội dung dạng editorial: nền sáng, viền mực dày và bóng offset. */
export function Card({
  tone = 'surface',
  className,
  style,
  onPress,
  children,
  ...props
}: CardProps) {
  const cardClass = cn('rounded-md border-2 border-ink p-4', TONE_CLASS[tone], className);
  const cardStyle = [{ boxShadow: shadow.sm }, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={`${cardClass} active:scale-[0.985]`}
        style={cardStyle}
        {...props}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={cardClass} style={cardStyle} {...props}>
      {children}
    </View>
  );
}
