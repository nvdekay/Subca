import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ServiceLogo } from '@/components/service-logo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme';

/** Khung chỉ lộ nửa trên điện thoại; các thẻ xuất hiện bên trong màn hình, không nổi bên ngoài. */
export function IntroPhone({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <View
      className="w-full items-center overflow-hidden border-b border-line"
      style={{ height: 300 }}
    >
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(650)}
        style={{
          width: '90%',
          maxWidth: 300,
          height: 530,
          borderRadius: 38,
          borderWidth: 2,
          borderColor: colors['ink-2'],
          backgroundColor: colors.ink,
          padding: 5,
        }}
      >
        <View style={{ flex: 1, overflow: 'hidden', borderRadius: 31, backgroundColor: colors.bg }}>
          <View className="h-10 flex-row items-center justify-between px-5">
            <Text weight="bold" className="text-[10px]">
              9:41
            </Text>
            <View className="h-[13px] w-[62px] rounded-full bg-ink" />
            <View className="h-[8px] w-[16px] rounded-[3px] border border-ink p-px">
              <View className="flex-1 rounded-[1px] bg-ink" />
            </View>
          </View>
          <View className="px-4 pt-1">
            <View className="mb-3 flex-row items-center justify-between">
              <Text weight="extrabold" className="text-[18px] leading-[24px]">
                Gói của bạn
              </Text>
              <View className="h-7 w-7 items-center justify-center rounded-full bg-mint">
                <Icon name="user" size={14} color={colors['ink-brand']} />
              </View>
            </View>
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.delay(300).duration(550)}
              className="mb-3 flex-row items-center gap-2 rounded-sm bg-mint px-3 py-2"
            >
              <Icon name="check-circle" size={14} color={colors['ink-brand']} />
              <Text weight="semibold" className="flex-1 text-[10px] leading-[15px]">
                Đã tìm thấy từ hộp thư của bạn
              </Text>
            </Animated.View>
            {[
              { name: 'Netflix', key: 'netflix', color: '#E50914', note: 'Giải trí của bạn' },
              { name: 'Spotify', key: 'spotify', color: '#1ED760', note: 'Âm nhạc mỗi ngày' },
            ].map((service, index) => (
              <Animated.View
                key={service.key}
                entering={
                  reducedMotion ? undefined : FadeInDown.delay(500 + index * 220).duration(600)
                }
                className="mb-2 flex-row items-center gap-2 rounded-sm border border-line bg-surface p-3"
              >
                <ServiceLogo
                  name={service.name}
                  service={{ logoKey: service.key, brandColor: service.color }}
                  size="sm"
                />
                <View className="flex-1">
                  <Text weight="bold" className="text-[13px] leading-[18px]">
                    {service.name}
                  </Text>
                  <Text className="text-[10px] leading-[15px] text-ink-3">{service.note}</Text>
                </View>
                <Icon name="check-circle" color={colors['ink-brand']} size={16} />
              </Animated.View>
            ))}
            <View className="mt-2 rounded-sm border border-line bg-surface p-3">
              <View className="h-2 w-20 rounded bg-line" />
              <View className="mt-2 h-2 w-32 rounded bg-stone" />
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
