import { View } from 'react-native';
import { colors } from '@/theme';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

/** Logo chữ Subca: dấu olive và kiểu chữ serif editorial. */
export function BrandMark() {
  return (
    <View className="flex-row items-center gap-[10px]">
      <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-brass/50 bg-ink-brand">
        <Icon name="repeat" color={colors['butter-soft']} />
      </View>
      <Text
        weight="extrabold"
        className="text-[22px] leading-[28px]"
        style={{ letterSpacing: -0.66 }}
      >
        Subca
      </Text>
    </View>
  );
}
