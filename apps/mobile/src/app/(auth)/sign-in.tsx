import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { z } from 'zod';
import { Screen, TopBar } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { sendEmailOtp } from '@/features/auth/email-otp';
import { useOtpCooldown } from '@/features/auth/otp-cooldown';
import { ResendCountdown } from '@/features/auth/resend-countdown';
import { passwordFlow } from '@/features/auth/password';
import { colors } from '@/theme';

type Mode = 'signin' | 'signup' | 'recovery';
const Email = z.email();

export default function SignIn() {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const normalized = email.trim().toLowerCase();
  const waitSeconds = useOtpCooldown(normalized);

  function changeMode(value: Mode) {
    if (lock.current) return;
    setMode(value);
    setError(null);
    setPassword('');
    setVisible(false);
  }

  function goToVerify() {
    router.push({
      pathname: '/verify',
      params: { email: normalized, purpose: mode === 'signup' ? 'signup' : 'recovery' },
    });
  }

  async function submit() {
    if (lock.current || (mode !== 'signin' && waitSeconds > 0)) return;
    if (!Email.safeParse(normalized).success) {
      setError('Email chưa đúng định dạng.');
      return;
    }
    if (mode === 'signin' && !password) {
      setError('Bạn chưa nhập mật khẩu.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await passwordFlow.signIn(normalized, password);
        setPassword('');
      } else {
        await sendEmailOtp(normalized, mode);
        goToVerify();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen keyboard>
      <TopBar />
      <Segmented
        options={[
          { value: 'signin', label: 'Đăng nhập' },
          { value: 'signup', label: 'Đăng ký' },
        ]}
        value={mode === 'recovery' ? 'signin' : mode}
        onChange={changeMode}
      />
      <Animated.View
        key={mode}
        entering={reducedMotion ? undefined : FadeInDown.duration(240)}
        exiting={reducedMotion ? undefined : FadeOutUp.duration(140)}
      >
        <Text weight="extrabold" className="mt-6 text-[28px] leading-[36px]">
          {mode === 'signin'
            ? 'Chào bạn trở lại.'
            : mode === 'signup'
              ? 'Bắt đầu cùng Subca.'
              : 'Lấy lại quyền truy cập'}
        </Text>
        <Text className="mb-6 mt-2 text-[14px] leading-[22px] text-ink-2">
          {mode === 'signin'
            ? 'Đăng nhập bằng email và mật khẩu Subca. Không cần chờ mã OTP.'
            : mode === 'signup'
              ? 'Xác minh email bằng OTP một lần, rồi tạo mật khẩu để đăng nhập những lần sau.'
              : 'Quên mật khẩu hoặc trước đây chỉ dùng OTP? Xác minh email để tạo mật khẩu mới.'}
        </Text>
        <Input
          label="Email"
          accessibilityLabel="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          placeholder="ban@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          returnKeyType={mode === 'signin' ? 'next' : 'send'}
          onSubmitEditing={mode === 'signin' ? undefined : () => void submit()}
        />
        {mode === 'signin' ? (
          <>
            <Input
              label="Mật khẩu Subca"
              accessibilityLabel="Mật khẩu Subca"
              className="mt-4"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  disabled={busy}
                  hitSlop={8}
                  className="h-11 w-11 items-center justify-center rounded-sm active:opacity-60"
                  onPress={() => setVisible((value) => !value)}
                >
                  <Icon
                    name={visible ? 'eye-off' : 'eye'}
                    size={21}
                    color={colors['ink-3']}
                    strokeWidth={1.8}
                  />
                </Pressable>
              }
            />
          </>
        ) : null}
        {error ? (
          <Text accessibilityLiveRegion="polite" className="mt-3 text-[13px] text-coral-deep">
            {error}
          </Text>
        ) : null}
        <Button
          title={
            mode === 'signin'
              ? 'Đăng nhập'
              : mode === 'signup'
                ? 'Gửi mã đăng ký'
                : 'Gửi mã xác minh'
          }
          className="mt-5"
          loading={busy}
          disabled={mode !== 'signin' && waitSeconds > 0}
          onPress={() => void submit()}
        />
        {mode === 'signin' ? (
          <Button
            title="Tạo hoặc đặt lại mật khẩu"
            variant="ghost"
            className="mt-2"
            disabled={busy}
            onPress={() => changeMode('recovery')}
          />
        ) : (
          <>
            <ResendCountdown seconds={waitSeconds} />
            {waitSeconds > 0 ? (
              <Button title="Tôi đã có mã" variant="ghost" disabled={busy} onPress={goToVerify} />
            ) : null}
            <Text className="mt-4 text-center text-[12px] leading-[18px] text-ink-3">
              {mode === 'recovery'
                ? 'Nếu email có tài khoản, bạn sẽ nhận mã xác minh. Không tạo tài khoản mới trong bước này.'
                : 'Mật khẩu sẽ được tạo sau khi email được xác minh.'}
            </Text>
          </>
        )}
      </Animated.View>
    </Screen>
  );
}
