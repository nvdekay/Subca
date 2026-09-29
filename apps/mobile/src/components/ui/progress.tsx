import { View } from 'react-native';
import { colors } from '@/theme';

/** Thanh tiến độ giấy mờ; trạng thái vượt hạn mức dùng dusty red. */
export function Progress({ percent, over = false }: { percent: number; over?: boolean }) {
  const width = `${Math.max(0, Math.min(percent, 100))}%` as const;
  return (
    <View className="h-[8px] overflow-hidden rounded-[5px] bg-stone">
      <View
        className="h-full rounded-[6px]"
        style={{
          width,
          backgroundColor: over ? colors['coral-deep'] : colors['ink-brand'],
        }}
      />
    </View>
  );
}
