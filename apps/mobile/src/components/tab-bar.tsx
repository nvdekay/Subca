import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { colors, shadow } from '@/theme';
import { Icon, type IconName } from './ui/icon';
import { Text } from './ui/text';
import { useInbox } from '@/features/detection/queries';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Trang chủ', icon: 'home' },
  subscriptions: { label: 'Gói của tôi', icon: 'list' },
  inbox: { label: 'Cần chú ý', icon: 'bell' },
  analytics: { label: 'Phân tích', icon: 'chart' },
};

/** Thanh điều hướng dạng bảng nổi, viền mực và nút thêm màu cam. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const inbox = useInbox();
  // Expo Router's tab state can include routes that are deliberately hidden
  // from this custom bar (for example modal/utility routes). Exclude them
  // before calculating the center action's position.
  const items = state.routes.flatMap((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return [];
    const focused = state.index === index;
    return [
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
        className="h-[60px] w-full items-center justify-center gap-1"
      >
        <View
          className={`h-[30px] w-11 items-center justify-center rounded-sm ${focused ? 'bg-brass-soft' : ''}`}
        >
          <Icon name={tab.icon} color={focused ? colors.accent : colors['ink-3']} />
          {route.name === 'inbox' && (inbox.data?.openCount ?? 0) > 0 ? (
            <View className="absolute right-[2px] top-[1px] h-[8px] w-[8px] rounded-full border border-surface bg-coral-deep" />
          ) : null}
        </View>
        <Text
          weight="semibold"
          className={`text-[11px] leading-[14px] ${focused ? 'text-ink-brand' : 'text-ink-3'}`}
        >
          {tab.label}
        </Text>
      </Pressable>,
    ];
  });

  // Năm cột cố định giữ bốn đích chính cân hai bên CTA, kể cả khi có route ẩn.
  const bottom = Math.max(insets.bottom, 10) + 4;
  return (
    <>
      {/* Nền đặc ngăn nội dung cuộn lộ qua khe dưới thanh tab. */}
      <View
        pointerEvents="none"
        className="absolute bottom-0 left-0 right-0 bg-bg"
        style={{ height: bottom + 72 + 24 }}
      />
      <View
        className="absolute left-[14px] right-[14px] h-[72px] flex-row items-center rounded-md px-2"
        style={{
          bottom,
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderWidth: 2,
          borderColor: colors.ink,
          boxShadow: shadow.nav,
        }}
      >
        <View className="flex-1">{items[0]}</View>
        <View className="flex-1">{items[1]}</View>
        <View className="z-10 w-[58px] items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm subscription"
            onPress={() => router.push('/add')}
            className="h-[58px] w-[58px] -translate-y-4 items-center justify-center rounded-md border-2 border-ink bg-accent active:translate-y-[-10px]"
            style={{ boxShadow: `0 4px 0 ${colors.ink}, 0 0 0 5px ${colors.bg}` }}
          >
            <Icon name="plus" size={26} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        </View>
        <View className="flex-1">{items[2]}</View>
        <View className="flex-1">{items[3]}</View>
      </View>
    </>
  );
}
