'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import {
  cleanupUnverifiedFactors,
  enrollTotp,
  verifiedTotpFactorId,
  verifyTotp,
  type TotpEnrollment,
} from '@/features/auth/mfa';
import { useAdminSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

type Step = 'password' | 'mfa-enroll' | 'mfa-verify';

/**
 * Đăng nhập admin bằng email + mật khẩu; tên đăng nhập admin là bí danh cho tài khoản riêng.
 * Nếu máy chủ bật `ADMIN_REQUIRE_MFA`, API trả `MFA_REQUIRED` và trang chuyển sang bước TOTP.
 */
export default function LoginPage() {
  const router = useRouter();
  const { session, me, error: meError, signOut } = useAdminSession();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me) router.replace('/overview');
  }, [me, router]);

  // Máy chủ đòi xác thực hai bước → đăng ký hoặc nhập mã TOTP
  useEffect(() => {
    if (!session || meError?.code !== 'MFA_REQUIRED') return;
    let cancelled = false;
    void (async () => {
      try {
        const existing = await verifiedTotpFactorId();
        if (cancelled) return;
        if (existing) {
          setFactorId(existing);
          setStep('mfa-verify');
        } else {
          await cleanupUnverifiedFactors();
          const next = await enrollTotp();
          if (cancelled) return;
          setEnrollment(next);
          setFactorId(next.factorId);
          setStep('mfa-enroll');
        }
      } catch (e) {
        if (!cancelled) setError(message(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, meError]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase() === 'admin' ? 'admin-login@subca.app' : email.trim(),
      password,
    });
    setBusy(false);
    setPassword('');
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng'
          : signInError.message,
      );
    }
  };

  const submitTotp = async () => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(factorId, totpCode.trim());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      setTotpCode('');
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-[420px] p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[6px] border-2 border-ink bg-brand text-ink shadow-(--shadow-card)">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-5"
            >
              <path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
          </span>
          <div>
            <div className="text-[17px] leading-5 font-extrabold">Subca Admin</div>
            <div className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">
              Bảng quản trị
            </div>
          </div>
        </div>

        {meError && meError.code !== 'MFA_REQUIRED' ? (
          <div className="mb-4 rounded-xl bg-crit-bg px-4 py-3 text-[13px] text-crit">
            {meError.message}
            <button className="mt-2 block font-semibold underline" onClick={() => void signOut()}>
              Đăng nhập tài khoản khác
            </button>
          </div>
        ) : null}

        {step === 'password' ? (
          <>
            <p className="mb-4 text-[13.5px] text-ink-2">
              Đăng nhập bằng tên admin hoặc email quản trị. Quên mật khẩu thì nhờ một OWNER đặt lại
              ở trang Nhân sự.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void signIn();
              }}
            >
              <Input
                label="Tên đăng nhập hoặc email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin hoặc ban@subca.app"
              />
              <Input
                label="Mật khẩu"
                type="password"
                autoComplete="current-password"
                className="mt-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error}
              />
              <Button
                type="submit"
                variant="primary"
                className="mt-4 w-full"
                loading={busy}
                disabled={
                  !(email.trim().toLowerCase() === 'admin' || email.includes('@')) ||
                  password.length === 0
                }
              >
                Đăng nhập
              </Button>
            </form>
          </>
        ) : null}

        {step === 'mfa-enroll' && enrollment ? (
          <>
            <p className="mb-3 text-[13.5px] text-ink-2">
              Máy chủ đang bắt buộc xác thực hai bước. Quét mã bằng Google Authenticator, 1Password
              hoặc app tương tự, rồi nhập mã 6 số.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR là data URL do Supabase sinh */}
            <img
              src={enrollment.qrCode}
              alt="Mã QR đăng ký xác thực hai bước"
              className="mx-auto size-44 rounded-xl border border-line bg-white p-2"
            />
            <p className="num mt-2 text-center text-[12px] break-all text-ink-3">
              {enrollment.secret}
            </p>
            <Input
              label="Mã 6 số"
              inputMode="numeric"
              maxLength={6}
              className="mt-3"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              error={error}
            />
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={busy}
              disabled={totpCode.length !== 6}
              onClick={() => void submitTotp()}
            >
              Bật xác thực hai bước
            </Button>
          </>
        ) : null}

        {step === 'mfa-verify' ? (
          <>
            <p className="mb-4 text-[13.5px] text-ink-2">
              Nhập mã 6 số trong ứng dụng xác thực của bạn.
            </p>
            <Input
              label="Mã 6 số"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              error={error}
            />
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={busy}
              disabled={totpCode.length !== 6}
              onClick={() => void submitTotp()}
            >
              Xác nhận
            </Button>
            <Button variant="ghost" className="mt-1 w-full" onClick={() => void signOut()}>
              Đăng xuất
            </Button>
          </>
        ) : null}
      </Card>
    </main>
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
