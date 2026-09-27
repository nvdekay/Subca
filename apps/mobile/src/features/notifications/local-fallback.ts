import type { RemindersDto } from '@subca/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

const PREFIX = 'subca-local-';
/** iOS chỉ giữ tối đa 64 thông báo chờ; chừa chỗ cho thông báo khác. */
const MAX_SCHEDULED = 50;

async function cancelOurs(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Dự phòng khi không có push từ server (máy không lấy được push token: chưa có tài khoản Apple,
 * simulator, lỗi mạng lúc đăng ký…): tự lên lịch các lượt nhắc 30 ngày tới ngay trên máy.
 * Chỉ bật khi KHÔNG có push token để tránh nhận hai thông báo trùng cho cùng một lượt.
 * Dữ liệu lấy từ `GET /reminders` (cùng planner với server) nên nội dung giống hệt push.
 */
export async function syncLocalFallback(hasPushToken: boolean): Promise<void> {
  try {
    await cancelOurs();
    if (hasPushToken) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const { upcoming, notificationsEnabled } = await api<RemindersDto>('/reminders');
    if (!notificationsEnabled) return;
    const now = Date.now();
    for (const r of upcoming.filter((u) => Date.parse(u.at) > now).slice(0, MAX_SCHEDULED)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${r.subscriptionId}-${r.kind}-${r.offsetDays}-${r.dueDate}`,
        content: {
          title: r.title,
          body: r.body,
          // Cùng dạng dữ liệu với push server → bấm vào vẫn mở màn Chi tiết.
          data: { subscriptionId: r.subscriptionId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(r.at),
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
      });
    }
  } catch (error) {
    console.warn('Không lên lịch được thông báo cục bộ', error);
  }
}
