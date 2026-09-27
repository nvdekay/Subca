/** Cấu hình công khai nhúng vào bundle lúc build (biến EXPO_PUBLIC_*, xem .env.example). */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
};

/** Tên các biến còn thiếu; app hiện màn báo lỗi cấu hình thay vì crash khó hiểu. */
export const missingEnv = [
  !env.supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
  !env.supabaseAnonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
].filter((name): name is string => Boolean(name));
