import { View } from 'react-native';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type PillTone = 'active' | 'trial' | 'review' | 'cancel' | 'warn';

const TONE: Record<PillTone, { box: string; text: string; color: string }> = {
  active: { box: 'bg-mint', text: 'text-on-mint', color: colors['on-mint'] },
  trial: { box: 'bg-sky-soft', text: 'text-on-sky', color: colors['on-sky'] },
  review: { box: 'bg-peach', text: 'text-on-peach', color: colors['on-peach'] },
  cancel: { box: 'bg-muted-bg', text: 'text-ink-2', color: colors['ink-2'] },
  warn: { box: 'bg-coral', text: 'text-on-coral', color: colors['on-coral'] },
};

export function Pill({
  label,
  tone,
  icon,
  className,
}: {
  label: string;
  tone: PillTone;
  icon?: IconName;
  /** Ghi đè nền, VD `bg-surface` khi đặt trên thẻ màu (mockup: pill trắng ở màn Chi tiết). */
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <View
      className={cn(
        'flex-row items-center gap-[5px] self-start rounded-sm border border-ink px-[9px] py-1',
        t.box,
        className,
      )}
    >
      {icon ? <Icon name={icon} size={13} color={t.color} strokeWidth={2.2} /> : null}
      <Text weight="semibold" className={`text-[12px] leading-[17px] ${t.text}`}>
        {label}
      </Text>
    </View>
  );
}
