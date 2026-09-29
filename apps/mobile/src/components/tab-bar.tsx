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

/** Thanh điều hướng nổi bo 28 với nút "+" ở giữa (mockup: .nav). */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const inbox = useInbox();
  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    return (
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
        className="h-[60px] flex-1 items-center justify-center gap-1"
      >
        <View
          className={`h-[30px] w-11 items-center justify-center rounded-[12px] ${focused ? 'bg-mint' : ''}`}
        >
          <Icon name={tab.icon} color={focused ? colors.ink : colors['ink-3']} />
          {route.name === 'inbox' && (inbox.data?.openCount ?? 0) > 0 ? (
            <View className="absolute right-[2px] top-[1px] h-[8px] w-[8px] rounded-full border border-surface bg-coral-deep" />
          ) : null}
        </View>
        <Text
          weight="semibold"
          className={`text-[11px] leading-[14px] ${focused ? 'text-ink' : 'text-ink-3'}`}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  });

  // Nút thêm nằm giữa: 2 tab bên trái, 2 tab bên phải.
  const middle = Math.ceil(items.length / 2);
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
        className="absolute left-[14px] right-[14px] h-[72px] flex-row items-center justify-around rounded-[28px] px-2"
        style={{
          bottom,
          backgroundColor: 'rgba(255,255,255,0.94)',
          boxShadow: shadow.nav,
        }}
      >
        {items.slice(0, middle)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm subscription"
          onPress={() => router.push('/add')}
          className="mx-1 h-[62px] w-[62px] -translate-y-4 items-center justify-center rounded-[22px] bg-ink active:scale-[0.94]"
          style={{ boxShadow: `0 12px 24px rgba(47,58,49,0.32), 0 0 0 6px ${colors.bg}` }}
        >
          <Icon name="plus" size={26} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        {items.slice(middle)}
      </View>
    </>
  );
}
