import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';

/** Bottom sheet (mockup: .sheet): nền kem bo góc 32 phía trên, thanh kéo, chạm nền tối để đóng. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityLabel="Đóng"
          className="absolute inset-0 bg-[rgba(48,44,37,0.42)]"
          onPress={onClose}
        />
        <View
          className="max-h-[82%] rounded-t-[22px] border-t border-line bg-bg px-5 pt-[10px]"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="mx-auto mb-4 h-[5px] w-10 rounded-[3px] bg-sage" />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {title ? (
              <Text
                weight="extrabold"
                className="mb-[6px] text-[20px] leading-[26px]"
                style={{ letterSpacing: -0.4 }}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text className="mb-4 text-[14px] leading-[21px] text-ink-2">{subtitle}</Text>
            ) : null}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
