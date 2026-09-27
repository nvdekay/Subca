import type { ReviewDecision, ReviewDto, ReviewItemDto } from '@subca/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Screen } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSetDecision, useReview } from '@/features/review/queries';
import { USAGE_LEVELS } from '@/features/subscriptions/labels';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/format';
import { colors, shadow } from '@/theme';

type Tab = 'todo' | 'done' | 'all';

const DECISIONS: {
  value: ReviewDecision;
  label: string;
  icon: IconName;
  on: string;
  onText: string;
  color: string;
}[] = [
  {
    value: 'KEEP',
    label: 'Giữ',
    icon: 'check',
    on: 'bg-mint',
    onText: 'text-on-mint',
    color: '#2E5B45',
  },
  {
    value: 'REVIEW',
    label: 'Xem lại',
    icon: 'flag',
    on: 'bg-peach',
    onText: 'text-on-peach',
    color: '#8A4B1E',
  },
  {
    value: 'CANCEL',
    label: 'Hủy',
    icon: 'x',
    on: 'bg-coral',
    onText: 'text-on-coral',
    color: '#7A2E17',
  },
];

/** Đánh giá hằng tháng — màn 8 của mockup, dữ liệu từ `GET /reviews`. */
export default function Review() {
  const review = useReview();
  const [tab, setTab] = useState<Tab>('todo');
  const month = review.data ? Number(review.data.period.slice(5, 7)) : new Date().getMonth() + 1;

  return (
    <Screen
      tabBar
      refreshControl={
        <RefreshControl
          refreshing={review.isRefetching}
          onRefresh={() => review.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <View className="mb-[18px] mt-[6px]">
        <Text className="text-[13px] leading-[18px] text-ink-3">Đánh giá tháng {month}</Text>
        <Text
          weight="extrabold"
          className="text-[24px] leading-[30px]"
          style={{ letterSpacing: -0.6 }}
        >
          Giữ, xem lại hay hủy?
        </Text>
      </View>

      {review.data ? (
        <ReviewBody data={review.data} tab={tab} onTab={setTab} />
      ) : review.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{review.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => review.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function ReviewBody({ data, tab, onTab }: { data: ReviewDto; tab: Tab; onTab: (t: Tab) => void }) {
  const done = data.reviewedCount;
  const total = data.totalCount;
  const shown = data.items.filter((i) =>
    tab === 'all' ? true : tab === 'done' ? i.decision !== null : i.decision === null,
  );

  if (total === 0) {
    return (
      <Card className="items-center gap-3 py-8">
        <Text weight="bold">Chưa có gì để đánh giá</Text>
        <Text className="text-center text-[14px] leading-[21px] text-ink-3">
          Thêm các subscription bạn đang trả tiền, cuối mỗi tháng quay lại đây để quyết định giữ hay
          hủy.
        </Text>
        <Button
          title="Thêm subscription"
          size="sm"
          icon="plus"
          onPress={() => router.push('/add')}
        />
      </Card>
    );
  }

  return (
    <>
      {/* Thẻ "Có thể tiết kiệm" (mockup: .savings) */}
      <View
        className="overflow-hidden rounded-[30px] p-[22px]"
        style={{ experimental_backgroundImage: 'linear-gradient(140deg, #FDE8D3, #F7D3C3)' }}
      >
        <View className="flex-row items-center justify-between">
          <Text weight="semibold" className="text-[#6B3A22]">
            Có thể tiết kiệm
          </Text>
          <View className="rounded-full bg-[rgba(255,255,255,0.7)] px-[10px] py-1">
            <Text weight="semibold" tabular className="text-[12px] text-[#6B3A22]">
              {formatAmount(BigInt(data.potentialSavingsMinor) * 12n, data.currency)} / năm
            </Text>
          </View>
        </View>
        <Text
          weight="extrabold"
          tabular
          className="mt-1 text-[34px] leading-[40px]"
          style={{ letterSpacing: -1.3 }}
        >
          {formatAmount(data.potentialSavingsMinor, data.currency)}
        </Text>
        <Text className="text-[13px] text-[#6B3A22]">mỗi tháng nếu hủy các mục đã đánh dấu</Text>
        <View className="mt-[14px] flex-row items-center gap-[10px]">
          <View className="h-2 flex-1 overflow-hidden rounded-[6px] bg-[rgba(255,255,255,0.7)]">
            <View
              className="h-full rounded-[6px] bg-[#C9694D]"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </View>
          <Text tabular className="text-[13px] text-ink-2">
            {done}/{total} đã đánh giá
          </Text>
        </View>
      </View>

      {data.missingRates.length > 0 ? (
        <Text className="mx-1 mt-2 text-[12.5px] leading-[18px] text-on-peach">
          Chưa có tỷ giá {data.missingRates.join(', ')} nên các khoản này tính là 0đ.
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mb-3 mt-[18px]"
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 2, gap: 8 }}
      >
        <Chip
          label="Chưa đánh giá"
          count={total - done}
          selected={tab === 'todo'}
          onPress={() => onTab('todo')}
        />
        <Chip
          label="Đã đánh giá"
          count={done}
          selected={tab === 'done'}
          onPress={() => onTab('done')}
        />
        <Chip label="Tất cả" count={total} selected={tab === 'all'} onPress={() => onTab('all')} />
      </ScrollView>

      {shown.length > 0 ? (
        <View className="gap-[10px]">
          {shown.map((item) => (
            <ReviewRow key={item.subscriptionId} item={item} currency={data.currency} />
          ))}
        </View>
      ) : (
        <View className="items-center gap-2 py-10">
          <Icon name="check-circle" size={32} color={colors['ink-3']} />
          <Text className="text-ink-3">
            {tab === 'todo' ? 'Bạn đã đánh giá xong tháng này!' : 'Chưa đánh giá gói nào.'}
          </Text>
        </View>
      )}
    </>
  );
}

/** Gợi ý theo mức độ sử dụng người dùng đã chọn ở màn Chi tiết. */
function usageHint(item: ReviewItemDto): { text: string; low: boolean } {
  if (!item.usageFrequency) return { text: 'Chưa chọn mức độ sử dụng', low: false };
  const label = USAGE_LEVELS.find((l) => l.value === item.usageFrequency)?.label ?? '';
  const low = item.usageFrequency === 'NEVER' || item.usageFrequency === 'RARELY';
  return { text: low ? `Ít dùng · ${label.toLowerCase()}` : `Dùng ${label.toLowerCase()}`, low };
}

function ReviewRow({ item, currency }: { item: ReviewItemDto; currency: ReviewDto['currency'] }) {
  const setDecision = useSetDecision();
  const hint = usageHint(item);
  return (
    <View className="rounded-md bg-surface p-[14px]" style={{ boxShadow: shadow.sm }}>
      <Pressable
        onPress={() =>
          router.push({ pathname: '/subscriptions/[id]', params: { id: item.subscriptionId } })
        }
        accessibilityRole="button"
        className="flex-row items-center gap-3"
      >
        <ServiceLogo name={item.name} service={item.service} />
        <View className="min-w-0 flex-1">
          <Text weight="bold" numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            className={cn(
              'text-[12.5px] leading-[18px]',
              hint.low ? 'text-on-peach' : 'text-ink-3',
            )}
          >
            {hint.text}
          </Text>
        </View>
        <Text weight="bold" tabular>
          {formatAmount(item.monthlyMinor, currency)}
        </Text>
      </Pressable>
      <View className="mt-3 flex-row gap-[6px]">
        {DECISIONS.map((d) => {
          const on = item.decision === d.value;
          return (
            <Pressable
              key={d.value}
              onPress={() =>
                setDecision.mutate({ id: item.subscriptionId, decision: on ? null : d.value })
              }
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className={cn(
                'h-10 flex-1 flex-row items-center justify-center gap-[5px] rounded-[12px]',
                on ? d.on : 'bg-bg',
              )}
            >
              <Icon
                name={d.icon}
                size={15}
                color={on ? d.color : colors['ink-2']}
                strokeWidth={2.2}
              />
              <Text weight="semibold" className={cn('text-[13px]', on ? d.onText : 'text-ink-2')}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
