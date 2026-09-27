import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Pill } from '@/components/ui/pill';
import { Text } from '@/components/ui/text';
import { useMe } from '@/features/auth/use-me';
import { unregisterPush } from '@/features/notifications/push';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/theme';

/** Hồ sơ tạm: thông tin tài khoản + đăng xuất. Cài đặt đầy đủ làm theo màn 16 của mockup sau. */
export default function Profile() {
  const { data: me } = useMe();
  const [signingOut, setSigningOut] = useState(false);
  const name = me?.displayName ?? me?.email?.split('@')[0] ?? '';

  function confirmSignOut() {
    Alert.alert('Đăng xuất?', 'Bạn có thể đăng nhập lại bằng email bất cứ lúc nào.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          // Gỡ push token trước (cần còn đăng nhập), rồi mới đăng xuất.
          await unregisterPush();
          // Phiên đổi → _layout tự quay về màn chào; cache được xóa trong SessionProvider.
          await supabase.auth.signOut();
          setSigningOut(false);
        },
      },
    ]);
  }

  return (
    <Screen>
      <TopBar title="Hồ sơ" />
      <Card className="items-center gap-2 py-6">
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{
            experimental_backgroundImage: `linear-gradient(135deg, ${colors.coral}, ${colors.peach})`,
          }}
        >
          <Text weight="bold" className="text-[24px] leading-[30px] text-on-coral">
            {(name[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <Text weight="bold" className="text-[18px] leading-[24px]">
          {name}
        </Text>
        <Text className="text-[14px] text-ink-3">{me?.email}</Text>
        {me ? (
          <View className="mt-1">
            <Pill
              tone={me.plan.tier === 'PLUS' ? 'trial' : 'cancel'}
              icon={me.plan.tier === 'PLUS' ? 'sparkle' : undefined}
              label={me.plan.tier === 'PLUS' ? 'Subca Plus' : 'Gói Free'}
            />
          </View>
        ) : null}
      </Card>
      <Pressable
        onPress={() => router.push('/payments')}
        accessibilityRole="button"
        className="mt-5 flex-row items-center gap-3 rounded-md bg-surface p-4 active:scale-[0.985]"
        style={{ boxShadow: shadow.sm }}
      >
        <View className="h-[38px] w-[38px] items-center justify-center rounded-[12px] bg-sky-soft">
          <Icon name="card" />
        </View>
        <Text weight="semibold" className="flex-1">
          Phương thức thanh toán
        </Text>
        <Icon name="chev" size={18} color={colors['ink-3']} />
      </Pressable>
      <Button
        title="Đăng xuất"
        variant="soft"
        className="mt-5"
        loading={signingOut}
        onPress={confirmSignOut}
      />
    </Screen>
  );
}
