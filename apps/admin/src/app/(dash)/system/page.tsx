'use client';

import type { AdminHealthCheckDto } from '@subca/shared';
import { PageHead } from '@/components/page-head';
import { Button, Card, ErrorNote, Pill, Spinner, type PillTone } from '@/components/ui';
import { useSystem } from '@/features/admin/queries';

const STATUS: Record<AdminHealthCheckDto['status'], { tone: PillTone; label: string }> = {
  ok: { tone: 'good', label: 'Bình thường' },
  warn: { tone: 'warn', label: 'Cần xem' },
  down: { tone: 'crit', label: 'Hỏng' },
};

/** Sức khỏe hệ thống: database, Redis, bộ lập lịch nhắc, tỷ giá, thông báo đẩy. */
export default function SystemPage() {
  const system = useSystem();

  return (
    <>
      <PageHead crumb="Vận hành" title="Sức khỏe hệ thống">
        <Button icon="refresh" loading={system.isFetching} onClick={() => void system.refetch()}>
          Kiểm tra lại
        </Button>
      </PageHead>

      {system.isError ? (
        <ErrorNote error={system.error as Error} onRetry={() => void system.refetch()} />
      ) : system.data ? (
        <div className="flex flex-col gap-4">
          <Card title="Thành phần" note="Kiểm tra trực tiếp mỗi lần mở trang">
            <ul className="divide-y divide-line-2">
              {system.data.checks.map((check) => (
                <li
                  key={check.key}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <div className="font-semibold">{check.label}</div>
                    <div className="text-[12.5px] text-ink-3">{check.detail}</div>
                  </div>
                  <Pill tone={STATUS[check.status].tone}>{STATUS[check.status].label}</Pill>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Máy chủ API" note="Cấu hình đang chạy">
            <dl className="divide-y divide-line-2">
              <Row label="Môi trường" value={system.data.api.env} />
              <Row label="Đã chạy" value={uptime(system.data.api.uptimeSeconds)} />
              <Row
                label="Bộ lập lịch nhắc"
                value={system.data.api.remindersEnabled ? 'Đang bật' : 'Đang tắt'}
              />
              <Row
                label="Job cập nhật tỷ giá"
                value={system.data.api.fxSyncEnabled ? 'Đang bật' : 'Đang tắt'}
              />
              <Row
                label="Bắt buộc xác thực hai bước cho admin"
                value={system.data.api.adminRequireMfa ? 'Đang bật' : 'Đang tắt'}
              />
            </dl>
          </Card>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-ink-3">
          <Spinner /> Đang kiểm tra…
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <dt className="text-[13.5px] text-ink-2">{label}</dt>
      <dd className="num font-semibold">{value}</dd>
    </div>
  );
}

/** 3725 → "1 giờ 2 phút". */
function uptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}
