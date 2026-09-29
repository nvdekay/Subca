import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

const SCAN_ORANGE = '#D65C16';
const SCAN_BLUE = '#4779B8';
const SCAN_GREEN = '#39836B';

/** Tiến độ dạng indeterminate vì Gmail không cung cấp tổng số thư trước khi quét. */
export function ScanProgressCard({
  scannedCount,
  candidateCount,
}: {
  scannedCount: number;
  candidateCount: number;
}) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(12);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  useEffect(() => {
    if (reducedMotion) {
      fill.value = 38;
      return;
    }
    fill.value = withRepeat(
      withSequence(
        withTiming(82, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(18, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [fill, reducedMotion]);

  const stage =
    scannedCount === 0
      ? 'Đang kết nối và tải email từ Gmail'
      : candidateCount === 0
        ? 'Đang lọc email thanh toán và gia hạn'
        : 'Đang nhận diện các gói đăng ký';

  return (
    <Card
      tone="surface"
      className="min-h-[204px] gap-4 overflow-hidden border-[#E8C9AE] bg-[#FFF8F1] p-5"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-sm bg-[#FCE2CC]">
          <Icon name="sparkle" size={21} color={SCAN_ORANGE} />
        </View>
        <View className="flex-1">
          <Text weight="extrabold" className="text-[16px] leading-[22px] text-ink">
            Subca đang quét hộp thư
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-[12.5px] leading-[18px] text-ink-3">
            {stage}
          </Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-[#E6F2EC]">
          <View className="h-2.5 w-2.5 rounded-full bg-[#39836B]" />
        </View>
      </View>

      <View className="gap-2">
        <View className="h-2.5 overflow-hidden rounded-full bg-[#F0DDCB]">
          <Animated.View className="h-full rounded-full bg-[#D65C16]" style={fillStyle} />
        </View>
        <Text className="text-[11px] text-ink-3">
          Tiến độ trực tiếp · Gmail chưa cung cấp trước tổng số email cần quét
        </Text>
      </View>

      <View className="flex-row gap-2">
        <CountTile label="Email đã đọc" value={scannedCount} color={SCAN_BLUE} />
        <CountTile label="Email liên quan" value={candidateCount} color={SCAN_GREEN} />
      </View>
    </Card>
  );
}

function CountTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="min-h-[59px] flex-1 justify-center rounded-sm border border-white bg-white px-3 py-2">
      <Text weight="extrabold" tabular className="text-[19px] leading-[23px]" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[11px] leading-[15px] text-ink-3">{label}</Text>
    </View>
  );
}
