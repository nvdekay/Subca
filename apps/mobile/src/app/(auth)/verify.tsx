import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { Screen, TopBar } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { sendEmailOtp, verifyEmailOtp } from '@/features/auth/email-otp';
import { useOtpCooldown } from '@/features/auth/otp-cooldown';
import { ResendCountdown } from '@/features/auth/resend-countdown';

/** Phải khớp "Email OTP Length" trong Supabase (Authentication → Providers → Email). */
const CODE_LENGTH = 6;

export default function Verify() {
  const params = useLocalSearchParams<{ email?: string; purpose?: string }>();
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const purpose = params.purpose === 'signup' ? 'signup' : 'recovery';
  const validEmail = z.email().safeParse(email).success;
  const lock = useRef(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const resendIn = useOtpCooldown(email);

  async function submit(value = code) {
    if (value.length !== CODE_LENGTH || lock.current || !validEmail) return;
    lock.current = true;
    setError(null);
    setVerifying(true);
    try {
      // Phiên đã xác minh → _layout chỉ cho mở bước tạo mật khẩu, chưa vào app.
      await verifyEmailOtp(email, value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
      setVerifying(false);
    } finally {
      lock.current = false;
    }
  }

  async function resend() {
    if (lock.current || resendIn > 0 || !validEmail) return;
    lock.current = true;
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await sendEmailOtp(email, purpose);
      setNotice(
        purpose === 'signup'
          ? 'Đã gửi mã mới.'
          : 'Nếu email có tài khoản, bạn sẽ nhận được mã mới.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
    } finally {
      setResending(false);
      lock.current = false;
    }
  }

  return (
    <Screen keyboard>
      <TopBar />
      <Text
        weight="extrabold"
        className="text-[26px] leading-[32px]"
        style={{ letterSpacing: -0.65 }}
      >
        Nhập mã 6 số
      </Text>
      <Text className="mb-6 mt-2 text-[14px] leading-[21px] text-ink-2">
        {purpose === 'signup'
          ? 'Mã đăng ký được gửi tới '
          : 'Nếu có tài khoản, mã xác minh sẽ được gửi tới '}
        <Text weight="semibold" className="text-[14px] text-ink">
          {email}
        </Text>
        . Kiểm tra cả mục Spam nếu chưa thấy. Sau xác minh, bạn sẽ tạo mật khẩu Subca.
      </Text>
      <Input
        label="Mã xác nhận"
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
          setCode(digits);
          if (error) setError(null);
          // Nhập (hoặc dán / tự điền) đủ 6 số thì xác nhận luôn, khỏi phải bấm nút.
          if (digits.length === CODE_LENGTH) submit(digits);
        }}
        placeholder="••••••"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        autoFocus
        editable={!verifying && !resending && validEmail}
        error={validEmail ? error : 'Thiếu email hợp lệ. Quay lại màn đăng nhập để bắt đầu.'}
        style={{ letterSpacing: 6, fontSize: 20 }}
      />
      {notice ? <Text className="ml-1 mt-2 text-[13px] text-on-mint">{notice}</Text> : null}
      <Button
        title="Xác nhận"
        className="mt-5"
        loading={verifying}
        disabled={code.length !== CODE_LENGTH || resending || !validEmail}
        onPress={() => submit()}
      />
      <ResendCountdown seconds={resendIn} />
      <Button
        title="Gửi lại mã"
        variant="ghost"
        className="mt-1"
        loading={resending}
        disabled={resendIn > 0 || verifying || !validEmail}
        onPress={resend}
      />
    </Screen>
  );
}
