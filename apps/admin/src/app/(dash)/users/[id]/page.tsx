'use client';

import type { AdminUserDetailDto } from '@subca/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { PageHead } from '@/components/page-head';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  Modal,
  Pill,
  Spinner,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { useAdminSession } from '@/features/auth/session';
import {
  useBanUser,
  useDeleteUser,
  useGrantPlus,
  useUnbanUser,
  useUser,
} from '@/features/admin/queries';
import { formatAmount, formatDate, formatDateTime, relativeTime } from '@/lib/format';

type Dialog = 'ban' | 'plus' | 'delete' | null;

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useUser(id);

  return (
    <>
      <PageHead crumb="Người dùng" title={user.data?.displayName ?? 'Chi tiết người dùng'}>
        <Link href="/users">
          <Button icon="back">Danh sách</Button>
        </Link>
      </PageHead>

      {user.isError ? (
        <ErrorNote error={user.error as Error} onRetry={() => void user.refetch()} />
      ) : user.data ? (
        <Detail data={user.data} />
      ) : (
        <div className="flex items-center gap-2 text-ink-3">
          <Spinner /> Đang tải…
        </div>
      )}
    </>
  );
}

function Detail({ data }: { data: AdminUserDetailDto }) {
  const router = useRouter();
  const { can } = useAdminSession();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [months, setMonths] = useState('1');

  const ban = useBanUser(data.id);
  const unban = useUnbanUser(data.id);
  const grantPlus = useGrantPlus(data.id);
  const remove = useDeleteUser(data.id);
  const close = () => {
    setDialog(null);
    setReason('');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-extrabold">{data.displayName ?? 'Chưa đặt tên'}</h2>
              {data.plan === 'PLUS' ? (
                <Pill tone="info">Plus</Pill>
              ) : (
                <Pill tone="muted">Free</Pill>
              )}
              {data.bannedAt ? <Pill tone="crit">Bị khóa</Pill> : null}
            </div>
            <p className="text-[13px] text-ink-3">{data.email ?? '—'}</p>
            <p className="num mt-1 text-[12px] text-ink-3">{data.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('manageUsers') ? (
              data.bannedAt ? (
                <Button loading={unban.isPending} onClick={() => unban.mutate()}>
                  Mở khóa
                </Button>
              ) : (
                <Button variant="danger" icon="lock" onClick={() => setDialog('ban')}>
                  Khóa tài khoản
                </Button>
              )
            ) : null}
            {can('manageUsers') ? (
              <Button icon="coin" onClick={() => setDialog('plus')}>
                Tặng Plus
              </Button>
            ) : null}
            {can('deleteUsers') ? (
              <Button variant="danger" icon="alert" onClick={() => setDialog('delete')}>
                Xóa dữ liệu
              </Button>
            ) : null}
          </div>
        </div>

        {data.bannedAt ? (
          <p className="mt-3 rounded-xl bg-crit-bg px-4 py-2.5 text-[13px] text-crit">
            Bị khóa {formatDateTime(data.bannedAt)} · lý do: {data.banReason ?? '—'}
          </p>
        ) : null}

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Tham gia" value={formatDate(data.createdAt)} />
          <Field label="Hoạt động gần nhất" value={relativeTime(data.lastActiveAt)} />
          <Field label="Chi tiêu theo dõi" value={`${formatAmount(data.monthlyMinor)}/tháng`} />
          <Field label="Mã giới thiệu" value={data.referralCode} />
          <Field label="Tiền tệ" value={data.settings?.currency ?? '—'} />
          <Field label="Múi giờ" value={data.settings?.timezone ?? '—'} />
          <Field
            label="Thông báo"
            value={data.settings?.notificationsEnabled ? 'Đang bật' : 'Đã tắt'}
          />
          <Field
            label="Nhắc đã gửi"
            value={`${data.reminders.sent} · mở ${data.reminders.opened} · lỗi ${data.reminders.failed}`}
          />
        </dl>

        {data.entitlement ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-sky-soft px-4 py-2.5 text-[13px] text-sky-deep">
            <Icon name="coin" className="size-4" />
            Plus {data.entitlement.product} qua {data.entitlement.store} ·{' '}
            {data.entitlement.expiresAt
              ? `hết hạn ${formatDate(data.entitlement.expiresAt)}`
              : 'trọn đời'}
          </p>
        ) : null}
      </Card>

      <Card title="Subscription" note={`${data.subscriptions.length} gói`}>
        {data.subscriptions.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Tên</Th>
                <Th>Trạng thái</Th>
                <Th align="right">Giá</Th>
                <Th>Kỳ tới</Th>
              </tr>
            </thead>
            <tbody>
              {data.subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <Td>{sub.name}</Td>
                  <Td>{sub.status}</Td>
                  <Td align="right" className="num">
                    {formatAmount(sub.amountMinor, sub.currency)}
                  </Td>
                  <Td className="text-ink-3">{sub.nextRenewalDate ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState>Chưa thêm subscription nào.</EmptyState>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Nhóm chia tiền">
          {data.groups.length > 0 ? (
            <ul className="divide-y divide-line-2">
              {data.groups.map((group) => (
                <li key={group.id} className="flex justify-between px-5 py-2.5">
                  <span>{group.name}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {group.isOwner ? 'Chủ nhóm' : 'Thành viên'} · {group.memberCount} người
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Chưa tham gia nhóm nào.</EmptyState>
          )}
        </Card>

        <Card title="Thiết bị nhận thông báo">
          {data.devices.length > 0 ? (
            <ul className="divide-y divide-line-2">
              {data.devices.map((device, i) => (
                <li key={i} className="flex justify-between px-5 py-2.5">
                  <span>
                    {device.deviceName ?? 'Không rõ'}{' '}
                    <span className="text-ink-3">({device.platform})</span>
                  </span>
                  <span className="text-[12.5px] text-ink-3">
                    {relativeTime(device.lastSeenAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Chưa đăng ký thiết bị nào.</EmptyState>
          )}
        </Card>
      </div>

      {dialog === 'ban' ? (
        <Modal
          title="Khóa tài khoản"
          note="Người dùng sẽ không gọi được API cho tới khi mở khóa. Lý do được ghi vào nhật ký."
          onClose={close}
        >
          <Input
            label="Lý do"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: spam mời nhóm"
            error={ban.isError ? (ban.error as Error).message : null}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={close}>Thôi</Button>
            <Button
              variant="danger"
              loading={ban.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => ban.mutate({ reason: reason.trim() }, { onSuccess: close })}
            >
              Khóa tài khoản
            </Button>
          </div>
        </Modal>
      ) : null}

      {dialog === 'plus' ? (
        <Modal
          title="Tặng Subca Plus"
          note="Cấp quyền Plus không qua cửa hàng. Bỏ trống số tháng = tặng trọn đời."
          onClose={close}
        >
          <Input
            label="Số tháng (bỏ trống = trọn đời)"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="Lý do"
            className="mt-3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: đền bù lỗi nhắc nhở"
            error={grantPlus.isError ? (grantPlus.error as Error).message : null}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={close}>Thôi</Button>
            <Button
              variant="primary"
              loading={grantPlus.isPending}
              disabled={reason.trim().length < 3}
              onClick={() =>
                grantPlus.mutate(
                  {
                    ...(months ? { months: Number(months) } : {}),
                    reason: reason.trim(),
                  },
                  { onSuccess: close },
                )
              }
            >
              Tặng Plus
            </Button>
          </div>
        </Modal>
      ) : null}

      {dialog === 'delete' ? (
        <Modal
          title="Xóa vĩnh viễn dữ liệu"
          note="Xóa tài khoản đăng nhập và toàn bộ dữ liệu. Không khôi phục được."
          onClose={close}
        >
          <p className="text-[13.5px] text-ink-2">
            Gõ <b>XOA</b> để xác nhận xóa {data.email ?? data.id}.
          </p>
          <Input
            className="mt-3"
            value={reason}
            onChange={(e) => setReason(e.target.value.toUpperCase())}
            placeholder="XOA"
            error={remove.isError ? (remove.error as Error).message : null}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={close}>Thôi</Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              disabled={reason !== 'XOA'}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    close();
                    router.replace('/users');
                  },
                })
              }
            >
              Xóa vĩnh viễn
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-line-2/70 px-3 py-2">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="num text-[13.5px] font-semibold">{value}</dd>
    </div>
  );
}
