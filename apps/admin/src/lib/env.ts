/**
 * Biến môi trường công khai (chỉ anon key, không bao giờ để service_role key ở đây).
 *
 * Không ném lỗi khi thiếu: `next build` chạy cả lúc chưa có `.env.local` (VD trên CI) và
 * sẽ vỡ ở bước prerender. Thiếu cấu hình thì `configured = false`, giao diện hiện hướng dẫn.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
  configured: Boolean(supabaseUrl && supabaseAnonKey),
};
