'use client';

import type { AdminRole, AdminTeamMemberDto } from '@subca/shared';
import { useState } from 'react';
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
import {
  useCreateAdmin,
  useRemoveAdmin,
  useSetAdminPassword,
  useTeam,
  useUpdateAdmin,
} from '@/features/admin/queries';
import { useAdminSession } from '@/features/auth/session';
import { formatDateTime, relativeTime } from '@/lib/format';

const ROLE_NOTE: Record<AdminRole, string> = {
  OWNER: 'Toàn quyền, kể cả quản lý nhân sự',
  ADMIN: 'Toàn quyền trừ quản lý nhân sự',
  SUPPORT: 'Người dùng: khóa, tặng Plus',
  MARKETING: 'Thư viện dịch vụ, duyệt giá',
  VIEWER: 'Chỉ xem',
};
const ASSIGNABLE: AdminRole[] = ['ADMIN', 'SUPPORT', 'MARKETING', 'VIEWER'];

type Dialog = { kind: 'create' } | { kind: 'password'; member: AdminTeamMemberDto } | null;

export default function TeamPage() {
  const { can } = useAdminSession();
  const team = useTeam();
  const [dialog, setDialog] = useState<Dialog>(null);
  const update = useUpdateAdmin();
  const remove = useRemoveAdmin();
  const manage = can('manageTeam');

  return (
    <>
      <PageHead crumb="Quản trị" title="Nhân sự & phân quyền">
        {manage ? (
          <Button
            variant="primary"
            icon="plus"
            disabled={!team.data?.canCreateAccounts}
            onClick={() => setDialog({ kind: 'create' })}
          >
            Thêm tài khoản
          </Button>
        ) : null}
      </PageHead>

      <div className="flex flex-col gap-4">
        {team.data && !team.data.canCreateAccounts ? (
          <div className="rounded-(--radius-card) bg-warn-bg px-4 py-3 text-[13px] text-warn">
            Máy chủ chưa có <code>SUPABASE_SERVICE_ROLE_KEY</code> nên chưa tạo được tài khoản mới
            hay đặt lại mật khẩu. Vẫn đổi được vai trò và bật/tắt tài khoản sẵn có.
          </div>
        ) : null}

        <Card title="Tài khoản quản trị" note="Đăng nhập bằng email và mật khẩu">
          {team.isError ? (
            <div className="p-5">
              <ErrorNote error={team.error as Error} onRetry={() => void team.refetch()} />
            </div>
          ) : team.data ? (
            team.data.items.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Tài khoản</Th>
                    <Th>Vai trò</Th>
                    <Th>Trạng thái</Th>
                    <Th>Hoạt động</Th>
                    <Th align="right" />
                  </tr>
                </thead>
                <tbody>
                  {team.data.items.map((member) => (
                    <tr key={member.id}>
                      <Td>
                        <span className="font-semibold">
                          {member.name}
                          {member.isMe ? <span className="text-ink-3"> · bạn</span> : null}
                        </span>
                        <span className="block text-[12.5px] text-ink-3">{member.email}</span>
                      </Td>
                      <Td>
                        {manage && !member.isMe && member.role !== 'OWNER' ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              update.mutate({
                                id: member.id,
                                input: { role: e.target.value as AdminRole },
                              })
                            }
                            className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]"
                          >
                            {ASSIGNABLE.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Pill tone={member.role === 'OWNER' ? 'info' : 'muted'}>
                            {member.role}
                          </Pill>
                        )}
                        <span className="mt-1 block text-[12px] text-ink-3">
                          {ROLE_NOTE[member.role]}
                        </span>
                      </Td>
                      <Td>
                        {member.isActive ? (
                          <Pill tone="good">Đang bật</Pill>
                        ) : (
                          <Pill tone="crit">Đã tắt</Pill>
                        )}
                      </Td>
                      <Td className="text-[12.5px] text-ink-3">
                        {relativeTime(member.lastActiveAt)}
                        <span className="block">tạo {formatDateTime(member.createdAt)}</span>
                      </Td>
                      <Td align="right">
                        {manage && !member.isMe ? (
                          <span className="inline-flex flex-wrap justify-end gap-2">
                            {team.data.canCreateAccounts ? (
                              <Button
                                size="sm"
                                onClick={() => setDialog({ kind: 'password', member })}
                              >
                                Đổi mật khẩu
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              loading={update.isPending}
                              onClick={() =>
                                update.mutate({
                                  id: member.id,
                                  input: { isActive: !member.isActive },
                                })
                              }
                            >
                              {member.isActive ? 'Tắt' : 'Bật lại'}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              loading={remove.isPending}
                              onClick={() => {
                                if (confirm(`Gỡ quyền quản trị của ${member.email}?`)) {
                                  remove.mutate(member.id);
                                }
                              }}
                            >
                              Gỡ quyền
                            </Button>
                          </span>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState>Chưa có tài khoản quản trị nào.</EmptyState>
            )
          ) : (
            <div className="flex items-center gap-2 px-5 py-8 text-ink-3">
              <Spinner /> Đang tải…
            </div>
          )}
          {update.isError || remove.isError ? (
            <p className="px-5 pb-4 text-[13px] text-crit">
              {((update.error ?? remove.error) as Error).message}
            </p>
          ) : null}
        </Card>
      </div>

      {dialog?.kind === 'create' ? <CreateModal onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'password' ? (
        <PasswordModal member={dialog.member} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAdmin();
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'VIEWER' as Exclude<AdminRole, 'OWNER'>,
    password: '',
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      title="Thêm tài khoản quản trị"
      note="Tài khoản đăng nhập được tạo luôn trên Supabase Auth. Gửi mật khẩu cho người dùng qua kênh riêng và yêu cầu đổi sau lần đăng nhập đầu."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="ban@subca.app"
        />
        <Input
          label="Tên hiển thị"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>
      <label className="mt-3 block text-[12.5px] font-semibold text-ink-2">
        Vai trò
        <select
          value={form.role}
          onChange={(e) => set('role', e.target.value)}
          className="mt-1.5 block h-10 w-full rounded-xl border border-line bg-surface px-3 text-[13.5px] font-normal"
        >
          {ASSIGNABLE.map((role) => (
            <option key={role} value={role}>
              {role} — {ROLE_NOTE[role]}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Mật khẩu (tối thiểu 12 ký tự, có chữ hoa, chữ thường và số)"
        type="text"
        className="mt-3"
        value={form.password}
        onChange={(e) => set('password', e.target.value)}
        error={create.isError ? (create.error as Error).message : null}
      />
      <Button
        size="sm"
        className="mt-2"
        onClick={() => set('password', randomPassword())}
        type="button"
      >
        Sinh mật khẩu ngẫu nhiên
      </Button>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Thôi</Button>
        <Button
          variant="primary"
          loading={create.isPending}
          disabled={!form.email.includes('@') || !form.name.trim() || form.password.length < 12}
          onClick={() =>
            create.mutate(
              {
                email: form.email.trim(),
                name: form.name.trim(),
                role: form.role,
                password: form.password,
              },
              { onSuccess: onClose },
            )
          }
        >
          Tạo tài khoản
        </Button>
      </div>
    </Modal>
  );
}

function PasswordModal({ member, onClose }: { member: AdminTeamMemberDto; onClose: () => void }) {
  const setPassword = useSetAdminPassword();
  const [password, setPasswordValue] = useState('');
  return (
    <Modal title={`Đặt lại mật khẩu`} note={member.email} onClose={onClose}>
      <Input
        label="Mật khẩu mới"
        type="text"
        value={password}
        onChange={(e) => setPasswordValue(e.target.value)}
        error={setPassword.isError ? (setPassword.error as Error).message : null}
      />
      <Button size="sm" className="mt-2" onClick={() => setPasswordValue(randomPassword())}>
        Sinh mật khẩu ngẫu nhiên
      </Button>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Thôi</Button>
        <Button
          variant="primary"
          loading={setPassword.isPending}
          disabled={password.length < 12}
          onClick={() =>
            setPassword.mutate({ id: member.id, input: { password } }, { onSuccess: onClose })
          }
        >
          Đặt lại
        </Button>
      </div>
    </Modal>
  );
}

/** Mật khẩu ngẫu nhiên đủ mạnh, bỏ ký tự dễ đọc lẫn. */
function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}
