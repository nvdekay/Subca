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

type Step = 'email' | 'otp' | 'mfa-enroll' | 'mfa-verify';

/** Đăng nhập admin: mã OTP qua email (như app) rồi bắt buộc xác thực hai bước bằng TOTP. */
export default function LoginPage() {
  const router = useRouter();
  const { session, mfaDone, me, error: meError, signOut } = useAdminSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Đã đăng nhập đủ (OTP + MFA) và là admin → vào thẳng Tổng quan
  useEffect(() => {
    if (me) router.replace('/overview');
  }, [me, router]);

  // Có phiên nhưng chưa qua MFA → chuyển sang bước TOTP (đăng ký hoặc nhập mã)
  useEffect(() => {
    if (!session || mfaDone) return;
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
  }, [session, mfaDone]);

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (otpError) setError(otpError.message);
    else setStep('otp');
  };

  const verifyOtp = async () => {
    setBusy(true);
    setError(null);
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (otpError) setError(otpError.message);
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
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-sky">
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

        {meError ? (
          <div className="mb-4 rounded-xl bg-crit-bg px-4 py-3 text-[13px] text-crit">
            {meError.message}
            <button className="mt-2 block font-semibold underline" onClick={() => void signOut()}>
              Đăng nhập tài khoản khác
            </button>
          </div>
        ) : null}

        {step === 'email' ? (
          <>
            <p className="mb-4 text-[13.5px] text-ink-2">
              Nhập email quản trị, Subca gửi mã đăng nhập 6 số.
            </p>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@subca.app"
              error={error}
            />
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={busy}
              disabled={!email.includes('@')}
              onClick={() => void sendOtp()}
            >
              Gửi mã đăng nhập
            </Button>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
            <p className="mb-4 text-[13.5px] text-ink-2">
              Nhập mã 6 số vừa gửi tới <b>{email}</b>.
            </p>
            <Input
              label="Mã đăng nhập"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              error={error}
            />
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={busy}
              disabled={code.length !== 6}
              onClick={() => void verifyOtp()}
            >
              Đăng nhập
            </Button>
            <Button variant="ghost" className="mt-1 w-full" onClick={() => setStep('email')}>
              Đổi email
            </Button>
          </>
        ) : null}

        {step === 'mfa-enroll' && enrollment ? (
          <>
            <p className="mb-3 text-[13.5px] text-ink-2">
              Trang quản trị bắt buộc xác thực hai bước. Quét mã bằng Google Authenticator,
              1Password hoặc app tương tự, rồi nhập mã 6 số.
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
