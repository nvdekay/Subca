import { View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { IntroPhone } from './intro-phone';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, shadow } from '@/theme';

const spendingBarColors = [
  colors['sky-deep'],
  colors.coral,
  colors.accent,
  colors['ink-brand'],
  colors['brass-soft'],
  colors['dusty-red'],
];

/** Minh hoạ, không đọc hoặc giả làm dữ liệu tài khoản thật. */
export function IntroArt({ scene, reducedMotion }: { scene: number; reducedMotion: boolean }) {
  const reveal = (delay: number) => (reducedMotion ? undefined : FadeIn.delay(delay).duration(650));
  return (
    <View aria-hidden className="items-center justify-center" style={{ minHeight: 260 }}>
      <Animated.View
        entering={reducedMotion ? undefined : ZoomIn.duration(700)}
        className="absolute h-[244px] w-[244px] rounded-full bg-peach"
      />
      {scene !== 1 ? (
        <>
          <View className="absolute right-2 top-3">
            <Icon name="sparkle" size={28} color={colors.accent} />
          </View>
          <View className="absolute bottom-5 left-1">
            <Icon name="sparkle" size={18} color={colors['ink-brand']} />
          </View>
        </>
      ) : null}
      {scene === 1 ? (
        <IntroPhone reducedMotion={reducedMotion} />
      ) : scene === 2 ? (
        <View className="w-full items-center px-3">
          <Animated.View
            entering={reveal(100)}
            className="w-[180px] overflow-hidden rounded-sm border border-line bg-surface"
            style={{ transform: [{ rotate: '-5deg' }], boxShadow: shadow.md }}
          >
            <View className="items-center bg-coral py-3">
              <Text weight="bold" className="text-[12px] text-ink-brand">
                LỜI NHẮC NHỎ
              </Text>
            </View>
            <View className="items-center py-3">
              <Text weight="extrabold" className="text-[62px] leading-[74px] text-accent">
                03
              </Text>
              <Text className="text-[12px] text-ink-2">ngày trước gia hạn</Text>
            </View>
          </Animated.View>
          <Animated.View
            entering={reveal(400)}
            className="-mt-1 w-full flex-row items-center gap-3 rounded-sm border border-line bg-surface p-4"
            style={{ boxShadow: shadow.md, transform: [{ rotate: '2deg' }] }}
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-peach">
              <Icon name="bell" color={colors.accent} />
            </View>
            <View className="flex-1">
              <Text weight="bold" className="text-[14px]">
                Sắp đến ngày gia hạn
              </Text>
              <Text className="text-[12px] text-ink-2">Giữ hay dừng? Bạn chủ động.</Text>
            </View>
          </Animated.View>
        </View>
      ) : (
        <Animated.View
          entering={reveal(150)}
          className="w-full rounded-sm border border-line bg-surface p-5"
          style={{ boxShadow: shadow.md, transform: [{ rotate: '-2deg' }] }}
        >
          <View className="flex-row items-center justify-between">
            <Text weight="bold" className="text-[14px]">
              Bức tranh chi tiêu
            </Text>
            <Icon name="chart" color={colors['ink-brand']} />
          </View>
          <View
            className="mb-4 mt-6 flex-row items-end justify-between gap-3 border-b border-line px-2 pb-2"
            style={{ height: 92 }}
          >
            {[42, 66, 52, 78, 48, 60].map((height, index) => (
              <Animated.View
                entering={reveal(250 + index * 70)}
                key={index}
                style={{
                  height,
                  flex: 1,
                  borderRadius: 6,
                  backgroundColor: spendingBarColors[index % spendingBarColors.length]!,
                }}
              />
            ))}
          </View>
          <View className="flex-row items-center gap-2">
            <Icon name="users" size={18} color={colors['ink-brand']} />
            <Text weight="semibold" className="text-[13px]">
              Gói chung, phần tiền rõ ràng
            </Text>
          </View>
          <Text className="mt-3 text-[10px] text-ink-3">
            Hình minh hoạ · Không phải dữ liệu tài khoản
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
