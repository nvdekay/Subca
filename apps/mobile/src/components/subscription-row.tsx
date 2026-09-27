import type { SubscriptionDto } from '@subca/shared';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { intervalLabel, statusLabel } from '@/features/subscriptions/labels';
import { cn } from '@/lib/cn';
import { formatAmount, formatDate, formatShortDate, perInterval, relativeDay } from '@/lib/format';
import { shadow } from '@/theme';
import { ServiceLogo } from './service-logo';
import { Pill } from './ui/pill';
import { Text } from './ui/text';

/** Khung chung của một dòng subscription (mockup: .sub-item); bấm để mở Chi tiết. */
function RowShell({
  sub,
  note,
  below,
  right,
}: {
  sub: SubscriptionDto;
  note: string;
  below?: ReactNode;
  right?: ReactNode;
}) {
  const cancelled = sub.status === 'CANCELLED';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub.name}
      onPress={() => router.push({ pathname: '/subscriptions/[id]', params: { id: sub.id } })}
      className={cn(
        'flex-row items-center gap-3 rounded-md bg-surface p-[14px] active:scale-[0.985]',
        cancelled && 'opacity-60',
      )}
      style={{ boxShadow: shadow.sm }}
    >
      <ServiceLogo name={sub.name} service={sub.service} />
      <View className="min-w-0 flex-1">
        <Text weight="bold" numberOfLines={1}>
          {sub.name}
        </Text>
        <Text className="text-[12.5px] leading-[18px] text-ink-3" numberOfLines={1}>
          {note}
        </Text>
        {below}
      </View>
      <View className="items-end">
        <Text weight="bold" tabular>
          {formatAmount(sub.amountMinor, sub.currency)}
        </Text>
        <Text className="text-[12.5px] leading-[18px] text-ink-3">
          {perInterval(sub.intervalUnit, sub.intervalCount)}
        </Text>
        {right}
      </View>
    </Pressable>
  );
}

/** Dòng "sắp gia hạn" ở Trang chủ: ngày + gói, pill số ngày còn lại. */
export function UpcomingRow({ sub }: { sub: SubscriptionDto }) {
  const days = sub.daysUntilRenewal;
  const date = sub.status === 'TRIAL' ? sub.trialEndDate : sub.nextRenewalDate;
  const note = [
    date ? (sub.status === 'TRIAL' ? `Hết dùng thử ${formatDate(date)}` : formatDate(date)) : null,
    sub.planName,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <RowShell
      sub={sub}
      note={note}
      right={
        days != null ? (
          <View className="mt-2">
            <Pill label={relativeDay(days)} tone={days <= 3 ? 'warn' : 'trial'} />
          </View>
        ) : null
      }
    />
  );
}

/** Dòng ở màn Danh sách: chu kỳ + ngày gia hạn, pill trạng thái. */
export function SubscriptionListRow({ sub }: { sub: SubscriptionDto }) {
  const status = statusLabel(sub.status);
  const when =
    sub.status === 'CANCELLED'
      ? 'Đã dừng'
      : sub.status === 'TRIAL' && sub.trialEndDate
        ? `Hết dùng thử ${formatShortDate(sub.trialEndDate)}`
        : sub.nextRenewalDate
          ? `Gia hạn ${formatShortDate(sub.nextRenewalDate)}`
          : '';
  return (
    <RowShell
      sub={sub}
      note={[intervalLabel(sub.intervalUnit, sub.intervalCount), when].filter(Boolean).join(' · ')}
      below={
        <View className="mt-[6px]">
          <Pill label={status.label} tone={status.tone} />
        </View>
      }
    />
  );
}
