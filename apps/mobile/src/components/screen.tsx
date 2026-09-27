import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { IconButton } from './ui/icon-button';
import { Text } from './ui/text';

/** Khung màn hình cuộn, lề ngang 20 như mockup; `tabBar` chừa chỗ cho thanh điều hướng nổi. */
export function Screen({
  children,
  tabBar = false,
  keyboard = false,
  ...props
}: ScrollViewProps & { children: ReactNode; tabBar?: boolean; keyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const content = (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + (tabBar ? 120 : 40),
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
  const page = (
    <View className="flex-1 bg-bg">
      {content}
      {/* Dải nền dưới thanh trạng thái (mockup: .statusbar) để nội dung cuộn không đè lên giờ / pin. */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 top-0"
        style={{
          height: insets.top + 8,
          experimental_backgroundImage: `linear-gradient(180deg, ${colors.bg} 70%, rgba(248,247,243,0) 100%)`,
        }}
      />
    </View>
  );
  if (!keyboard) return page;
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {page}
    </KeyboardAvoidingView>
  );
}

/** Thanh trên cùng: nút quay lại + tiêu đề giữa. */
export function TopBar({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <View className="mb-[18px] min-h-11 flex-row items-center justify-between gap-3">
      {router.canGoBack() ? (
        <IconButton icon="back" label="Quay lại" onPress={() => router.back()} />
      ) : (
        <View className="w-11" />
      )}
      <Text
        weight="bold"
        className="flex-1 text-center text-[18px] leading-[24px]"
        numberOfLines={1}
      >
        {title ?? ''}
      </Text>
      {right ?? <View className="w-11" />}
    </View>
  );
}
