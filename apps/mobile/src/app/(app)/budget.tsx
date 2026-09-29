import type { HomeDto, ReviewItemDto, UsageFrequency } from '@subca/shared';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Screen, TopBar } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { BudgetSheet } from '@/features/account/budget-sheet';
import { useHome } from '@/features/home/use-home';
import { useReview } from '@/features/review/queries';
import { USAGE_LEVELS } from '@/features/subscriptions/labels';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/format';
import { colors, shadow } from '@/theme';

/** Nửa vòng tròn bán kính 90 (mockup: .gauge, viewBox 220×124). */
const ARC = 'M20 112a90 90 0 0 1 180 0';
const ARC_LENGTH = Math.PI * 90;
const MAX_CANDIDATES = 6;

/** Ít dùng xếp trước: gợi ý hủy những gói tốn tiền mà hiếm khi mở. */
const USAGE_RANK: Record<UsageFrequency, number> = {
  NEVER: 0,
  RARELY: 1,
  SOMETIMES: 2,
  WEEKLY: 3,
  SEVERAL_PER_WEEK: 4,
  DAILY: 5,
};

/** Ngân sách — màn 10 của mockup: tiến độ hạn mức + mô phỏng "nếu hủy thì tiết kiệm bao nhiêu". */
export default function Budget() {
  const home = useHome();
  const review = useReview();
  const [editing, setEditing] = useState(false);
  const budget = home.data?.budget ?? null;
  const currency = home.data?.currency ?? 'VND';

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={home.isRefetching}
          onRefresh={() => {
            home.refetch();
            review.refetch();
          }}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar
        title="Ngân sách"
        right={
          budget ? (
            <IconButton icon="edit" label="Sửa hạn mức" onPress={() => setEditing(true)} />
          ) : undefined
        }
      />

      {home.data ? (
        budget ? (
          <>
            <BudgetHero budget={budget} currency={currency} />
            <Simulator
              items={review.data?.items ?? []}
              loading={review.isLoading}
              currency={currency}
            />
          </>
        ) : (
          <Card className="items-center gap-3 px-6 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-sm bg-mint">
              <Icon name="target" size={26} color={colors['on-mint']} />
            </View>
            <Text weight="bold" className="text-[17px]">
              Chưa đặt ngân sách
            </Text>
            <Text className="text-center text-[14px] leading-[21px] text-ink-3">
              Đặt hạn mức mỗi tháng cho subscription, Subca sẽ cảnh báo khi bạn sắp vượt.
            </Text>
            <Button
              title="Đặt ngân sách"
              icon="plus"
              className="mt-2 self-stretch"
              onPress={() => setEditing(true)}
            />
          </Card>
        )
      ) : home.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{home.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => home.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}

      {editing ? (
        <BudgetSheet
          currency={currency}
          current={budget ? { amountMinor: budget.amountMinor, currency: budget.currency } : null}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </Screen>
  );
}

function BudgetHero({
  budget,
  currency,
}: {
  budget: NonNullable<HomeDto['budget']>;
  currency: HomeDto['currency'];
}) {
  const over = budget.overBudget;
  const spent = BigInt(budget.spentMinor);
  // Hạn mức có thể khác tiền tệ chính; phần chênh lệch chỉ tính khi cùng tiền tệ để khỏi đoán tỷ giá.
  const sameCurrency = budget.currency === currency;
  const diff = sameCurrency ? BigInt(budget.amountMinor) - spent : null;
  const now = new Date();

  return (
    <>
      <Card className="items-center px-5 py-[26px]">
        <View style={{ width: 220, height: 124 }}>
          <Svg width={220} height={124} viewBox="0 0 220 124">
            <Path d={ARC} fill="none" stroke={colors.line} strokeWidth={18} strokeLinecap="round" />
            <Path
              d={ARC}
              fill="none"
              stroke={over ? colors['coral-deep'] : colors['ink-brand']}
              strokeWidth={18}
              strokeLinecap="round"
              strokeDasharray={`${(Math.min(budget.percent, 100) / 100) * ARC_LENGTH} ${ARC_LENGTH}`}
            />
          </Svg>
          <View className="absolute bottom-0 left-0 right-0 items-center">
            <Text
              weight="bold"
              tabular
              className="text-[24px] leading-[30px]"
              style={{ letterSpacing: -0.7 }}
            >
              {formatAmount(budget.spentMinor, currency)}
            </Text>
            <Text tabular className="text-[13px] text-ink-3">
              trên {formatAmount(budget.amountMinor, budget.currency)}
            </Text>
          </View>
        </View>
        <View className="mt-5 self-stretch">
          <Progress percent={budget.percent} over={over} />
        </View>
        <View className="mt-2 flex-row justify-between self-stretch">
          <Text className="text-[13px] text-ink-3">
            Tháng {now.getMonth() + 1}/{now.getFullYear()}
          </Text>
          <Text weight="bold" tabular className="text-[13px]">
            {budget.percent}%
          </Text>
        </View>
      </Card>

      <View
        className={cn(
          'mt-3 flex-row gap-[10px] rounded-md p-[14px]',
          over ? 'bg-coral' : 'bg-mint',
        )}
      >
        <Icon
          name={over ? 'alert' : 'check-circle'}
          color={over ? colors['on-coral'] : colors['on-mint']}
        />
        <View className="flex-1">
          <Text weight="bold" className={over ? 'text-on-coral' : 'text-on-mint'}>
            {over
              ? diff !== null
                ? `Bạn đã vượt ngân sách ${formatAmount(-diff, currency)}`
                : 'Bạn đã vượt ngân sách'
              : diff !== null
                ? `Bạn còn ${formatAmount(diff, currency)} trong ngân sách`
                : 'Chi tiêu đang trong ngân sách'}
          </Text>
          <Text
            className={cn('text-[13.5px] leading-[20px]', over ? 'text-on-coral' : 'text-on-mint')}
          >
            {over
              ? 'Thử hủy vài subscription ít dùng bên dưới để quay lại hạn mức.'
              : 'Chi tiêu subscription đang trong tầm kiểm soát.'}
          </Text>
        </View>
      </View>
    </>
  );
}

/**
 * Mô phỏng: chọn gói muốn hủy → cộng số tiết kiệm. Chỉ để tính thử, không đổi dữ liệu.
 * Chọn sẵn các gói đã đánh dấu "Hủy" ở màn Đánh giá tháng.
 */
function Simulator({
  items,
  loading,
  currency,
}: {
  items: ReviewItemDto[];
  loading: boolean;
  currency: HomeDto['currency'];
}) {
  const candidates = useMemo(
    () =>
      items
        .filter((i) => i.status !== 'TRIAL' && i.monthlyMinor !== '0')
        .sort(
          (a, b) =>
            (a.usageFrequency ? USAGE_RANK[a.usageFrequency] : 2.5) -
              (b.usageFrequency ? USAGE_RANK[b.usageFrequency] : 2.5) ||
            Number(BigInt(b.monthlyMinor) - BigInt(a.monthlyMinor)),
        )
        .slice(0, MAX_CANDIDATES),
    [items],
  );
  // Người dùng đã bấm thì dùng lựa chọn của họ; chưa bấm thì lấy theo quyết định "Hủy" ở Đánh giá tháng.
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selected =
    picked ?? new Set(items.filter((i) => i.decision === 'CANCEL').map((i) => i.subscriptionId));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const saving = candidates
    .filter((c) => selected.has(c.subscriptionId))
    .reduce((sum, c) => sum + BigInt(c.monthlyMinor), 0n);

  return (
    <>
      <Text weight="bold" className="mx-[2px] mb-3 mt-[26px] text-[17px] leading-[23px]">
        Nếu hủy những subscription này thì tiết kiệm bao nhiêu?
      </Text>
      <View className="rounded-lg bg-surface px-[18px] py-[6px]" style={{ boxShadow: shadow.sm }}>
        {loading ? (
          <ActivityIndicator className="my-6" color={colors['ink-3']} />
        ) : candidates.length === 0 ? (
          <Text className="py-4 text-center text-ink-3">Chưa có gói nào để mô phỏng.</Text>
        ) : (
          candidates.map((c, i) => {
            const on = selected.has(c.subscriptionId);
            const usage = USAGE_LEVELS.find((l) => l.value === c.usageFrequency)?.label;
            return (
              <Pressable
                key={c.subscriptionId}
                onPress={() => toggle(c.subscriptionId)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Chọn ${c.name}`}
                className={cn('flex-row items-center gap-3 py-3', i > 0 && 'border-t border-line')}
              >
                <ServiceLogo name={c.name} service={c.service} size="sm" />
                <View className="flex-1">
                  <Text weight="bold" className="text-[14.5px]" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text className="text-[12.5px] text-ink-3">
                    {usage ? `${usage} · ` : ''}
                    {formatAmount(c.monthlyMinor, currency)}/tháng
                  </Text>
                </View>
                <View
                  className={cn(
                    'h-7 w-7 items-center justify-center rounded-sm border-2',
                    on ? 'border-ink bg-ink' : 'border-sage bg-surface',
                  )}
                >
                  {on ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.6} /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
      <View className="mt-[14px] flex-row items-center justify-between rounded-md bg-ink px-[18px] py-4">
        <View>
          <Text className="text-[13px] text-white opacity-80">Tiết kiệm mỗi tháng</Text>
          <Text weight="bold" tabular className="text-[22px] leading-[28px] text-white">
            {formatAmount(saving, currency)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[13px] text-white opacity-80">Mỗi năm</Text>
          <Text weight="bold" tabular className="text-[17px] text-white">
            {formatAmount(saving * 12n, currency)}
          </Text>
        </View>
      </View>
      <Text className="mx-1 mt-2 text-[12.5px] leading-[18px] text-ink-3">
        Chỉ để tính thử, không thay đổi subscription nào. Muốn hủy thật thì vào màn Đánh giá tháng
        hoặc Chi tiết.
      </Text>
    </>
  );
}
