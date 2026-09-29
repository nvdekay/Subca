'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({
  children,
  className,
  title,
  note,
  action,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-card)',
        className,
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-line-2 px-5 py-4">
          <div>
            <h3 className="font-bold">{title}</h3>
            {note ? <p className="text-[12.5px] text-ink-3">{note}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
};

const BUTTON_VARIANT = {
  primary: 'border border-brand bg-brand text-ink hover:bg-brand/90',
  default: 'border border-line bg-surface text-ink shadow-sm hover:bg-brass-soft',
  danger: 'border border-crit/30 bg-crit-bg text-crit hover:bg-crit/15',
  ghost: 'text-ink-2 hover:bg-brass-soft',
} as const;

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition duration-150 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-not-allowed disabled:opacity-55',
        size === 'md' ? 'h-10 px-4 text-[13.5px]' : 'h-8 px-3 text-[12.5px]',
        BUTTON_VARIANT[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <span
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Đang tải"
    />
  );
}

export function Input({
  label,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null }) {
  return (
    <label className={cn('block', className)}>
      {label ? (
        <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>
      ) : null}
      <input
        {...props}
        className={cn(
          'h-10 w-full rounded-[10px] border bg-surface px-3 text-[14px] outline-none transition placeholder:text-ink-3 focus:border-brass focus:ring-2 focus:ring-brass/20',
          error ? 'border-crit' : 'border-line',
        )}
      />
      {error ? <span className="mt-1 block text-[12.5px] text-crit">{error}</span> : null}
    </label>
  );
}

export type PillTone = 'good' | 'warn' | 'crit' | 'info' | 'muted';

const PILL_TONE: Record<PillTone, string> = {
  good: 'bg-good-bg text-good',
  warn: 'bg-warn-bg text-warn',
  crit: 'bg-crit-bg text-crit',
  info: 'bg-sky-soft text-sky-deep',
  muted: 'bg-line-2 text-ink-3',
};

export function Pill({
  children,
  tone = 'muted',
  icon,
}: {
  children: ReactNode;
  tone?: PillTone;
  icon?: IconName;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-current/10 px-2.5 py-1 text-[12px] font-semibold',
        PILL_TONE[tone],
      )}
    >
      {icon ? <Icon name={icon} className="size-3.5" strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

/** Ô số liệu lớn ở đầu trang (mockup: .kpi). */
export function Stat({
  label,
  value,
  note,
  tone = 'surface',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'surface' | 'mint' | 'peach' | 'sky';
}) {
  const bg = {
    surface: 'bg-surface',
    mint: 'bg-mint',
    peach: 'bg-peach',
    sky: 'bg-sky-soft',
  }[tone];
  return (
    <div className={cn('rounded-(--radius-card) border border-line p-4', bg)}>
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className="num mt-1 text-[24px] leading-8 font-extrabold tracking-tight">{value}</div>
      {note ? <div className="text-[12px] text-ink-3">{note}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-[13.5px] text-ink-3">{children}</p>;
}

export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-(--radius-card) border border-crit/25 bg-crit-bg px-4 py-3 text-[13.5px] text-crit">
      <Icon name="alert" className="size-[18px] shrink-0" />
      <span className="flex-1">{error.message}</span>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}

/** Khung bảng có thanh cuộn ngang trên màn hẹp. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13.5px]">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      className={cn(
        'border-b border-line bg-line-2/60 px-4 py-2.5 text-[12px] font-bold tracking-wide text-ink-3 uppercase',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={cn(
        'border-b border-line-2 px-4 py-3 align-middle',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Phân trang đơn giản: "1–25 trong 312" + nút trước/sau. */
export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-[12.5px] text-ink-3">
      <span className="num">
        {from}–{to} trong {total}
      </span>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Trước
        </Button>
        <Button size="sm" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          Sau
        </Button>
      </div>
    </div>
  );
}

/** Hộp thoại giữa màn (xác nhận khóa tài khoản, tặng Plus…). */
export function Modal({
  title,
  note,
  onClose,
  children,
}: {
  title: string;
  note?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-ink/35"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[460px] rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-extrabold">{title}</h2>
            {note ? <p className="mt-0.5 text-[13px] text-ink-3">{note}</p> : null}
          </div>
          <Button variant="ghost" size="sm" icon="x" onClick={onClose} aria-label="Đóng" />
        </div>
        {children}
      </div>
    </div>
  );
}
