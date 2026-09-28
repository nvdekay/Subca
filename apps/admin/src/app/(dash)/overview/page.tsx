'use client';

import type { AdminOverviewDto } from '@subca/shared';
import { Icon } from '@/components/icons';
import { PageHead } from '@/components/page-head';
import { Button, Card, EmptyState, ErrorNote, Spinner, Stat } from '@/components/ui';
import { useOverview } from '@/features/admin/queries';
import { formatNumber, formatShortAmount } from '@/lib/format';

export default function OverviewPage() {
  const overview = useOverview();

  return (
    <>
      <PageHead crumb="Tổng quan" title="Tình hình Subca hôm nay">
        <Button
          icon="refresh"
          onClick={() => void overview.refetch()}
          loading={overview.isFetching}
        >
          Làm mới
        </Button>
      </PageHead>

      {overview.isError ? (
        <ErrorNote error={overview.error as Error} onRetry={() => void overview.refetch()} />
      ) : overview.data ? (
        <Content data={overview.data} />
      ) : (
        <div className="flex items-center gap-2 text-ink-3">
          <Spinner /> Đang tải số liệu…
        </div>
      )}
    </>
  );
}

function Content({ data }: { data: AdminOverviewDto }) {
  const maxSignup = Math.max(1, ...data.signups.map((s) => s.count));
  return (
    <div className="flex flex-col gap-4">
      {data.missingRates.length > 0 ? (
        <div className="flex items-center gap-2 rounded-(--radius-card) bg-warn-bg px-4 py-3 text-[13px] text-warn">
          <Icon name="alert" className="size-4" />
          Thiếu tỷ giá {data.missingRates.join(', ')} nên các khoản này chưa cộng vào tổng.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Người dùng"
          value={formatNumber(data.users.total)}
          note={`+${formatNumber(data.users.new30d)} trong 30 ngày`}
        />
        <Stat
          label="Hoạt động 7 ngày"
          value={formatNumber(data.users.active7d)}
          note={`${formatNumber(data.users.banned)} tài khoản bị khóa`}
          tone="sky"
        />
        <Stat
          label="Đang dùng Plus"
          value={formatNumber(data.users.plus)}
          note={
            data.users.total > 0
              ? `${Math.round((data.users.plus / data.users.total) * 100)}% người dùng`
              : undefined
          }
          tone="mint"
        />
        <Stat
          label="Tiền người dùng đang theo dõi"
          value={formatShortAmount(data.subscriptions.trackedMonthlyMinor)}
          note="mỗi tháng, đã quy đổi VND"
          tone="peach"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Đăng ký mới" note="30 ngày gần nhất" className="xl:col-span-2">
          <div className="flex h-[180px] items-end gap-[3px] px-5 py-4">
            {data.signups.map((day) => (
              <div
                key={day.date}
                className="flex-1 rounded-t bg-sky-deep/85 transition hover:bg-sky-deep"
                style={{ height: `${Math.max(2, (day.count / maxSignup) * 100)}%` }}
                title={`${day.date}: ${day.count} người`}
              />
            ))}
          </div>
          <div className="flex justify-between border-t border-line-2 px-5 py-2.5 text-[12px] text-ink-3">
            <span>{data.signups[0]?.date}</span>
            <span className="num">
              Cao nhất {maxSignup} người/ngày · tổng {formatNumber(data.users.new30d)}
            </span>
            <span>{data.signups.at(-1)?.date}</span>
          </div>
        </Card>

        <Card title="Nhắc nhở" note="7 ngày gần nhất">
          <dl className="divide-y divide-line-2">
            <Row label="Đã gửi" value={formatNumber(data.reminders.sent7d)} />
            <Row label="Tỷ lệ mở" value={`${data.reminders.openRate7d}%`} />
            <Row label="Gửi lỗi" value={formatNumber(data.reminders.failed7d)} />
            <Row label="Đang chờ trong hàng đợi" value={formatNumber(data.reminders.pending)} />
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Subscription" note="toàn hệ thống">
          <dl className="divide-y divide-line-2">
            <Row label="Đang theo dõi" value={formatNumber(data.subscriptions.tracked)} />
            <Row label="Đang dùng thử" value={formatNumber(data.subscriptions.trial)} />
            <Row label="Đã hủy 30 ngày" value={formatNumber(data.subscriptions.cancelled30d)} />
            <Row
              label="Tiết kiệm nhờ hủy (mỗi tháng)"
              value={formatShortAmount(data.subscriptions.savedMonthlyMinor)}
            />
          </dl>
        </Card>

        <Card title="Chia tiền nhóm" note="nhóm đang hoạt động">
          <dl className="divide-y divide-line-2">
            <Row label="Số nhóm" value={formatNumber(data.groups.total)} />
            <Row label="Thành viên đã tham gia" value={formatNumber(data.groups.members)} />
          </dl>
        </Card>

        <Card title="Dịch vụ được theo dõi nhiều nhất">
          {data.topServices.length > 0 ? (
            <ul className="divide-y divide-line-2">
              {data.topServices.map((item) => (
                <li
                  key={item.service?.id ?? item.name}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: item.service?.brandColor ?? 'var(--color-sage)' }}
                    />
                    {item.name}
                  </span>
                  <b className="num">{formatNumber(item.count)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Chưa có dữ liệu.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <dt className="text-[13.5px] text-ink-2">{label}</dt>
      <dd className="num font-bold">{value}</dd>
    </div>
  );
}
