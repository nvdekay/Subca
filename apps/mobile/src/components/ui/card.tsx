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

/** Thẻ bo góc 26: nền trắng có bóng, hoặc nền màu pastel không bóng (giống .card trong mockup). */
export function Card({
  tone = 'surface',
  className,
  style,
  onPress,
  children,
  ...props
}: CardProps) {
  const cardClass = cn('rounded-lg p-[18px]', TONE_CLASS[tone], className);
  const cardStyle = [tone === 'surface' && { boxShadow: shadow.sm }, style];
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
