'use client';

import { PageHead } from '@/components/page-head';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Pill,
  Spinner,
  Stat,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { useQueueStats } from '@/features/admin/queries';
import { formatDateTime, formatNumber } from '@/lib/format';

const REMINDER_STATUS: Record<string, string> = {
  PENDING: 'Chờ gửi',
  SENT: 'Đã gửi',
  FAILED: 'Lỗi',
  CANCELLED: 'Đã hủy',
};

/** Theo dõi hàng đợi nhắc (thay cho Bull Board) và thống kê lượt nhắc 7 ngày. */
export default function QueuesPage() {
  const queue = useQueueStats();

  return (
    <>
      <PageHead crumb="Vận hành" title="Hàng đợi nhắc">
        <Button icon="refresh" loading={queue.isFetching} onClick={() => void queue.refetch()}>
          Làm mới
        </Button>
      </PageHead>

      {queue.isError ? (
        <ErrorNote error={queue.error as Error} onRetry={() => void queue.refetch()} />
      ) : queue.data ? (
        <div className="flex flex-col gap-4">
          {!queue.data.connected ? (
            <div className="rounded-(--radius-card) bg-crit-bg px-4 py-3 text-[13px] text-crit">
              Không kết nối được Redis — hàng đợi nhắc đang không chạy. Kiểm tra `REDIS_URL` và
              container Redis.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Đang chờ" value={formatNumber(queue.data.counts.waiting)} />
            <Stat label="Đang chạy" value={formatNumber(queue.data.counts.active)} tone="sky" />
            <Stat label="Hẹn giờ" value={formatNumber(queue.data.counts.delayed)} />
            <Stat label="Đã xong" value={formatNumber(queue.data.counts.completed)} tone="mint" />
            <Stat label="Lỗi" value={formatNumber(queue.data.counts.failed)} tone="peach" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Lượt nhắc 7 ngày" note="theo trạng thái trong database">
              {queue.data.reminders7d.length > 0 ? (
                <ul className="divide-y divide-line-2">
                  {queue.data.reminders7d.map((row) => (
                    <li key={row.status} className="flex justify-between px-5 py-2.5">
                      <span>{REMINDER_STATUS[row.status] ?? row.status}</span>
                      <b className="num">{formatNumber(row.count)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>Chưa có lượt nhắc nào trong 7 ngày.</EmptyState>
              )}
            </Card>

            <Card title="Job lỗi gần nhất" note="tối đa 10 job">
              {queue.data.recentFailed.length > 0 ? (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Job</Th>
                      <Th>Lượt nhắc</Th>
                      <Th align="right">Số lần thử</Th>
                      <Th>Lỗi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.data.recentFailed.map((job) => (
                      <tr key={job.id}>
                        <Td className="num">{job.id}</Td>
                        <Td className="num text-[12.5px] text-ink-3">{job.reminderId ?? '—'}</Td>
                        <Td align="right" className="num">
                          {job.attemptsMade}
                        </Td>
                        <Td>
                          <Pill tone="crit">{job.failedReason ?? 'Không rõ'}</Pill>
                          <span className="mt-1 block text-[12px] text-ink-3">
                            {formatDateTime(job.finishedAt)}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              ) : (
                <EmptyState>Không có job nào lỗi. 🎉</EmptyState>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-ink-3">
          <Spinner /> Đang tải…
        </div>
      )}
    </>
  );
}
