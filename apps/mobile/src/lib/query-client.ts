import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Lỗi 4xx (sai quyền, không tồn tại…) gọi lại cũng vô ích; chỉ thử lại lỗi mạng / 5xx.
      retry: (failureCount, error) =>
        failureCount < 2 && !(error instanceof ApiError && error.status < 500),
    },
  },
});

// React Native không có sự kiện focus của cửa sổ: coi "app trở lại foreground" là focus để làm mới dữ liệu.
AppState.addEventListener('change', (state) => {
  if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
});
