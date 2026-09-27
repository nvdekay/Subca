import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { env } from './env';
import { supabaseStorage } from './storage';

/**
 * Supabase chỉ dùng cho đăng nhập (Auth). Dữ liệu luôn đi qua API NestJS, không đọc bảng trực tiếp.
 * Thiếu cấu hình thì dùng URL giữ chỗ để không crash lúc import; _layout hiện màn báo thiếu biến môi trường.
 */
export const supabase = createClient(
  env.supabaseUrl || 'https://missing-config.supabase.co',
  env.supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Chỉ tự làm mới token khi app đang mở: ở nền, timer JS có thể bị treo và làm mới lỗi.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
