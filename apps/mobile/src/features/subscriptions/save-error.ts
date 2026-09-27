import { Alert } from 'react-native';
import { ApiError } from '@/lib/api';

/** Báo lỗi khi lưu; hết lượt gói Free thì nói rõ cách xử lý. */
export function alertSaveError(error: unknown) {
  if (error instanceof ApiError && error.code === 'PLAN_LIMIT_REACHED') {
    // Thông báo của server đã gợi ý nâng cấp; chỉ thêm cách làm ngay không tốn tiền.
    Alert.alert(
      'Đã đủ giới hạn gói Free',
      `${error.message.replace(/\.+$/, '')}. Hoặc lưu trữ bớt một subscription không còn dùng.`,
    );
    return;
  }
  Alert.alert(
    'Chưa lưu được',
    error instanceof Error ? error.message : 'Có lỗi xảy ra, thử lại nhé.',
  );
}
