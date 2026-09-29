import type { AnalyticsDto, CurrencyCode } from '@subca/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { FxAttribution } from '@/components/fx-attribution';
import { Screen } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { USAGE_LEVELS } from '@/features/subscriptions/labels';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatAmount, formatShort } from '@/lib/format';
import { colors } from '@/theme';

const TREND_HEIGHT = 140;

/** Phân tích chi tiêu — màn 9 của mockup (đã bỏ phần theo danh mục), dữ liệu từ `GET /analytics`. */
export default function Analytics() {
  const analytics = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api<AnalyticsDto>('/analytics'),
  });

  return (
    <Screen
      tabBar
      refreshControl={
        <RefreshControl
          refreshing={analytics.isRefetching}
          onRefresh={() => analytics.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <View className="mb-5 mt-[6px]">
        <Text className="text-[11px] uppercase tracking-[1px] text-ink-3">BẢN ĐỒ CHI TIÊU</Text>
        <Text weight="extrabold" className="mt-1 text-[28px] leading-[34px]">
          Tiền đi đâu?
        </Text>
      </View>
      {analytics.data ? (
        <AnalyticsBody data={analytics.data} />
      ) : analytics.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{analytics.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => analytics.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function AnalyticsBody({ data }: { data: AnalyticsDto }) {
  if (data.monthlyTotalMinor === '0' && data.topExpensive.length === 0) {
    return (
      <Card className="items-center gap-3 py-8">
        <Text weight="bold">Chưa có số liệu</Text>
        <Text className="text-center text-[14px] leading-[21px] text-ink-3">
          Thêm các gói đang trả tiền để xem mỗi tháng tiền đi đâu.
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
      <View className="rounded-sm border border-line bg-mint p-5">
        <Text className="text-[12px] uppercase tracking-[1px] text-ink-brand">
          Đang chi mỗi tháng
        </Text>
        <Text
          weight="extrabold"
          tabular
          className="mt-1 text-[34px] leading-[42px] text-ink-brand"
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {formatAmount(data.monthlyTotalMinor, data.currency)}
        </Text>
        <Text className="text-[13px] text-ink-2">
          Tương đương {formatShort(data.yearlyProjectionMinor, data.currency)} mỗi năm
        </Text>
      </View>

      {data.missingRates.length > 0 ? (
        <Card tone="peach" className="mt-3 flex-row items-center gap-3 p-[14px]">
          <Text className="flex-1 text-[12.5px] leading-[18px] text-on-peach">
            Chưa có tỷ giá {data.missingRates.join(', ')} nên một số khoản chưa được tính.
          </Text>
        </Card>
      ) : null}

      <TrendChart trend={data.trend} currency={data.currency} />

      <View className="mt-3">
        <StatCard
          label="Trung bình / ngày"
          value={formatAmount(data.dailyAverageMinor, data.currency)}
          note={data.currency === 'VND' ? cafeNote(data.dailyAverageMinor) : undefined}
        />
      </View>

      {data.costPerUse.length > 0 ? (
        <ChartCard
          title="Chi phí mỗi lần dùng"
          note="Giá tháng ÷ số lần dùng ước tính theo mức độ sử dụng bạn chọn"
        >
          {data.costPerUse.map((c, i) => (
            <Row
              key={c.subscriptionId}
              first={i === 0}
              left={<ServiceLogo name={c.name} service={c.service} size="sm" />}
              title={c.name}
              subtitle={`${USAGE_LEVELS.find((l) => l.value === c.usageFrequency)?.label ?? ''} · ~${c.usesPerMonth} lần/tháng`}
              value={
                c.usesPerMonth > 0
                  ? `${formatAmount(c.costPerUseMinor, data.currency)}/lần`
                  : 'Không dùng'
              }
              onPress={() =>
                router.push({ pathname: '/subscriptions/[id]', params: { id: c.subscriptionId } })
              }
            />
          ))}
        </ChartCard>
      ) : (
        <ChartCard title="Chi phí mỗi lần dùng">
          <Text className="text-[13.5px] leading-[20px] text-ink-3">
            Chọn “Mức độ sử dụng” ở màn Chi tiết của từng gói để biết mỗi lần dùng tốn bao nhiêu.
          </Text>
        </ChartCard>
      )}

      <ChartCard title="Top đắt nhất">
        {data.topExpensive.map((t, i) => (
          <Row
            key={t.subscriptionId}
            first={i === 0}
            left={
              <Text weight="bold" tabular className="w-5 text-center text-ink-3">
                {i + 1}
              </Text>
            }
            title={t.name}
            value={`${formatAmount(t.monthlyMinor, data.currency)}/tháng`}
            onPress={() =>
              router.push({ pathname: '/subscriptions/[id]', params: { id: t.subscriptionId } })
            }
            logo={<ServiceLogo name={t.name} service={t.service} size="sm" />}
          />
        ))}
      </ChartCard>

      <ChartCard
        title="Theo phương thức thanh toán"
        right={
          <Pressable onPress={() => router.push('/payments')} hitSlop={8} accessibilityRole="link">
            <Text weight="semibold" className="text-[13px] text-sky-deep">
              Chi tiết
            </Text>
          </Pressable>
        }
      >
        <View className="gap-[14px] pt-1">
          {data.byPaymentMethod.map((p) => (
            <View key={p.id ?? 'none'}>
              <View className="mb-[6px] flex-row justify-between">
                <Text className="flex-1 text-[13.5px]" numberOfLines={1}>
                  {p.label}
                </Text>
                <Text weight="semibold" tabular className="text-[13.5px]">
                  {formatAmount(p.monthlyMinor, data.currency)} · {p.percent}%
                </Text>
              </View>
              <View className="h-2 overflow-hidden rounded-[4px] bg-stone">
                <View
                  className="h-full rounded-[4px] bg-sky-deep"
                  style={{ width: `${Math.max(p.percent, 1)}%` }}
                />
              </View>
            </View>
          ))}
        </View>
      </ChartCard>

      <FxAttribution label="Số đã quy đổi theo tỷ giá" />
    </>
  );
}

/** Quy trung bình/ngày ra số ly cà phê 30.000đ cho dễ hình dung. */
function cafeNote(dailyMinor: string): string {
  const cups = Number(dailyMinor) / 30_000;
  if (cups < 0.75) return 'chưa tới 1 ly cà phê';
  return `≈ ${Math.round(cups)} ly cà phê`;
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="flex-1 p-4">
      <Text className="text-[13px] text-ink-3">{label}</Text>
      <Text
        weight="bold"
        tabular
        className="text-[22px] leading-[28px]"
        style={{ letterSpacing: -0.66 }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {note ? <Text className="text-[12.5px] text-ink-3">{note}</Text> : null}
    </Card>
  );
}

function ChartCard({
  title,
  note,
  right,
  children,
}: {
  title: string;
  note?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="mt-3">
      <View className="flex-row items-center justify-between">
        <Text weight="bold" className="text-[16px]">
          {title}
        </Text>
        {right}
      </View>
      {note ? (
        <Text className="mb-1 mt-1 text-[12.5px] leading-[18px] text-ink-3">{note}</Text>
      ) : null}
      <View className="mt-2">{children}</View>
    </Card>
  );
}

function Row({
  left,
  logo,
  title,
  subtitle,
  value,
  onPress,
  first,
}: {
  left: ReactNode;
  logo?: ReactNode;
  title: string;
  subtitle?: string;
  value: string;
  onPress: () => void;
  first: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn('flex-row items-center gap-3 py-[10px]', !first && 'border-t border-line')}
    >
      {left}
      {logo}
      <View className="min-w-0 flex-1">
        <Text weight="semibold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text className="text-[12.5px] text-ink-3">{subtitle}</Text> : null}
      </View>
      <Text weight="bold" tabular className="text-[14px]">
        {value}
      </Text>
    </Pressable>
  );
}

/**
 * Xu hướng 6 tháng: cột một màu, bấm cột để xem số tiền (thay cho tooltip khi rê chuột).
 * Mặc định chọn tháng mới nhất để luôn có một con số hiện ra.
 */
function TrendChart({ trend, currency }: { trend: AnalyticsDto['trend']; currency: CurrencyCode }) {
  const [selected, setSelected] = useState(trend.length - 1);
  const max = trend.reduce((m, t) => (BigInt(t.totalMinor) > m ? BigInt(t.totalMinor) : m), 0n);
  const current = trend[selected];

  return (
    <ChartCard title="Xu hướng 6 tháng">
      {current ? (
        <Text className="mb-3 text-[13px] text-ink-3">
          Tháng {Number(current.month.slice(5, 7))}/{current.month.slice(0, 4)}:{' '}
          <Text weight="bold" tabular className="text-[13px] text-ink">
            {formatAmount(current.totalMinor, currency)}
          </Text>
        </Text>
      ) : null}
      <View className="flex-row items-end gap-[2px]" style={{ height: TREND_HEIGHT }}>
        {trend.map((t, i) => {
          const value = BigInt(t.totalMinor);
          const h =
            max > 0n ? Math.max(4, Math.round((Number(value) / Number(max)) * TREND_HEIGHT)) : 4;
          const on = i === selected;
          return (
            <Pressable
              key={t.month}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityLabel={`Tháng ${Number(t.month.slice(5, 7))}: ${formatAmount(t.totalMinor, currency)}`}
              accessibilityState={{ selected: on }}
              // Vùng bấm cao cả biểu đồ, rộng hơn cột để dễ chạm.
              className="h-full flex-1 items-center justify-end"
            >
              <View
                className={cn('w-[60%] rounded-t-[4px]', on ? 'bg-ink' : 'bg-sky-deep')}
                style={{ height: h }}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row gap-[2px] border-t border-line pt-2">
        {trend.map((t, i) => (
          <Text
            key={t.month}
            weight={i === selected ? 'bold' : 'regular'}
            className={cn(
              'flex-1 text-center text-[12px]',
              i === selected ? 'text-ink' : 'text-ink-3',
            )}
          >
            Th{Number(t.month.slice(5, 7))}
          </Text>
        ))}
      </View>
      {trend.some((t) => t.totalMinor === '0') ? (
        <Text className="mt-3 text-[12.5px] leading-[18px] text-ink-3">
          Tháng hiện 0đ là trước khi bạn thêm subscription vào Subca.
        </Text>
      ) : null}
    </ChartCard>
  );
}
