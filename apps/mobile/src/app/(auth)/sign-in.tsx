import { router } from 'expo-router';
import { useState } from 'react';
import { z } from 'zod';
import { Screen, TopBar } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { sendEmailOtp } from '@/features/auth/email-otp';
import { useOtpCooldown } from '@/features/auth/otp-cooldown';
import { ResendCountdown } from '@/features/auth/resend-countdown';

const Email = z.email();

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const normalized = email.trim().toLowerCase();
  // Vừa gửi mã cho email này (VD quay lại từ màn nhập mã) → khóa nút tới khi hết 60 giây.
  const waitSeconds = useOtpCooldown(normalized);

  function goToVerify(value: string) {
    router.push({ pathname: '/verify', params: { email: value } });
  }

  async function submit() {
    const value = normalized;
    if (waitSeconds > 0 || sending) return;
    if (!Email.safeParse(value).success) {
      setError('Email chưa đúng định dạng');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendEmailOtp(value);
      goToVerify(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
    } finally {
      setSending(false);
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
        Đăng nhập bằng email
      </Text>
      <Text className="mb-6 mt-2 text-[14px] leading-[21px] text-ink-2">
        Subca gửi mã xác nhận vào email của bạn. Chưa có tài khoản thì mình tạo luôn, không cần mật
        khẩu.
      </Text>
      <Input
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError(null);
        }}
        placeholder="ban@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        autoFocus
        error={error}
      />
      <Button
        title="Gửi mã đăng nhập"
        className="mt-5"
        loading={sending}
        disabled={waitSeconds > 0}
        onPress={submit}
      />
      <ResendCountdown seconds={waitSeconds} />
      {waitSeconds > 0 ? (
        <Button
          title="Tôi đã có mã"
          variant="ghost"
          className="mt-1"
          onPress={() => goToVerify(normalized)}
        />
      ) : null}
      <Text className="mt-4 text-center text-[12.5px] leading-[18px] text-ink-3">
        Đăng nhập bằng Apple / Google sẽ có ở bản sau.
      </Text>
    </Screen>
  );
}
