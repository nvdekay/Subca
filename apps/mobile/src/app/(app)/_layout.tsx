import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      <Stack.Screen name="subscriptions/edit/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
