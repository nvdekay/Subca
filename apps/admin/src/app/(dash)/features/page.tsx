'use client';

import { PageHead } from '@/components/page-head';
import { Card, EmptyState, ErrorNote, Pill, Spinner, Button } from '@/components/ui';
import { useFeatures, useSetFeatureFlag } from '@/features/admin/queries';
import { useAdminSession } from '@/features/auth/session';
import { formatDateTime, formatNumber } from '@/lib/format';

/** Sử dụng tính năng: bao nhiêu người dùng đã dùng gì, và bật/tắt feature flag. */
export default function FeaturesPage() {
  const { can } = useAdminSession();
  const features = useFeatures();
  const setFlag = useSetFeatureFlag();

  return (
    <>
      <PageHead crumb="Sản phẩm" title="Sử dụng tính năng">
        <Button
          icon="refresh"
          loading={features.isFetching}
          onClick={() => void features.refetch()}
        >
          Làm mới
        </Button>
      </PageHead>

      {features.isError ? (
        <ErrorNote error={features.error as Error} onRetry={() => void features.refetch()} />
      ) : features.data ? (
        <div className="flex flex-col gap-4">
          <Card
            title="Tỷ lệ dùng tính năng"
            note={`Trên tổng ${formatNumber(features.data.totalUsers)} người dùng`}
          >
            <ul className="divide-y divide-line-2">
              {features.data.usage.map((row) => (
                <li key={row.key} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">
                      {row.label}
                      {row.note ? (
                        <span className="ml-2 text-[12px] font-normal text-ink-3">{row.note}</span>
                      ) : null}
                    </span>
                    <span className="num text-[13.5px] text-ink-3">
                      <b className="text-ink">{formatNumber(row.users)}</b> · {row.percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line-2">
                    <div
                      className="h-full rounded-full bg-sky-deep"
                      style={{ width: `${Math.max(row.percent, row.users > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Feature flag" note="Bật/tắt tính năng cho toàn bộ app">
            {features.data.flags.length > 0 ? (
              <ul className="divide-y divide-line-2">
                {features.data.flags.map((flag) => (
                  <li
                    key={flag.key}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div>
                      <div className="num font-semibold">{flag.key}</div>
                      <div className="text-[12.5px] text-ink-3">
                        {flag.description ?? 'Chưa có mô tả'}
                      </div>
                      <div className="text-[12px] text-ink-3">
                        Sửa lần cuối {formatDateTime(flag.updatedAt)}
                        {flag.updatedBy ? ` · ${flag.updatedBy}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Pill tone={flag.enabled ? 'good' : 'muted'}>
                        {flag.enabled ? 'Đang bật' : 'Đang tắt'}
                      </Pill>
                      {can('manageFlags') ? (
                        <Button
                          size="sm"
                          loading={setFlag.isPending}
                          onClick={() =>
                            setFlag.mutate({ key: flag.key, input: { enabled: !flag.enabled } })
                          }
                        >
                          {flag.enabled ? 'Tắt' : 'Bật'}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Chưa có feature flag nào.</EmptyState>
            )}
            {setFlag.isError ? (
              <p className="px-5 pb-4 text-[13px] text-crit">{(setFlag.error as Error).message}</p>
            ) : null}
          </Card>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-ink-3">
          <Spinner /> Đang tải…
        </div>
      )}
    </>
  );
}
