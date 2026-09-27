import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from './api';
import { cacheStorage } from './storage';

/** Giữ cache trên máy tối đa 1 ngày; mở app là hiện dữ liệu lần trước rồi mới làm mới. */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // gcTime phải ≥ thời gian giữ cache trên máy, nếu không dữ liệu bị dọn trước khi kịp lưu.
      gcTime: CACHE_MAX_AGE,
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

/** Lưu cache TanStack Query vào MMKV mã hóa (đồng bộ, nhanh hơn AsyncStorage). */
export const queryPersister = createSyncStoragePersister({
  storage: {
    getItem: (k) => cacheStorage.getString(k) ?? null,
    setItem: (k, v) => cacheStorage.set(k, v),
    removeItem: (k) => {
      cacheStorage.remove(k);
    },
  },
  // Gộp nhiều lần ghi liên tiếp thành một (mặc định 1 giây).
  throttleTime: 1000,
});
