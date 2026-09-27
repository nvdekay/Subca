import { View } from 'react-native';
import { colors } from '@/theme';

/** Thanh tiến độ ngân sách; `over` = vượt hạn mức → màu cam đỏ như mockup. */
export function Progress({ percent, over = false }: { percent: number; over?: boolean }) {
  const width = `${Math.max(0, Math.min(percent, 100))}%` as const;
  return (
    <View className="h-[10px] overflow-hidden rounded-[6px] bg-[rgba(101,113,102,0.14)]">
      <View
        className="h-full rounded-[6px]"
        style={{
          width,
          backgroundColor: over ? undefined : colors['ink-brand'],
          experimental_backgroundImage: over
            ? 'linear-gradient(90deg, #E59C82, #C9694D)'
            : undefined,
        }}
      />
    </View>
  );
}
