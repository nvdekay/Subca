import type { RegisterPushToken } from '@subca/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { api } from '@/lib/api';
import { secureStorage } from '@/lib/storage';

const TOKEN_KEY = 'push.token';
const ANDROID_CHANNEL = 'reminders';

// Đang mở app vẫn hiện banner nhắc gia hạn (mặc định iOS ẩn thông báo khi app ở foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Hỏi bằng hộp thoại của Subca trước; iOS chỉ cho hiện hộp thoại hệ thống MỘT lần nên đừng phí. */
function askPolitely(): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      'Bật thông báo nhắc gia hạn?',
      'Subca sẽ nhắc bạn trước ngày bị trừ tiền và trước khi hết dùng thử, để kịp hủy nếu không dùng nữa.',
      [
        { text: 'Để sau', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Bật thông báo', onPress: () => resolve(true) },
      ],
    ),
  );
}

/**
 * Lấy Expo push token rồi đăng ký với API.
 * - `ask: false` (mỗi lần mở app): chỉ làm mới token nếu người dùng đã cho phép, không hỏi.
 * - `ask: true` (sau khi thêm subscription đầu tiên): hỏi quyền nếu chưa từng hỏi.
 * Lỗi không làm hỏng luồng chính: thông báo là tính năng phụ trợ.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Nhắc gia hạn',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      if (!ask || !canAskAgain || !(await askPolitely())) return;
      ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted') return;
    }
    const id = projectId();
    if (!id) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });

    const body: RegisterPushToken = {
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      deviceName: Device.deviceName ?? null,
      appVersion: Constants.expoConfig?.version ?? null,
    };
    // Gửi mỗi lần mở app: API upsert theo token nên rẻ, và chuyển token sang tài khoản mới nếu máy đổi người dùng.
    await api('/push-tokens', { method: 'POST', body: JSON.stringify(body) });
    secureStorage.set(TOKEN_KEY, token);
  } catch (error) {
    console.warn('Không đăng ký được push token', error);
  }
}

/** Gọi TRƯỚC khi đăng xuất (lúc còn token đăng nhập) để máy này thôi nhận nhắc của tài khoản cũ. */
export async function unregisterPush(): Promise<void> {
  const token = secureStorage.getString(TOKEN_KEY);
  if (!token) return;
  try {
    await api('/push-tokens', { method: 'DELETE', body: JSON.stringify({ token }) });
  } catch (error) {
    console.warn('Không gỡ được push token', error);
  } finally {
    secureStorage.remove(TOKEN_KEY);
  }
}
