'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHead } from '@/components/page-head';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  Pager,
  Pill,
  Spinner,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { useUsers } from '@/features/admin/queries';
import { formatAmount, formatDate, relativeTime } from '@/lib/format';

const STATUS = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'BANNED', label: 'Bị khóa' },
];
const PLANS = [
  { value: '', label: 'Mọi gói' },
  { value: 'FREE', label: 'Free' },
  { value: 'PLUS', label: 'Plus' },
];

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const users = useUsers({
    q: search || undefined,
    status: status || undefined,
    plan: plan || undefined,
    page,
  });

  const applySearch = () => {
    setSearch(q.trim());
    setPage(1);
  };

  return (
    <>
      <PageHead crumb="Người dùng" title="Người dùng" />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line-2 px-5 py-4">
          <Input
            label="Tìm kiếm"
            placeholder="Tên, email hoặc ID người dùng"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            className="min-w-[240px] flex-1"
          />
          <Chips
            label="Trạng thái"
            options={STATUS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
          <Chips
            label="Gói"
            options={PLANS}
            value={plan}
            onChange={(v) => {
              setPlan(v);
              setPage(1);
            }}
          />
          <Button variant="primary" onClick={applySearch}>
            Tìm
          </Button>
        </div>

        {users.isError ? (
          <div className="p-5">
            <ErrorNote error={users.error as Error} onRetry={() => void users.refetch()} />
          </div>
        ) : users.data ? (
          users.data.items.length > 0 ? (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Người dùng</Th>
                    <Th>Gói</Th>
                    <Th align="right">Số sub</Th>
                    <Th align="right">Chi tiêu/tháng</Th>
                    <Th>Tham gia</Th>
                    <Th>Hoạt động</Th>
                    <Th>Trạng thái</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => (
                    <tr key={user.id} className="transition hover:bg-line-2/60">
                      <Td>
                        <Link
                          href={`/users/${user.id}`}
                          className="block font-semibold hover:underline"
                        >
                          {user.displayName ?? 'Chưa đặt tên'}
                        </Link>
                        <span className="text-[12.5px] text-ink-3">{user.email ?? user.id}</span>
                      </Td>
                      <Td>
                        {user.plan === 'PLUS' ? (
                          <Pill tone="info">Plus</Pill>
                        ) : (
                          <Pill tone="muted">Free</Pill>
                        )}
                      </Td>
                      <Td align="right" className="num">
                        {user.subscriptionCount}
                      </Td>
                      <Td align="right" className="num">
                        {formatAmount(user.monthlyMinor)}
                      </Td>
                      <Td className="text-ink-3">{formatDate(user.createdAt)}</Td>
                      <Td className="text-ink-3">{relativeTime(user.lastActiveAt)}</Td>
                      <Td>
                        {user.bannedAt ? (
                          <Pill tone="crit">Bị khóa</Pill>
                        ) : (
                          <Pill tone="good">Hoạt động</Pill>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pager
                page={users.data.page}
                pageSize={users.data.pageSize}
                total={users.data.total}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState>Không có người dùng nào khớp bộ lọc.</EmptyState>
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

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>
      <div className="flex gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={`h-10 rounded-xl border px-3 text-[13px] font-semibold transition ${
              option.value === value
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-ink-2 hover:bg-line-2'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
