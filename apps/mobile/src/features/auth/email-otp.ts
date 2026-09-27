import { supabase } from '@/lib/supabase';
import { OTP_COOLDOWN_S, startOtpCooldown } from './otp-cooldown';

/**
 * Gửi mã đăng nhập qua email. Chưa có tài khoản thì Supabase tự tạo (trigger tạo profile + settings).
 * Gửi xong (hoặc bị Supabase chặn vì gửi quá nhanh) thì bắt đầu đếm ngược để UI khóa nút gửi lại.
 */
export async function sendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (!error) {
    startOtpCooldown(email);
    return;
  }
  const wait = rateLimitSeconds(error.message, error.status);
  if (wait !== null) {
    startOtpCooldown(email, wait);
    throw new Error('Bạn vừa yêu cầu mã. Đợi hết thời gian đếm ngược rồi gửi lại nhé.');
  }
  throw new Error(otpErrorMessage(error.message));
}

export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error(otpErrorMessage(error.message));
}

/**
 * Supabase báo "For security purposes, you can only request this after 42 seconds." → 42.
 * Lỗi 429 khác (hết hạn mức email/giờ của project) không có số giây → chờ mặc định 60 giây.
 */
function rateLimitSeconds(message: string, status?: number): number | null {
  const match = /after (\d+) seconds?/i.exec(message);
  if (match) return Number(match[1]);
  if (status === 429 || /rate limit/i.test(message)) return OTP_COOLDOWN_S;
  return null;
}

function otpErrorMessage(message: string): string {
  if (/expired|invalid/i.test(message)) return 'Mã không đúng hoặc đã hết hạn.';
  if (/network|fetch/i.test(message)) return 'Không kết nối được. Kiểm tra mạng rồi thử lại.';
  return 'Có lỗi xảy ra, thử lại sau nhé.';
}
