import type { SubscriptionDto } from '@subca/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, RefreshControl, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Ring } from '@/components/ui/ring';
import { Text } from '@/components/ui/text';
import { registerForPush } from '@/features/notifications/push';
import { useSubscriptions, useUpdateSubscription } from '@/features/subscriptions/queries';
import { alertSaveError } from '@/features/subscriptions/save-error';
import { formatAmount, formatDate, perInterval } from '@/lib/format';
import { colors, shadow } from '@/theme';

const URGENT_DAYS = 3;

/** "10$ + 99.000đ": các trial có thể khác tiền tệ, không quy đổi ở đây để khỏi đoán tỷ giá. */
function sumByCurrency(items: SubscriptionDto[]): string {
  const totals = new Map<string, { currency: SubscriptionDto['currency']; minor: bigint }>();
  for (const s of items) {
    const t = totals.get(s.currency) ?? { currency: s.currency, minor: 0n };
    t.minor += BigInt(s.monthlyEquivalentMinor);
    totals.set(s.currency, t);
  }
  return [...totals.values()].map((t) => formatAmount(t.minor, t.currency)).join(' + ');
}

/** Quản lý Trial — màn 7 của mockup. */
export default function Trials() {
  const query = useSubscriptions();
  const trials = useMemo(
    () =>
      (query.data?.items ?? [])
        .filter((s) => s.status === 'TRIAL')
        .sort((a, b) => (a.daysUntilRenewal ?? 0) - (b.daysUntilRenewal ?? 0)),
    [query.data],
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar
        title="Quản lý Trial"
        right={<IconButton icon="plus" label="Thêm trial" onPress={() => router.push('/add')} />}
      />
      {query.data ? (
        trials.length > 0 ? (
          <>
            <Card tone="peach" className="flex-row items-center gap-[14px]">
              <View className="h-10 w-10 items-center justify-center rounded-[13px] bg-surface">
                <Icon name="hourglass" color={colors['coral-deep']} />
              </View>
              <View className="flex-1">
                <Text weight="bold">Bạn có {trials.length} trial đang chạy</Text>
                <Text className="text-[14px] leading-[20px] text-[#6B4A33]">
                  Nếu không hủy, bạn sẽ bị trừ{' '}
                  <Text weight="bold" tabular className="text-[14px] text-[#6B4A33]">
                    {sumByCurrency(trials)}
                  </Text>{' '}
                  / tháng.
                </Text>
              </View>
            </Card>
            <Text weight="bold" className="mx-[2px] mb-3 mt-[26px] text-[17px] leading-[22px]">
              Đang dùng thử
            </Text>
            <View className="gap-3">
              {trials.map((s) => (
                <TrialCard key={s.id} sub={s} />
              ))}
            </View>
          </>
        ) : (
          <View className="items-center gap-2 py-12">
            <Icon name="check-circle" size={32} color={colors['ink-3']} />
            <Text className="text-ink-3">Không còn trial nào. Tuyệt!</Text>
          </View>
        )
      ) : query.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{query.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => query.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function TrialCard({ sub }: { sub: SubscriptionDto }) {
  const update = useUpdateSubscription(sub.id);
  const left = Math.max(sub.daysUntilRenewal ?? 0, 0);
  const urgent = left <= URGENT_DAYS;
  const end = sub.trialEndDate ?? sub.nextRenewalDate;
  // Không lưu ngày bắt đầu dùng thử → coi ngày thêm vào Subca là mốc đầu để vẽ vòng tiến độ.
  const totalDays = end
    ? Math.max(
        1,
        Math.round((Date.parse(end) - Date.parse(sub.createdAt.slice(0, 10))) / 86_400_000),
      )
    : 1;
  const progress = 1 - left / totalDays;

  const keep = () =>
    update.mutate(
      { isTrial: false },
      {
        onSuccess: () => Alert.alert('Đã giữ gói', `${sub.name} giờ được tính là gói trả tiền.`),
        onError: alertSaveError,
      },
    );

  const remind = () =>
    update.mutate(
      { reminderOffsets: [1] },
      {
        onSuccess: () => {
          Alert.alert(
            'Đã đặt nhắc',
            `Subca sẽ nhắc bạn 1 ngày trước khi ${sub.name} bắt đầu tính phí.`,
          );
          registerForPush({ ask: true });
        },
        onError: alertSaveError,
      },
    );

  const cancel = () =>
    Alert.alert(
      `Hủy ${sub.name}?`,
      'Bạn đã hủy gói này trong ứng dụng / website của dịch vụ chưa?',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Xem cách hủy',
          onPress: () => router.push({ pathname: '/subscriptions/[id]', params: { id: sub.id } }),
        },
        {
          text: 'Đã hủy xong',
          onPress: () => update.mutate({ status: 'CANCELLED' }, { onError: alertSaveError }),
        },
      ],
    );

  return (
    <View className="rounded-lg bg-surface p-[18px]" style={{ boxShadow: shadow.sm }}>
      <View className="flex-row items-center gap-3">
        <Ring progress={progress} color={urgent ? '#C9694D' : colors['sky-deep']}>
          <Text weight="bold" tabular className="text-[18px] leading-[20px]">
            {left}
          </Text>
          <Text weight="semibold" className="text-[9.5px] leading-[12px] text-ink-3">
            ngày
          </Text>
        </Ring>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <ServiceLogo name={sub.name} service={sub.service} size="sm" />
            <Text weight="bold" className="flex-1 text-[16px]" numberOfLines={1}>
              {sub.name}
            </Text>
          </View>
          <View className="mt-2">
            {urgent ? (
              <Pill tone="warn" icon="alert" label="Sắp bị trừ tiền" />
            ) : (
              <Pill tone="trial" icon="hourglass" label={`Còn ${left} ngày`} />
            )}
          </View>
        </View>
      </View>
      <View className="my-[14px] flex-row gap-2">
        <View className="flex-1 rounded-[14px] bg-bg px-3 py-[10px]">
          <Text className="text-[11.5px] leading-[16px] text-ink-3">Phí sau trial</Text>
          <Text weight="bold" tabular className="text-[14.5px]">
            {formatAmount(sub.amountMinor, sub.currency)}
            {perInterval(sub.intervalUnit, sub.intervalCount)}
          </Text>
        </View>
        <View className="flex-1 rounded-[14px] bg-bg px-3 py-[10px]">
          <Text className="text-[11.5px] leading-[16px] text-ink-3">Hết hạn</Text>
          <Text weight="bold" tabular className="text-[14.5px]">
            {end ? formatDate(end) : '—'}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button
          title="Giữ"
          icon="check"
          variant="soft"
          size="sm"
          className="h-11 flex-1"
          onPress={keep}
        />
        <Button
          title={sub.reminderOffsets.includes(1) ? 'Đã đặt nhắc' : 'Nhắc tôi'}
          icon="bell"
          variant="soft"
          size="sm"
          className="h-11 flex-1"
          disabled={sub.reminderOffsets.includes(1)}
          onPress={remind}
        />
      </View>
      <Button
        title="Hủy trước khi bị trừ tiền"
        icon="x"
        variant="coral"
        size="sm"
        className="mt-2 h-11"
        loading={update.isPending}
        onPress={cancel}
      />
    </View>
  );
}
