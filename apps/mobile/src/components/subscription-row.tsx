import type { SubscriptionDto } from '@subca/shared';
import { View } from 'react-native';
import { formatAmount, formatDate, perInterval, relativeDay } from '@/lib/format';
import { shadow } from '@/theme';
import { ServiceLogo } from './service-logo';
import { Pill } from './ui/pill';
import { Text } from './ui/text';

/** Một dòng subscription sắp gia hạn (mockup: .sub-item dạng "upcoming"). */
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
    <View
      className="flex-row items-center gap-3 rounded-md bg-surface p-[14px]"
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
      </View>
      <View className="items-end">
        <Text weight="bold" tabular>
          {formatAmount(sub.amountMinor, sub.currency)}
        </Text>
        <Text className="text-[12.5px] leading-[18px] text-ink-3">
          {perInterval(sub.intervalUnit, sub.intervalCount)}
        </Text>
        {days != null ? (
          <View className="mt-2">
            <Pill label={relativeDay(days)} tone={days <= 3 ? 'warn' : 'trial'} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
