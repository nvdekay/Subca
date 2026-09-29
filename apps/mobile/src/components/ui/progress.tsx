import { View } from 'react-native';
import { colors } from '@/theme';

/** Thanh tiến độ dạng ô viền mực; vượt hạn mức dùng đỏ đất. */
export function Progress({ percent, over = false }: { percent: number; over?: boolean }) {
  const width = `${Math.max(0, Math.min(percent, 100))}%` as const;
  return (
    <View className="h-[10px] overflow-hidden border border-ink bg-stone">
      <View
        className="h-full"
        style={{
          width,
          backgroundColor: over ? colors['coral-deep'] : colors.accent,
        }}
      />
    </View>
  );
}
