import type { SupabaseClient } from '@supabase/supabase-js';

const PENDING_KEY = 'subca.auth.password-setup';
type Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function passwordFieldError(password: string): string | null {
  if (!password) return 'Nhập mật khẩu.';
  if (password.length < 6) return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (password.length > 72) return 'Mật khẩu không được dài quá 72 ký tự.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Mật khẩu cần có cả chữ và số.';
  return null;
}

export function confirmationFieldError(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Nhập lại mật khẩu.';
  if (password !== confirmation) return 'Hai mật khẩu chưa khớp nhau.';
  return null;
}

export function passwordError(password: string, confirmation: string): string | null {
  return passwordFieldError(password) ?? confirmationFieldError(password, confirmation);
}

/** Chỉ lưu ý định tạo mật khẩu, tuyệt đối không lưu mật khẩu. Đây là cổng UX, không phải quyền API. */
export function createPasswordFlow(auth: SupabaseClient['auth'], storage: Storage) {
  return {
    pending(email: string | undefined) {
      return Boolean(email && storage.getItem(PENDING_KEY) === email.trim().toLowerCase());
    },
    clear() {
      storage.removeItem(PENDING_KEY);
    },
    async verify(email: string, token: string) {
      // Ghi trước verifyOtp: SIGNED_IN được phát trước khi Promise hoàn tất.
      storage.setItem(PENDING_KEY, email.trim().toLowerCase());
      try {
        const { error } = await auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw error;
      } catch (error) {
        storage.removeItem(PENDING_KEY);
        throw error;
      }
    },
    async signIn(email: string, password: string) {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) {
        if (error.status === 429)
          throw new Error('Bạn thử quá nhiều lần. Vui lòng đợi rồi đăng nhập lại.');
        if (error.code === 'email_not_confirmed')
          throw new Error('Email chưa được xác minh. Chọn đăng ký để nhận mã xác nhận.');
        if (/network|fetch/i.test(error.message))
          throw new Error('Không kết nối được. Kiểm tra mạng rồi thử lại.');
        throw new Error(
          'Email hoặc mật khẩu chưa đúng. Nếu trước đây bạn chỉ dùng OTP, hãy chọn “Tạo hoặc đặt lại mật khẩu”.',
        );
      }
    },
    async save(password: string, confirmation: string) {
      const invalid = passwordError(password, confirmation);
      if (invalid) throw new Error(invalid);
      const { error } = await auth.updateUser({ password });
      if (error) {
        if (error.code === 'weak_password')
          throw new Error(
            'Mật khẩu chưa đủ mạnh. Hãy dùng mật khẩu dài hơn, có chữ, số và ký tự đặc biệt.',
          );
        if (error.code === 'same_password')
          throw new Error(
            'Mật khẩu này đang được dùng. Hãy chọn mật khẩu khác hoặc quay lại đăng nhập.',
          );
        throw new Error(
          'Chưa lưu được mật khẩu. Thử lại; nếu phiên đã hết hạn, quay lại xác minh email.',
        );
      }
      storage.removeItem(PENDING_KEY);
    },
  };
}
