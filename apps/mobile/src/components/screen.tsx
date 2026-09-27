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

/**
 * Khung màn hình cuộn, lề ngang 20 như mockup; `tabBar` chừa chỗ cho thanh điều hướng nổi;
 * `footer` là nút chính dính ở đáy (mockup: .sticky-cta); `modal` cho màn mở dạng sheet của iOS
 * (đã nằm dưới thanh trạng thái nên không cộng khoảng cách phía trên).
 */
export function Screen({
  children,
  tabBar = false,
  keyboard = false,
  footer,
  modal = false,
  ...props
}: ScrollViewProps & {
  children: ReactNode;
  tabBar?: boolean;
  keyboard?: boolean;
  footer?: ReactNode;
  modal?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = modal ? 0 : insets.top;
  const bottomSpace = tabBar ? 120 : footer ? 110 : 40;
  const content = (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{
        paddingTop: top + (modal ? 16 : 6),
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + bottomSpace,
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
      {modal ? null : (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 top-0"
          style={{
            height: insets.top + 8,
            experimental_backgroundImage: `linear-gradient(180deg, ${colors.bg} 70%, rgba(248,247,243,0) 100%)`,
          }}
        />
      )}
      {footer ? (
        <View
          className="absolute bottom-0 left-0 right-0 px-5 pt-6"
          style={{
            paddingBottom: Math.max(insets.bottom, 12) + 4,
            experimental_backgroundImage: `linear-gradient(180deg, rgba(248,247,243,0) 0%, ${colors.bg} 35%)`,
          }}
        >
          {footer}
        </View>
      ) : null}
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

/** Thanh trên cùng: nút quay lại (hoặc "✕" cho màn dạng modal) + tiêu đề giữa. */
export function TopBar({
  title,
  right,
  close = false,
}: {
  title?: string;
  right?: ReactNode;
  close?: boolean;
}) {
  return (
    <View className="mb-[18px] min-h-11 flex-row items-center justify-between gap-3">
      {router.canGoBack() ? (
        <IconButton
          icon={close ? 'x' : 'back'}
          label={close ? 'Đóng' : 'Quay lại'}
          onPress={() => router.back()}
        />
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
