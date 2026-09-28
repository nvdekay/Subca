'use client';

import { supabase } from '@/lib/supabase';

export interface TotpEnrollment {
  factorId: string;
  /** Ảnh QR dạng data URL (SVG) để quét bằng Google Authenticator / 1Password. */
  qrCode: string;
  /** Mã bí mật để nhập tay khi không quét được QR. */
  secret: string;
}

/** Bắt đầu đăng ký TOTP cho admin chưa có thiết bị xác thực. */
export async function enrollTotp(): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Subca Admin ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Xác minh mã 6 số: dùng cho cả lần đăng ký đầu và các lần đăng nhập sau. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw error;
}

/** Thiết bị TOTP đã xác minh của tài khoản (nếu có). */
export async function verifiedTotpFactorId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.find((f) => f.status === 'verified')?.id ?? null;
}

/** Gỡ thiết bị TOTP chưa xác minh (khi admin bỏ dở lần đăng ký trước). */
export async function cleanupUnverifiedFactors(): Promise<void> {
  const { data } = await supabase.auth.mfa.listFactors();
  for (const factor of data?.all ?? []) {
    if (factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
}
