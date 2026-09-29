import type { SubscriptionDetailDto, UsageFrequency } from '@subca/shared';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Pill } from '@/components/ui/pill';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import {
  intervalLabel,
  paymentMethodLabel,
  reminderLabel,
  statusLabel,
  USAGE_LEVELS,
} from '@/features/subscriptions/labels';
import {
  useArchiveSubscription,
  useSubscription,
  useUpdateSubscription,
} from '@/features/subscriptions/queries';
import { alertSaveError } from '@/features/subscriptions/save-error';
import { cn } from '@/lib/cn';
import { formatAmount, formatDate, perInterval, relativeDay } from '@/lib/format';
import { colors, shadow } from '@/theme';

/** Nền thẻ đầu trang theo trạng thái (mockup: .d-hero). */
const HERO_BG = {
  ACTIVE: colors.mint,
  TRIAL: colors['sky-soft'],
  REVIEW: colors.peach,
  CANCELLED: colors['muted-bg'],
  ARCHIVED: colors['muted-bg'],
} as const;

/** Chi tiết subscription — màn 5 của mockup, dữ liệu từ `GET /subscriptions/:id`. */
export default function SubscriptionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useSubscription(id);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={detail.isRefetching}
          onRefresh={() => detail.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar title="Chi tiết" />
      {detail.data ? (
        <DetailBody sub={detail.data} />
      ) : detail.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{detail.error.message}</Text>
          <BackButton onPress={() => router.back()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function DetailBody({ sub }: { sub: SubscriptionDetailDto }) {
  const update = useUpdateSubscription(sub.id);
  const archive = useArchiveSubscription(sub.id);
  const [sheet, setSheet] = useState<'cancel' | 'archive' | null>(null);
  const status = statusLabel(sub.status);
  const cancelled = sub.status === 'CANCELLED';
  const nextDate = sub.status === 'TRIAL' ? sub.trialEndDate : sub.nextRenewalDate;

  const setStatus = (next: 'ACTIVE' | 'REVIEW' | 'CANCELLED') =>
    update.mutate({ status: next }, { onError: alertSaveError });

  return (
    <>
      {/* ── Đầu trang ── */}
      <View
        className="items-center overflow-hidden rounded-sm border border-line p-[22px]"
        style={{ backgroundColor: HERO_BG[sub.status] }}
      >
        <View className="mb-3">
          <ServiceLogo name={sub.name} service={sub.service} size="lg" />
        </View>
        <Text
          weight="extrabold"
          className="text-center text-[24px] leading-[30px]"
          style={{ letterSpacing: -0.7 }}
        >
          {sub.name}
        </Text>
        {sub.planName ? <Text className="text-[14px] text-ink-2">{sub.planName}</Text> : null}
        <Text
          weight="extrabold"
          tabular
          className="mt-[10px] text-[34px] leading-[40px]"
          style={{ letterSpacing: -1.3 }}
        >
          {formatAmount(sub.amountMinor, sub.currency)}
          <Text weight="semibold" className="text-[14px] text-ink-2">
            {' '}
            {perInterval(sub.intervalUnit, sub.intervalCount)}
          </Text>
        </Text>
        <View className="mt-3">
          <Pill label={status.label} tone={status.tone} className="bg-surface" />
        </View>
      </View>

      {/* ── Kỳ tiếp theo ── */}
      {!cancelled && nextDate ? (
        <Card tone="sky" className="mt-3 flex-row items-center justify-between">
          <View>
            <Text className="text-[13px] leading-[18px] text-on-sky">
              {sub.status === 'TRIAL' ? 'Hết dùng thử' : 'Gia hạn tiếp theo'}
            </Text>
            <Text weight="bold" tabular className="text-[17px] leading-[23px]">
              {formatDate(nextDate)}
            </Text>
          </View>
          {sub.daysUntilRenewal != null ? (
            <Pill
              label={relativeDay(sub.daysUntilRenewal)}
              tone={sub.daysUntilRenewal <= 3 ? 'warn' : 'active'}
            />
          ) : null}
        </Card>
      ) : null}

      {sub.emailEvidence.length > 0 ? (
        <>
          <SectionTitle title="Nguồn phát hiện" />
          <Card className="gap-3 border border-[#D7E7DB] bg-[#F1F8F2]">
            {sub.emailEvidence.map((evidence) => (
              <View key={evidence.id} className="flex-row items-start gap-3">
                <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-sm bg-[#DDEFE1]">
                  <Icon name="mail" size={18} color="#34764F" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text weight="bold" className="text-[14px] leading-[19px]">
                    {emailEventLabel(evidence.eventType)}
                  </Text>
                  <Text className="mt-0.5 text-[12.5px] leading-[18px] text-ink-2">
                    {evidence.senderDomain ? `Email từ ${evidence.senderDomain}` : 'Email đã quét'}
                    {evidence.receivedAt
                      ? ` · ${formatDate(evidence.receivedAt.slice(0, 10))}`
                      : ''}
                  </Text>
                  {evidence.threadId ? (
                    <Pressable
                      className="mt-2 flex-row items-center gap-1.5 self-start"
                      accessibilityRole="link"
                      accessibilityLabel="Mở email gốc trong Gmail"
                      onPress={() =>
                        WebBrowser.openBrowserAsync(
                          `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(evidence.threadId!)}`,
                        )
                      }
                    >
                      <Text weight="bold" className="text-[12.5px] text-[#34764F]">
                        Mở email gốc trong Gmail
                      </Text>
                      <Icon name="link" size={14} color="#34764F" />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
            <Text className="border-t border-[#D7E7DB] pt-2 text-[11.5px] leading-[16px] text-ink-3">
              Subca chỉ lưu thông tin trích xuất và liên kết nguồn, không lưu nội dung thư.
            </Text>
          </Card>
        </>
      ) : null}

      <View className="mt-3 flex-row gap-2">
        <Button
          title="Chỉnh sửa"
          icon="edit"
          size="sm"
          className="flex-1"
          onPress={() =>
            router.push({ pathname: '/subscriptions/edit/[id]', params: { id: sub.id } })
          }
        />
        <Button
          title={sub.status === 'REVIEW' ? 'Bỏ xem lại' : 'Đánh dấu xem lại'}
          icon="flag"
          variant="soft"
          size="sm"
          className="flex-1"
          onPress={() => setStatus(sub.status === 'REVIEW' ? 'ACTIVE' : 'REVIEW')}
        />
      </View>

      {/* ── Thông tin ── */}
      <SectionTitle title="Thông tin" />
      <View className="rounded-lg bg-surface px-[18px] py-1" style={{ boxShadow: shadow.sm }}>
        <InfoRow
          icon="card"
          label="Thanh toán"
          value={sub.paymentMethod ? paymentMethodLabel(sub.paymentMethod) : 'Chưa chọn'}
        />
        <InfoRow icon="cal" label="Ngày bắt đầu" value={formatDate(sub.startDate)} />
        <InfoRow
          icon="repeat"
          label="Chu kỳ"
          value={`${intervalLabel(sub.intervalUnit, sub.intervalCount)}${sub.autoRenew ? '' : ' · không tự gia hạn'}`}
        />
        <InfoRow icon="bell" label="Nhắc nhở" value={reminderLabel(sub.reminderOffsets)} last />
      </View>

      {sub.notes ? (
        <Card className="mt-3">
          <Text className="text-[13px] leading-[18px] text-ink-3">Ghi chú</Text>
          <Text className="mt-1 text-[14.5px] leading-[21px]">{sub.notes}</Text>
        </Card>
      ) : null}

      {/* ── Mức độ sử dụng ── */}
      <UsageCard
        value={sub.usageFrequency}
        onChange={(usageFrequency) =>
          update.mutate({ usageFrequency }, { onError: alertSaveError })
        }
      />

      {/* ── Lịch sử ── */}
      <SectionTitle title="Lịch sử gia hạn" />
      <Card>
        {!cancelled && sub.nextRenewalDate ? (
          <TimelineRow
            date={sub.nextRenewalDate}
            note="sắp tới"
            amount={formatAmount(sub.amountMinor, sub.currency)}
            next
          />
        ) : null}
        {sub.charges.map((c) => (
          <TimelineRow
            key={c.chargedOn}
            date={c.chargedOn}
            note="đã thanh toán"
            amount={formatAmount(c.amountMinor, c.currency)}
          />
        ))}
        {sub.charges.length === 0 ? (
          <Text className="py-1 text-[13px] leading-[19px] text-ink-3">
            Chưa có kỳ nào bị trừ tiền kể từ khi thêm vào Subca.
          </Text>
        ) : null}
      </Card>

      {/* ── Tác vụ ít dùng ── */}
      <SectionTitle title="Quản lý gói" />
      <View className="mt-[10px] flex-row gap-[10px]">
        {cancelled ? (
          <Action
            icon="repeat"
            bg={colors.mint}
            label="Dùng lại gói này"
            onPress={() => setStatus('ACTIVE')}
          />
        ) : null}
        <Action
          icon="help"
          bg={colors.coral}
          label="Hướng dẫn hủy"
          onPress={() => setSheet('cancel')}
        />
        <Action
          icon="archive"
          bg={colors.stone}
          label="Lưu trữ"
          onPress={() => setSheet('archive')}
        />
      </View>

      <CancelSheet
        sub={sub}
        visible={sheet === 'cancel'}
        onClose={() => setSheet(null)}
        onCancelled={() => {
          setSheet(null);
          setStatus('CANCELLED');
        }}
      />
      <Sheet
        visible={sheet === 'archive'}
        onClose={() => setSheet(null)}
        title={`Lưu trữ ${sub.name}?`}
        subtitle="Subscription sẽ bị ẩn khỏi danh sách, không tính vào tổng chi phí và không còn được nhắc."
      >
        <Button
          title="Lưu trữ"
          icon="archive"
          className="mt-2"
          loading={archive.isPending}
          onPress={() =>
            archive.mutate(undefined, {
              onSuccess: () => {
                setSheet(null);
                router.back();
              },
              onError: alertSaveError,
            })
          }
        />
        <Button title="Để sau" variant="ghost" className="mt-2" onPress={() => setSheet(null)} />
      </Sheet>
    </>
  );
}

function emailEventLabel(eventType: SubscriptionDetailDto['emailEvidence'][number]['eventType']) {
  switch (eventType) {
    case 'TRIAL_STARTED':
    case 'TRIAL_ENDING':
      return 'Email về gói dùng thử';
    case 'PAYMENT_SUCCESS':
    case 'RENEWAL':
      return 'Email xác nhận thanh toán';
    case 'PRICE_CHANGED':
      return 'Email thông báo đổi giá';
    case 'PLAN_CHANGED':
      return 'Email thông báo đổi gói';
    case 'PAYMENT_FAILED':
      return 'Email báo thanh toán thất bại';
    case 'CANCELLATION_REQUESTED':
    case 'SUBSCRIPTION_CANCELLED':
    case 'SUBSCRIPTION_EXPIRED':
      return 'Email về việc hủy gói';
    case 'SUBSCRIPTION_RESUMED':
      return 'Email xác nhận tiếp tục gói';
    case 'SUBSCRIPTION_STARTED':
      return 'Email xác nhận đăng ký gói';
  }
}

function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View className="mx-[2px] mb-3 mt-[26px] flex-row items-baseline justify-between">
      <Text weight="bold" className="text-[17px] leading-[22px]">
        {title}
      </Text>
      {right}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between gap-3 py-[14px]',
        !last && 'border-b border-line',
      )}
    >
      <View className="flex-row items-center gap-[10px]">
        <Icon name={icon} size={18} color={colors['ink-2']} />
        <Text className="text-[14.5px] text-ink-2">{label}</Text>
      </View>
      <Text weight="semibold" className="flex-1 text-right text-[14.5px]" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** 5 nấc mức độ sử dụng; bấm để đổi (dùng cho Đánh giá tháng). "Chưa dùng" = 0 nấc. */
function UsageCard({
  value,
  onChange,
}: {
  value: UsageFrequency | null;
  onChange: (value: UsageFrequency) => void;
}) {
  const level = value ? USAGE_LEVELS.findIndex((l) => l.value === value) : -1;
  return (
    <>
      <SectionTitle
        title="Mức độ sử dụng"
        right={
          <Text className="text-[13px] text-ink-3">
            {level >= 0 ? USAGE_LEVELS[level]!.label : 'Chưa đánh giá'}
          </Text>
        }
      />
      <Card className="px-4 py-[14px]">
        <View className="mb-2 mt-1 flex-row gap-[6px]">
          {USAGE_LEVELS.slice(1).map((l, i) => (
            <Pressable
              key={l.value}
              onPress={() => onChange(level === i + 1 ? 'NEVER' : l.value)}
              accessibilityRole="button"
              accessibilityLabel={l.label}
              accessibilityState={{ selected: level === i + 1 }}
              className={cn('h-[34px] flex-1 rounded-sm', i + 1 <= level ? 'bg-sky' : 'bg-stone')}
            />
          ))}
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[12.5px] text-ink-3">Hiếm khi</Text>
          <Text className="text-[12.5px] text-ink-3">Hằng ngày</Text>
        </View>
      </Card>
    </>
  );
}

function TimelineRow({
  date,
  note,
  amount,
  next = false,
}: {
  date: string;
  note: string;
  amount: string;
  next?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-[9px]">
      <View className="flex-row items-center gap-[10px]">
        <View
          className={cn('h-3 w-3 rounded-full', next ? 'bg-sky' : 'bg-mint')}
          style={{ boxShadow: `0 0 0 1.5px ${next ? colors['sky-deep'] : colors.sage}` }}
        />
        <Text tabular className="text-[14px]">
          {formatDate(date)} <Text className="text-[13px] text-ink-3">· {note}</Text>
        </Text>
      </View>
      <Text weight="bold" tabular className="text-[14px]">
        {amount}
      </Text>
    </View>
  );
}

function Action({
  icon,
  bg,
  label,
  onPress,
}: {
  icon: IconName;
  bg: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 items-start gap-[10px] rounded-md bg-surface p-4 active:scale-[0.97]"
      style={{ boxShadow: shadow.sm }}
    >
      <View
        className="h-[38px] w-[38px] items-center justify-center rounded-sm"
        style={{ backgroundColor: bg }}
      >
        <Icon name={icon} />
      </View>
      <Text weight="semibold" className="text-[14px] leading-[19px]">
        {label}
      </Text>
    </Pressable>
  );
}

/** Hướng dẫn hủy (mockup: sheet "cancel"): các bước chung + link trang hủy nếu thư viện có. */
function CancelSheet({
  sub,
  visible,
  onClose,
  onCancelled,
}: {
  sub: SubscriptionDetailDto;
  visible: boolean;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const guide = sub.cancelGuide;
  const steps =
    guide && guide.steps.length > 0
      ? guide.steps
      : [
          `Mở ứng dụng hoặc website ${sub.name} và đăng nhập.`,
          'Vào Tài khoản → Gói đăng ký (hoặc Cài đặt → Thanh toán).',
          'Chọn Hủy gói và xác nhận. Nếu trả qua App Store / Google Play thì hủy trong phần Đăng ký của cửa hàng.',
          'Quay lại Subca và bấm “Tôi đã hủy xong” để ngừng nhắc.',
        ];
  const link = guide?.url ?? guide?.website ?? null;
  const cancelled = sub.status === 'CANCELLED';
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center gap-3">
        <ServiceLogo name={sub.name} service={sub.service} />
        <View className="flex-1">
          <Text weight="extrabold" className="text-[20px] leading-[26px]">
            Hủy {sub.name}
          </Text>
          <Text className="text-[13px] text-ink-3">
            Làm theo {steps.length} bước, mất khoảng 2 phút
          </Text>
        </View>
      </View>
      <View className="gap-3">
        {steps.map((step, i) => (
          <View key={i} className="flex-row gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
              <Text weight="bold" className="text-[12px] leading-[16px] text-white">
                {i + 1}
              </Text>
            </View>
            <Text className="flex-1 text-[14.5px] leading-[21px]">{step}</Text>
          </View>
        ))}
      </View>
      {!cancelled && sub.nextRenewalDate ? (
        <Card tone="peach" className="mt-4 p-[14px]">
          <Text className="text-[13.5px] leading-[20px] text-on-peach">
            Hủy trước{' '}
            <Text weight="bold" className="text-[13.5px] text-on-peach">
              {formatDate(sub.nextRenewalDate)}
            </Text>{' '}
            để không bị trừ{' '}
            <Text weight="bold" className="text-[13.5px] text-on-peach">
              {formatAmount(sub.amountMinor, sub.currency)}
            </Text>
            .
          </Text>
        </Card>
      ) : null}
      {link ? (
        <Button
          title="Mở trang hủy gói"
          variant="soft"
          icon="link"
          className="mt-4"
          onPress={() => WebBrowser.openBrowserAsync(link)}
        />
      ) : null}
      {cancelled ? null : <Button title="Tôi đã hủy xong" className="mt-3" onPress={onCancelled} />}
      <Button title="Để sau" variant="ghost" className="mt-2" onPress={onClose} />
    </Sheet>
  );
}
