import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { registerForPush } from './push';

/**
 * Dùng trong layout của phần đã đăng nhập:
 * - làm mới push token mỗi lần mở app (không hỏi quyền);
 * - bấm vào thông báo nhắc → ghi "đã mở" (API đo tỉ lệ mở) và mở màn Chi tiết subscription.
 */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    registerForPush({ ask: false });
  }, []);

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const data = response.notification.request.content.data as {
      subscriptionId?: string;
      reminderId?: string;
      groupId?: string;
    };
    if (data.reminderId) {
      api(`/reminders/${data.reminderId}/opened`, { method: 'POST' }).catch(() => undefined);
    }
    if (data.groupId) {
      router.push({ pathname: '/groups/[id]', params: { id: data.groupId } });
    } else if (data.subscriptionId) {
      router.push({ pathname: '/subscriptions/[id]', params: { id: data.subscriptionId } });
    }
  }, [response]);
}
