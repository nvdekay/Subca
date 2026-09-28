'use client';

import { AUDIT_ACTIONS } from '@subca/shared';
import { useState } from 'react';
import { PageHead } from '@/components/page-head';
import {
  Card,
  EmptyState,
  ErrorNote,
  Pager,
  Pill,
  Spinner,
  TableWrap,
  Td,
  Th,
  type PillTone,
} from '@/components/ui';
import { useAuditLogs } from '@/features/admin/queries';
import { formatDateTime } from '@/lib/format';

const ACTION_LABEL: Record<string, string> = {
  [AUDIT_ACTIONS.userBan]: 'Khóa tài khoản',
  [AUDIT_ACTIONS.userUnban]: 'Mở khóa tài khoản',
  [AUDIT_ACTIONS.userGrantPlus]: 'Tặng Plus',
  [AUDIT_ACTIONS.userDelete]: 'Xóa dữ liệu người dùng',
  [AUDIT_ACTIONS.serviceCreate]: 'Thêm dịch vụ',
  [AUDIT_ACTIONS.serviceUpdate]: 'Sửa dịch vụ',
  [AUDIT_ACTIONS.servicePlanUpsert]: 'Sửa gói giá',
  [AUDIT_ACTIONS.priceReportApprove]: 'Duyệt đề xuất giá',
  [AUDIT_ACTIONS.priceReportReject]: 'Từ chối đề xuất giá',
};

const SEVERITY: Record<string, { tone: PillTone; label: string }> = {
  INFO: { tone: 'muted', label: 'Thông tin' },
  SENSITIVE: { tone: 'warn', label: 'Nhạy cảm' },
  CRITICAL: { tone: 'crit', label: 'Nghiêm trọng' },
};

export default function AuditPage() {
  const [severity, setSeverity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const logs = useAuditLogs({
    severity: severity || undefined,
    action: action || undefined,
    page,
  });

  return (
    <>
      <PageHead crumb="Quản trị" title="Nhật ký hoạt động" />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-4">
          <Select
            label="Mức độ"
            value={severity}
            onChange={(v) => {
              setSeverity(v);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Tất cả' },
              { value: 'INFO', label: 'Thông tin' },
              { value: 'SENSITIVE', label: 'Nhạy cảm' },
              { value: 'CRITICAL', label: 'Nghiêm trọng' },
            ]}
          />
          <Select
            label="Thao tác"
            value={action}
            onChange={(v) => {
              setAction(v);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Tất cả' },
              ...Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        {logs.isError ? (
          <div className="p-5">
            <ErrorNote error={logs.error as Error} onRetry={() => void logs.refetch()} />
          </div>
        ) : logs.data ? (
          logs.data.items.length > 0 ? (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Thời gian</Th>
                    <Th>Người thực hiện</Th>
                    <Th>Thao tác</Th>
                    <Th>Đối tượng</Th>
                    <Th>Mức độ</Th>
                    <Th>IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.items.map((log) => (
                    <tr key={log.id}>
                      <Td className="num whitespace-nowrap text-ink-3">
                        {formatDateTime(log.createdAt)}
                      </Td>
                      <Td>
                        {log.actor ? (
                          <>
                            <span className="font-semibold">{log.actor.name}</span>
                            <span className="block text-[12.5px] text-ink-3">
                              {log.actor.email}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-3">Hệ thống</span>
                        )}
                      </Td>
                      <Td>
                        {ACTION_LABEL[log.action] ?? log.action}
                        {log.metadata ? (
                          <span className="block text-[12px] text-ink-3">
                            {describe(log.metadata)}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="num text-[12.5px] text-ink-3">
                        {log.targetType ? `${log.targetType} · ` : ''}
                        {log.targetId ?? '—'}
                      </Td>
                      <Td>
                        <Pill tone={SEVERITY[log.severity]?.tone ?? 'muted'}>
                          {SEVERITY[log.severity]?.label ?? log.severity}
                        </Pill>
                      </Td>
                      <Td className="num text-[12.5px] text-ink-3">{log.ip ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pager
                page={logs.data.page}
                pageSize={logs.data.pageSize}
                total={logs.data.total}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState>Chưa có thao tác nào được ghi lại.</EmptyState>
          )
        ) : (
          <div className="flex items-center gap-2 px-5 py-8 text-ink-3">
            <Spinner /> Đang tải…
          </div>
        )}
      </Card>
    </>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[12.5px] font-semibold text-ink-2">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block h-10 rounded-xl border border-line bg-surface px-3 text-[13.5px] font-normal"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Tóm tắt metadata thành một dòng đọc được (lý do khóa, số tháng tặng…). */
function describe(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}
