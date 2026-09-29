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
      {footer ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-line bg-bg px-5 pt-4"
          style={{
            paddingBottom: Math.max(insets.bottom, 12) + 4,
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

/** Thanh tiêu đề màn con: điều hướng bên trái, tiêu đề theo trục đọc, CTA bên phải. */
export function TopBar({
  title,
  right,
  close = false,
  eyebrow,
}: {
  title?: string;
  right?: ReactNode;
  close?: boolean;
  eyebrow?: string;
}) {
  return (
    <View className="mb-5 min-h-[52px] flex-row items-center gap-3">
      {router.canGoBack() ? (
        <IconButton
          icon={close ? 'x' : 'back'}
          label={close ? 'Đóng' : 'Quay lại'}
          onPress={() => router.back()}
        />
      ) : (
        <View className="w-1" />
      )}
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <Text className="text-[11px] leading-[15px] text-ink-3" numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text weight="extrabold" className="text-[20px] leading-[26px]" numberOfLines={1}>
          {title ?? ''}
        </Text>
      </View>
      {right}
    </View>
  );
}
