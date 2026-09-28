'use client';

import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase Auth cho Admin Console. Phiên lưu trong localStorage của trình duyệt admin;
 * mọi truy cập dữ liệu đi qua API NestJS (anon key không đọc thẳng được DB vì RLS).
 */
export const supabase = createClient(
  // Chưa cấu hình thì vẫn tạo client với giá trị giả để build không vỡ; giao diện chặn trước khi gọi
  env.supabaseUrl || 'https://chua-cau-hinh.supabase.co',
  env.supabaseAnonKey || 'chua-cau-hinh',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  },
);
