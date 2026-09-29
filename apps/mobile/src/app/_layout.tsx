import '../../global.css';

import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { SessionProvider, useSession } from '@/features/auth/session';
import { missingEnv } from '@/lib/env';
import { CACHE_MAX_AGE, queryClient, queryPersister } from '@/lib/query-client';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: CACHE_MAX_AGE,
            // Đổi phiên bản app thì bỏ cache cũ (dạng dữ liệu có thể đã khác).
            buster: Constants.expoConfig?.version ?? '1',
          }}
        >
          <SessionProvider>
            <StatusBar style="dark" />
            {missingEnv.length > 0 ? (
              <ConfigError />
            ) : (
              <RootNavigator fontsReady={fontsLoaded || fontError != null} />
            )}
          </SessionProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, ready, needsPassword } = useSession();

  // Giữ splash tới khi có font và đã biết người dùng đăng nhập hay chưa → không nháy màn đăng nhập.
  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync();
  }, [fontsReady, ready]);
  if (!fontsReady || !ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={session != null && needsPassword}>
        <Stack.Screen name="set-password" />
      </Stack.Protected>
      <Stack.Protected guard={session != null && !needsPassword}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={session == null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

function ConfigError() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View className="flex-1 justify-center gap-3 bg-bg px-7">
      <Text weight="extrabold" className="text-[22px] leading-[28px]">
        Thiếu cấu hình
      </Text>
      <Text className="text-ink-2">
        Tạo file apps/mobile/.env.local theo mẫu .env.example rồi khởi động lại Metro. Còn thiếu:
      </Text>
      {missingEnv.map((name) => (
        <Text key={name} weight="semibold">
          • {name}
        </Text>
      ))}
    </View>
  );
}
