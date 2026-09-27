import { daysInMonth, type CalendarDto, type CalendarItemDto } from '@subca/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { Screen } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Text } from '@/components/ui/text';
import { useCalendar } from '@/features/calendar/use-calendar';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/format';
import { colors, shadow } from '@/theme';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
/** Ngày phải trả từ 500.000đ trở lên tô màu đào (mockup: .day.heavy). Chỉ áp dụng cho VND. */
const HEAVY_VND = 500_000n;

function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Lịch gia hạn — màn 6 của mockup, dữ liệu từ `GET /calendar?month=`. */
export default function CalendarScreen() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [selected, setSelected] = useState<number | null>(null);
  const month = monthKey(ym.y, ym.m);
  const calendar = useCalendar(month);

  const shift = (delta: number) => {
    const index = ym.y * 12 + (ym.m - 1) + delta;
    setYm({ y: Math.floor(index / 12), m: (index % 12) + 1 });
    setSelected(null);
  };

  // Dữ liệu cũ đang hiện trong lúc tải tháng mới → chỉ dùng khi đúng tháng.
  const data = calendar.data?.month === month ? calendar.data : undefined;

  return (
    <Screen
      tabBar
      refreshControl={
        <RefreshControl
          refreshing={calendar.isRefetching && !calendar.isPlaceholderData}
          onRefresh={() => calendar.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <View className="mb-[18px] mt-[6px] min-h-11 flex-row items-center justify-between">
        <View>
          <Text className="text-[13px] leading-[18px] text-ink-3">Lịch gia hạn</Text>
          <Text
            weight="extrabold"
            className="text-[24px] leading-[30px]"
            style={{ letterSpacing: -0.6 }}
          >
            Tháng {ym.m}
          </Text>
        </View>
        <IconButton icon="bell" label="Thông báo" onPress={() => router.push('/notifications')} />
      </View>

      <View className="rounded-lg bg-surface px-3 pb-3 pt-4" style={{ boxShadow: shadow.sm }}>
        <View className="flex-row items-center justify-between px-1 pb-3">
          <Pressable
            onPress={() => shift(-1)}
            hitSlop={10}
            accessibilityLabel="Tháng trước"
            className="h-11 w-11 items-center justify-center"
          >
            <Icon name="back" />
          </Pressable>
          <Text weight="bold" className="text-[17px]">
            Tháng {ym.m}, {ym.y}
          </Text>
          <Pressable
            onPress={() => shift(1)}
            hitSlop={10}
            accessibilityLabel="Tháng sau"
            className="h-11 w-11 items-center justify-center"
          >
            <Icon name="chev" />
          </Pressable>
        </View>
        <MonthGrid
          y={ym.y}
          m={ym.m}
          data={data}
          selected={selected}
          onSelect={(d) => setSelected(selected === d ? null : d)}
        />
        <View className="flex-row gap-[14px] px-[6px] pb-[2px] pt-3">
          <Legend color={colors.mint} label="Có gia hạn" />
          <Legend color={colors.peach} label="Từ 500K" />
          <Legend outline label="Hôm nay" />
        </View>
      </View>

      {data ? (
        <MonthSummary data={data} selected={selected} onClear={() => setSelected(null)} m={ym.m} />
      ) : calendar.isError ? (
        <Card className="mt-3 items-center gap-3">
          <Text className="text-center text-ink-2">{calendar.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => calendar.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-10" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function MonthGrid({
  y,
  m,
  data,
  selected,
  onSelect,
}: {
  y: number;
  m: number;
  data: CalendarDto | undefined;
  selected: number | null;
  onSelect: (day: number) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarItemDto[]>();
    for (const d of data?.days ?? []) map.set(Number(d.date.slice(8, 10)), d.items);
    return map;
  }, [data]);

  const now = new Date();
  const todayDay = now.getFullYear() === y && now.getMonth() + 1 === m ? now.getDate() : null;
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dim = daysInMonth(y, m);
  const prevDim = daysInMonth(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
  const cells: { day: number; other: boolean }[] = [
    ...Array.from({ length: lead }, (_, i) => ({ day: prevDim - lead + i + 1, other: true })),
    ...Array.from({ length: dim }, (_, i) => ({ day: i + 1, other: false })),
  ];
  for (let i = 1; cells.length % 7 !== 0; i++) cells.push({ day: i, other: true });

  return (
    <View>
      <View className="flex-row">
        {WEEKDAYS.map((w) => (
          <Text
            key={w}
            weight="semibold"
            className="flex-1 py-1 text-center text-[11.5px] text-ink-3"
          >
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} className="mt-1 flex-row gap-1">
          {cells.slice(row * 7, row * 7 + 7).map((c, i) => {
            if (c.other) {
              return (
                <View
                  key={i}
                  className="flex-1 items-center pt-[7px]"
                  style={{ aspectRatio: 1 / 1.12 }}
                >
                  <Text className="text-[14px] text-[#B8BDB3]">{c.day}</Text>
                </View>
              );
            }
            const items = byDay.get(c.day) ?? [];
            const has = items.length > 0;
            const vndSum = items
              .filter((it) => it.currency === 'VND' && it.kind === 'RENEWAL')
              .reduce((sum, it) => sum + BigInt(it.amountMinor), 0n);
            const isSelected = selected === c.day;
            return (
              <Pressable
                key={i}
                disabled={!has}
                onPress={() => onSelect(c.day)}
                accessibilityRole={has ? 'button' : undefined}
                accessibilityLabel={has ? `Ngày ${c.day}, ${items.length} khoản` : undefined}
                className={cn(
                  'flex-1 items-center rounded-[14px] pt-[7px]',
                  has && (vndSum >= HEAVY_VND ? 'bg-peach' : 'bg-mint'),
                  isSelected && 'bg-ink',
                )}
                style={[
                  { aspectRatio: 1 / 1.12 },
                  c.day === todayDay && !isSelected
                    ? { boxShadow: `inset 0 0 0 2px ${colors.ink}` }
                    : null,
                ]}
              >
                <Text
                  weight={has ? 'bold' : 'medium'}
                  tabular
                  className={cn('text-[14px]', isSelected && 'text-white')}
                >
                  {c.day}
                </Text>
                {has ? (
                  <View className="mt-1 flex-row gap-[2px]">
                    {items.slice(0, 3).map((it, k) => (
                      <View
                        key={k}
                        className="h-[5px] w-[5px] rounded-full"
                        style={{
                          backgroundColor: isSelected
                            ? '#FFFFFF'
                            : (it.service?.brandColor ?? colors['ink-brand']),
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Legend({
  color,
  outline = false,
  label,
}: {
  color?: string;
  outline?: boolean;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-[6px]">
      <View
        className="h-3 w-3 rounded-[4px]"
        style={
          outline ? { boxShadow: `inset 0 0 0 2px ${colors.ink}` } : { backgroundColor: color }
        }
      />
      <Text className="text-[12px] text-ink-2">{label}</Text>
    </View>
  );
}

function MonthSummary({
  data,
  selected,
  onClear,
  m,
}: {
  data: CalendarDto;
  selected: number | null;
  onClear: () => void;
  m: number;
}) {
  const rows = data.days
    .filter((d) => selected === null || Number(d.date.slice(8, 10)) === selected)
    .flatMap((d) => d.items.map((item) => ({ day: Number(d.date.slice(8, 10)), item })));

  return (
    <>
      <Card tone="mint" className="mt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[13px] leading-[18px] text-[#3A5A4C]">
            Tổng cần trả trong tháng
          </Text>
          <Text weight="bold" tabular className="text-[22px] leading-[28px]">
            {formatAmount(data.totalMinor, data.currency)}
          </Text>
        </View>
        <Pill label={`${data.count} khoản`} tone="active" className="bg-surface" />
      </Card>
      {data.missingRates.length > 0 ? (
        <Text className="mx-1 mt-2 text-[12.5px] leading-[18px] text-on-peach">
          Chưa có tỷ giá {data.missingRates.join(', ')} nên các khoản này chưa được cộng vào tổng.
        </Text>
      ) : null}

      <View className="mx-[2px] mb-3 mt-[26px] flex-row items-baseline justify-between">
        <Text weight="bold" className="text-[17px] leading-[22px]">
          {selected ? `Ngày ${selected}/${m}` : 'Gia hạn trong tháng'}
        </Text>
        {selected ? (
          <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
            <Text weight="semibold" className="text-[14px] text-sky-deep">
              Xem tất cả
            </Text>
          </Pressable>
        ) : null}
      </View>

      {rows.length > 0 ? (
        <View className="gap-[10px]">
          {rows.map(({ day, item }) => (
            <Pressable
              key={`${item.subscriptionId}-${day}-${item.kind}`}
              onPress={() =>
                router.push({
                  pathname: '/subscriptions/[id]',
                  params: { id: item.subscriptionId },
                })
              }
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-md bg-surface p-[14px] active:scale-[0.985]"
              style={{ boxShadow: shadow.sm }}
            >
              <View className="h-[52px] w-12 items-center justify-center rounded-[14px] bg-bg">
                <Text weight="bold" tabular className="text-[18px] leading-[21px]">
                  {day}
                </Text>
                <Text weight="semibold" className="text-[10.5px] leading-[13px] text-ink-3">
                  TH{m}
                </Text>
              </View>
              <ServiceLogo name={item.name} service={item.service} size="sm" />
              <View className="min-w-0 flex-1">
                <Text weight="bold" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-[12.5px] text-ink-3">
                  {item.kind === 'TRIAL_END' ? 'Hết dùng thử' : 'Gia hạn'}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text weight="bold" tabular>
                  {formatAmount(item.amountMinor, item.currency)}
                </Text>
                {item.kind === 'TRIAL_END' ? <Pill label="Trial" tone="trial" /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text className="px-[10px] py-8 text-center text-ink-3">
          Tháng này không có khoản nào bị trừ tiền.
        </Text>
      )}
    </>
  );
}
