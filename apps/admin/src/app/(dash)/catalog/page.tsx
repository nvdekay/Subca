'use client';

import type { AdminServiceDto, CreateService } from '@subca/shared';
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
  usePriceReports,
  useReviewPriceReport,
  useSaveService,
  useServices,
} from '@/features/admin/queries';
import { useAdminSession } from '@/features/auth/session';
import { formatAmount, formatDate } from '@/lib/format';

export default function CatalogPage() {
  const { can } = useAdminSession();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<AdminServiceDto | 'new' | null>(null);
  const services = useServices({ q: search || undefined, includeInactive });
  const reports = usePriceReports('PENDING');
  const review = useReviewPriceReport();

  return (
    <>
      <PageHead crumb="Sản phẩm" title="Thư viện dịch vụ">
        {can('manageCatalog') ? (
          <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
            Thêm dịch vụ
          </Button>
        ) : null}
      </PageHead>

      <div className="flex flex-col gap-4">
        {reports.data && reports.data.items.length > 0 ? (
          <Card title="Đề xuất giá đang chờ duyệt" note="Người dùng báo giá dịch vụ đã thay đổi">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Dịch vụ</Th>
                  <Th>Gói</Th>
                  <Th align="right">Giá đề xuất</Th>
                  <Th>Người báo</Th>
                  <Th>Ngày</Th>
                  <Th align="right">Duyệt</Th>
                </tr>
              </thead>
              <tbody>
                {reports.data.items.map((report) => (
                  <tr key={report.id}>
                    <Td>{report.service.name}</Td>
                    <Td>
                      {report.plan ? (
                        <>
                          {report.plan.name}{' '}
                          <span className="num text-ink-3">
                            ({formatAmount(report.plan.amountMinor, report.plan.currency)})
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td align="right" className="num font-bold">
                      {formatAmount(report.reportedAmountMinor, report.currency)}
                    </Td>
                    <Td className="text-ink-3">{report.reportedBy ?? 'Ẩn danh'}</Td>
                    <Td className="text-ink-3">{formatDate(report.createdAt)}</Td>
                    <Td align="right">
                      {can('manageCatalog') ? (
                        <span className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            loading={review.isPending}
                            onClick={() =>
                              review.mutate({ id: report.id, input: { decision: 'APPROVE' } })
                            }
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              review.mutate({ id: report.id, input: { decision: 'REJECT' } })
                            }
                          >
                            Từ chối
                          </Button>
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        ) : null}

        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-line-2 px-5 py-4">
            <Input
              label="Tìm dịch vụ"
              placeholder="Netflix, Spotify…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(q.trim())}
              className="min-w-[220px] flex-1"
            />
            <label className="flex h-10 items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Hiện cả dịch vụ đã tắt
            </label>
            <Button variant="primary" onClick={() => setSearch(q.trim())}>
              Tìm
            </Button>
          </div>

          {services.isError ? (
            <div className="p-5">
              <ErrorNote error={services.error as Error} onRetry={() => void services.refetch()} />
            </div>
          ) : services.data ? (
            services.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Dịch vụ</Th>
                    <Th>Gói giá</Th>
                    <Th align="right">Đang theo dõi</Th>
                    <Th>Trạng thái</Th>
                    <Th align="right" />
                  </tr>
                </thead>
                <tbody>
                  {services.data.map((service) => (
                    <tr key={service.id} className="align-top">
                      <Td>
                        <span className="flex items-center gap-2 font-semibold">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: service.brandColor ?? 'var(--color-sage)' }}
                          />
                          {service.name}
                        </span>
                        <span className="num text-[12.5px] text-ink-3">{service.slug}</span>
                        {service.pendingReports > 0 ? (
                          <span className="mt-1 block">
                            <Pill tone="warn">{service.pendingReports} đề xuất giá</Pill>
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        {service.plans.length > 0 ? (
                          <ul className="flex flex-col gap-0.5">
                            {service.plans.map((plan) => (
                              <li key={plan.id} className="text-[13px]">
                                {plan.name}{' '}
                                <b className="num">
                                  {formatAmount(plan.amountMinor, plan.currency)}
                                </b>
                                <span className="text-ink-3">
                                  /{plan.intervalCount > 1 ? `${plan.intervalCount} ` : ''}
                                  {plan.intervalUnit === 'MONTH' ? 'tháng' : 'năm'}
                                  {plan.isFamily ? ' · gia đình' : ''}
                                  {plan.isActive ? '' : ' · đã tắt'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3">Chưa có gói</span>
                        )}
                      </Td>
                      <Td align="right" className="num">
                        {service.subscriptionCount}
                      </Td>
                      <Td>
                        {service.isActive ? (
                          <Pill tone="good">Đang bật</Pill>
                        ) : (
                          <Pill tone="muted">Đã tắt</Pill>
                        )}
                      </Td>
                      <Td align="right">
                        {can('manageCatalog') ? (
                          <Button size="sm" onClick={() => setEditing(service)}>
                            Sửa
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState>Không tìm thấy dịch vụ nào.</EmptyState>
            )
          ) : (
            <div className="flex items-center gap-2 px-5 py-8 text-ink-3">
              <Spinner /> Đang tải…
            </div>
          )}
        </Card>
      </div>

      {editing ? (
        <ServiceModal
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function ServiceModal({
  service,
  onClose,
}: {
  service: AdminServiceDto | null;
  onClose: () => void;
}) {
  const save = useSaveService(service?.id ?? null);
  const [form, setForm] = useState({
    slug: service?.slug ?? '',
    name: service?.name ?? '',
    logoKey: service?.logoKey ?? '',
    brandColor: service?.brandColor ?? '',
    website: service?.website ?? '',
    cancelUrl: service?.cancelUrl ?? '',
    isActive: service?.isActive ?? true,
  });
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const input: CreateService = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      logoKey: form.logoKey.trim() || null,
      brandColor: form.brandColor.trim() || null,
      website: form.website.trim() || null,
      cancelUrl: form.cancelUrl.trim() || null,
      isActive: form.isActive,
    };
    save.mutate(input, { onSuccess: onClose });
  };

  return (
    <Modal
      title={service ? `Sửa ${service.name}` : 'Thêm dịch vụ'}
      note="Slug dùng trong app và khóa logo Simple Icons."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Tên" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="Slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
        <Input
          label="Khóa logo"
          value={form.logoKey}
          onChange={(e) => set('logoKey', e.target.value)}
          placeholder="netflix"
        />
        <Input
          label="Màu thương hiệu"
          value={form.brandColor}
          onChange={(e) => set('brandColor', e.target.value)}
          placeholder="#E50914"
        />
        <Input
          label="Website"
          value={form.website}
          onChange={(e) => set('website', e.target.value)}
          placeholder="https://netflix.com"
        />
        <Input
          label="Link hủy gói"
          value={form.cancelUrl}
          onChange={(e) => set('cancelUrl', e.target.value)}
          placeholder="https://netflix.com/cancelplan"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        Hiện trong thư viện của app
      </label>
      {save.isError ? (
        <p className="mt-3 text-[13px] text-crit">{(save.error as Error).message}</p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Thôi</Button>
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={!form.name.trim() || !form.slug.trim()}
          onClick={submit}
        >
          Lưu
        </Button>
      </div>
    </Modal>
  );
}
