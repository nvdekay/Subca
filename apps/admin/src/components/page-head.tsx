import type { ReactNode } from 'react';

/** Đầu trang quản trị: đường dẫn nhỏ, tiêu đề lớn và các nút bên phải. */
export function PageHead({
  crumb,
  title,
  children,
}: {
  crumb?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {crumb ? (
          <div className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
            {crumb}
          </div>
        ) : null}
        <h1 className="page-head-title text-[26px] leading-8 font-extrabold tracking-tight">
          {title}
        </h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
