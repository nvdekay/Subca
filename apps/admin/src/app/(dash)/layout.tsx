'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { Spinner } from '@/components/ui';
import { useAdminSession } from '@/features/auth/session';

const NAV: { group: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  { group: 'Tổng quan', items: [{ href: '/overview', label: 'Tổng quan', icon: 'grid' }] },
  { group: 'Người dùng', items: [{ href: '/users', label: 'Người dùng', icon: 'users' }] },
  {
    group: 'Sản phẩm',
    items: [
      { href: '/catalog', label: 'Thư viện dịch vụ', icon: 'layers' },
      { href: '/features', label: 'Sử dụng tính năng', icon: 'grid' },
    ],
  },
  {
    group: 'Quản trị',
    items: [{ href: '/team', label: 'Nhân sự & phân quyền', icon: 'shield' }],
  },
  {
    group: 'Vận hành',
    items: [
      { href: '/system', label: 'Sức khỏe hệ thống', icon: 'server' },
      { href: '/queues', label: 'Hàng đợi nhắc', icon: 'refresh' },
      { href: '/audit', label: 'Nhật ký hoạt động', icon: 'list' },
    ],
  },
];

/** Khung các trang quản trị: chặn người chưa đăng nhập / chưa qua MFA / không phải admin. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, session, me, error, signOut } = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!session || error) router.replace('/login');
  }, [loading, session, error, router]);

  if (loading || !me) {
    return (
      <div className="flex min-h-full items-center justify-center gap-3 text-ink-3">
        <Spinner className="size-5" />
        Đang tải bảng quản trị…
      </div>
    );
  }

  return (
    <div className="grid min-h-full lg:h-dvh lg:min-h-0 lg:grid-cols-[248px_1fr] lg:overflow-hidden">
      <aside className="hidden h-full flex-col overflow-y-auto border-r-2 border-line bg-surface px-3.5 py-4 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          <span className="grid size-8.5 place-items-center rounded-[6px] border-2 border-ink bg-brand text-ink shadow-(--shadow-card)">
            <Icon name="refresh" className="size-4.5" strokeWidth={2} />
          </span>
          <div>
            <div className="font-sans text-[19px] leading-5 font-extrabold tracking-tight">
              Subca
            </div>
            <div className="-mt-0.5 text-[10.5px] font-semibold tracking-wider text-ink-3 uppercase">
              Admin Console
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="px-2.5 pt-3.5 pb-1.5 text-[11px] font-bold tracking-widest text-ink-3 uppercase">
                {section.group}
              </div>
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-[6px] border-2 px-2.5 py-2 font-medium transition duration-150 ${
                      active
                        ? 'border-ink bg-sky font-bold text-ink shadow-(--shadow-card)'
                        : 'border-transparent text-ink-2 hover:border-line hover:bg-peach/50'
                    }`}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t-2 border-line pt-3">
          <div className="px-2 text-[12.5px] font-semibold">{me.name}</div>
          <div className="px-2 text-[11.5px] text-ink-3">
            {me.email} · {me.role}
          </div>
          <button
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px] font-medium text-ink-2 transition hover:bg-peach"
          >
            <Icon name="logout" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col lg:min-h-0">
        <header className="flex items-center justify-between gap-3 border-b-2 border-line bg-surface px-5 py-3 lg:hidden">
          <span className="font-sans text-[17px] font-extrabold">Subca Admin</span>
          <button onClick={() => void signOut()} className="text-[13px] text-ink-2">
            Đăng xuất
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b-2 border-line bg-surface px-3 py-2 lg:hidden">
          {NAV.flatMap((s) => s.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[6px] border-2 px-3 py-1.5 text-[13px] whitespace-nowrap transition ${
                pathname.startsWith(item.href)
                  ? 'border-ink bg-sky font-bold text-ink'
                  : 'border-transparent text-ink-2'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-5 lg:min-h-0 lg:overflow-y-auto lg:p-6">{children}</main>
      </div>
    </div>
  );
}
