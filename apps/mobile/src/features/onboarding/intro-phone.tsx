import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ServiceLogo } from '@/components/service-logo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme';

const services = [
  { name: 'Netflix', key: 'netflix', color: '#E50914' },
  { name: 'Spotify', key: 'spotify', color: '#1ED760' },
];

/** Minh hoạ nửa trên điện thoại, dành khoảng trống hai bên cho icon trang trí. */
export function IntroPhone({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <View className="w-full overflow-hidden border-b border-line" style={{ height: 292 }}>
      <View className="absolute right-0 top-6">
        <Icon name="sparkle" size={22} color={colors.accent} />
      </View>
      <View className="absolute bottom-8 left-0">
        <Icon name="sparkle" size={18} color={colors['ink-brand']} />
      </View>
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(650)}
        style={{
          alignSelf: 'center',
          width: '78%',
          maxWidth: 278,
          height: 500,
          borderRadius: 36,
          borderWidth: 2,
          borderColor: colors['ink-2'],
          backgroundColor: colors.ink,
          padding: 5,
        }}
      >
        <View style={{ flex: 1, overflow: 'hidden', borderRadius: 29, backgroundColor: colors.bg }}>
          <View className="h-10 flex-row items-center justify-between px-4">
            <Text weight="bold" className="text-[10px]">
              9:41
            </Text>
            <View className="h-[12px] w-[58px] rounded-full bg-ink" />
            <View className="h-[8px] w-[16px] rounded-[3px] border border-ink p-px">
              <View className="flex-1 rounded-[1px] bg-ink" />
            </View>
          </View>
          <View className="px-3 pt-2">
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
              <Icon name="check-circle" size={15} color={colors['on-mint']} />
              <Text weight="bold" className="flex-1 text-[11px] leading-[16px] text-on-mint">
                Đã tìm thấy 2 gói
              </Text>
            </Animated.View>
            {services.map((service, index) => (
              <Animated.View
                key={service.key}
                entering={
                  reducedMotion ? undefined : FadeInDown.delay(500 + index * 220).duration(600)
                }
                className="mb-2 flex-row items-center gap-2 rounded-sm border-2 border-line bg-surface px-3 py-3"
              >
                <ServiceLogo
                  name={service.name}
                  service={{ logoKey: service.key, brandColor: service.color }}
                  size="sm"
                />
                <Text weight="bold" className="flex-1 text-[13px] leading-[18px]">
                  {service.name}
                </Text>
                <Icon name="check-circle" color={colors['ink-brand']} size={17} />
              </Animated.View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
