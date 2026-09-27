import { useEffect, useState } from 'react';

/** Supabase chỉ cho gửi lại mã cho cùng một email sau 60 giây (mặc định). */
export const OTP_COOLDOWN_S = 60;

/**
 * Mốc được gửi lại theo từng email. Để ở cấp module (không theo màn) để quay lại màn nhập email
 * vẫn thấy đúng thời gian còn lại, thay vì cho bấm gửi rồi mới báo lỗi.
 */
const nextAllowedAt = new Map<string, number>();
const listeners = new Set<() => void>();

export function startOtpCooldown(email: string, seconds = OTP_COOLDOWN_S): void {
  nextAllowedAt.set(email, Date.now() + seconds * 1000);
  listeners.forEach((notify) => notify());
}

function remaining(email: string): number {
  const until = nextAllowedAt.get(email);
  return until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
}

/** Số giây còn phải chờ trước khi gửi lại mã cho `email`; tự đếm lùi mỗi giây. */
export function useOtpCooldown(email: string): number {
  const [seconds, setSeconds] = useState(() => remaining(email));

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const left = remaining(email);
      setSeconds(left);
      if (left === 0 && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    const restart = () => {
      tick();
      if (!timer && remaining(email) > 0) timer = setInterval(tick, 1000);
    };
    restart();
    listeners.add(restart);
    return () => {
      listeners.delete(restart);
      if (timer) clearInterval(timer);
    };
  }, [email]);

  return seconds;
}

/** 45 → "0:45", 60 → "1:00". */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
