import { useRef, useState } from 'react';
import { Screen } from '@/components/screen';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { passwordFlow } from '@/features/auth/password';
import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

export default function SetPassword() {
  const { session, completePasswordSetup } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await passwordFlow.save(password, confirmation);
      setPassword('');
      setConfirmation('');
      completePasswordSetup();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được mật khẩu.');
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
    if (signOutError) setError('Chưa thoát được. Vui lòng thử lại.');
    lock.current = false;
    setBusy(false);
  }

  return (
    <Screen keyboard>
      <BackButton onPress={() => void cancel()} />
      <Text weight="extrabold" className="mt-6 text-[28px] leading-[36px]">
        Tạo mật khẩu của bạn
      </Text>
      <Text className="mb-6 mt-2 text-ink-2">
        Đã xác minh {session?.user.email}. Từ lần sau, bạn chỉ cần email và mật khẩu Subca, không
        cần chờ OTP.
      </Text>
      <Input
        label="Mật khẩu mới"
        accessibilityLabel="Mật khẩu mới"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
      />
      <Text className="mt-2 text-[12px] text-ink-3">
        8–72 ký tự, có chữ và số. Không dùng mật khẩu Gmail của bạn.
      </Text>
      <Input
        label="Nhập lại mật khẩu"
        accessibilityLabel="Nhập lại mật khẩu"
        className="mt-4"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        error={error}
      />
      <Button
        title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        variant="ghost"
        onPress={() => setVisible((value) => !value)}
      />
      <Button
        title="Lưu mật khẩu và tiếp tục"
        className="mt-4"
        loading={busy}
        onPress={() => void save()}
      />
      <Text className="mt-4 text-center text-[12px] text-ink-3">
        Quay lại sẽ thoát phiên xác minh này.
      </Text>
    </Screen>
  );
}
