import { useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { Screen } from '@/components/screen';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { passwordFlow } from '@/features/auth/password';
import {
  confirmationFieldError,
  passwordError,
  passwordFieldError,
} from '@/features/auth/password-flow';
import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export default function SetPassword() {
  const { completePasswordSetup } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lock = useRef(false);

  async function save() {
    if (lock.current) return;
    setPasswordTouched(true);
    setConfirmationTouched(true);
    setSubmitError(null);
    if (passwordError(password, confirmation)) return;
    lock.current = true;
    setBusy(true);
    try {
      await passwordFlow.save(password, confirmation);
      setPassword('');
      setConfirmation('');
      completePasswordSetup();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Chưa lưu được mật khẩu.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) setSubmitError('Chưa thoát được. Vui lòng thử lại.');
    lock.current = false;
    setBusy(false);
  }

  return (
    <Screen keyboard>
      <BackButton onPress={() => void cancel()} />
      <Text weight="extrabold" className="mt-6 text-[28px] leading-[36px]">
        Tạo mật khẩu
      </Text>
      <Text className="mb-6 mt-2 text-ink-2">Dùng mật khẩu này để đăng nhập Subca.</Text>
      <Input
        label="Mật khẩu mới"
        accessibilityLabel="Mật khẩu mới"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setSubmitError(null);
        }}
        onBlur={() => setPasswordTouched(true)}
        error={passwordTouched ? passwordFieldError(password) : null}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
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
      <Text className="mt-2 text-[12px] text-ink-3">6–72 ký tự, gồm chữ và số.</Text>
      <Input
        label="Nhập lại mật khẩu"
        accessibilityLabel="Nhập lại mật khẩu"
        className="mt-4"
        value={confirmation}
        onChangeText={(value) => {
          setConfirmation(value);
          setSubmitError(null);
        }}
        onBlur={() => setConfirmationTouched(true)}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        error={confirmationTouched ? confirmationFieldError(password, confirmation) : null}
      />
      {submitError ? <Text className="mt-3 text-[13px] text-coral-deep">{submitError}</Text> : null}
      <Button title="Tiếp tục" className="mt-4" loading={busy} onPress={() => void save()} />
    </Screen>
  );
}
