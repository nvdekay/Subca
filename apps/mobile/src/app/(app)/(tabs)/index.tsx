import { FREE_LIMITS, type HomeDto } from '@subca/shared';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { Screen } from '@/components/screen';
import { UpcomingRow } from '@/components/subscription-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useMe } from '@/features/auth/use-me';
import { useHome } from '@/features/home/use-home';
import { formatAmount, formatShort, greeting, splitAmount } from '@/lib/format';
import { colors } from '@/theme';

/** Trang chủ — dựng theo màn 2 của mockup, dữ liệu từ `GET /home`. */
export default function Home() {
  const home = useHome();
  const me = useMe();
  const name = me.data?.displayName ?? me.data?.email?.split('@')[0] ?? '';

  return (
    <Screen
      tabBar
      refreshControl={
        <RefreshControl
          refreshing={home.isRefetching}
          onRefresh={() => {
            home.refetch();
            me.refetch();
          }}
          tintColor={colors['ink-3']}
        />
      }
    >
      <View className="mb-5 mt-[6px] min-h-11 flex-row items-center justify-between">
        <Pressable
          className="flex-row items-center gap-3"
          accessibilityRole="button"
          accessibilityLabel="Mở hồ sơ"
          onPress={() => router.push('/profile')}
        >
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{
              experimental_backgroundImage: `linear-gradient(135deg, ${colors.coral}, ${colors.peach})`,
            }}
          >
            <Text weight="bold" className="text-on-coral">
              {(name[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text className="text-[13px] leading-[18px] text-ink-3">{greeting()}</Text>
            <Text weight="bold" className="text-[17px] leading-[22px]" numberOfLines={1}>
              {name || ' '}
            </Text>
          </View>
        </Pressable>
        <IconButton icon="bell" label="Thông báo" onPress={() => router.push('/notifications')} />
      </View>

      {home.data ? (
        <HomeContent data={home.data} />
      ) : home.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{home.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => home.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function HomeContent({ data }: { data: HomeDto }) {
  const total = splitAmount(data.monthlyTotalMinor, data.currency);
  const month = new Date().getMonth() + 1;
  const tracked = data.activeCount + data.trialCount;

  return (
    <>
      <View
        className="overflow-hidden rounded-[30px] p-[22px]"
        style={{
          experimental_backgroundImage:
            'linear-gradient(145deg, #A9D6DF 0%, #C9E6E0 55%, #DAEBE3 100%)',
        }}
      >
        {/* Vòng tròn trang trí góc phải (hero::after trong mockup) */}
        <View className="absolute -right-[50px] -top-[60px] h-[190px] w-[190px] rounded-full bg-[rgba(255,255,255,0.28)]" />
        <Text weight="semibold" className="text-[14px] text-[#1F3530]">
          Chi phí tháng {month}
        </Text>
        <Text
          weight="extrabold"
          tabular
          className="mb-1 mt-[6px] text-[38px] leading-[42px] text-[#1F3530]"
          style={{ letterSpacing: -1.5 }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {total.value}
          <Text weight="bold" className="text-[18px] text-[#1F3530]">
            {total.unit}
          </Text>
        </Text>
        <Text className="text-[13px] leading-[18px] text-[#34504A]">
          ≈ {formatAmount(data.yearlyProjectionMinor, data.currency)} / năm
        </Text>
        <View className="mt-4 flex-row gap-2">
          <HeroChip value={data.activeCount} label="Đang trả tiền" />
          <HeroChip value={data.dueIn7DaysCount} label="Gia hạn trong 7 ngày" />
        </View>
      </View>

      {tracked === 0 ? <EmptyHome /> : <TrackedContent data={data} tracked={tracked} />}
    </>
  );
}

function TrackedContent({ data, tracked }: { data: HomeDto; tracked: number }) {
  return (
    <>
      {data.missingRates.length > 0 ? (
        <Card tone="peach" className="mt-3 flex-row items-center gap-3 p-[14px]">
          <Icon name="alert" color="#8A4B1E" />
          <Text className="flex-1 text-[13px] leading-[19px] text-on-peach">
            Chưa có tỷ giá {data.missingRates.join(', ')} nên các khoản này chưa được cộng vào tổng.
          </Text>
        </Card>
      ) : null}

      <View className="mt-3 flex-row gap-3">
        <StatTile
          bg={colors['sky-soft']}
          icon="clock"
          value={String(data.dueIn7DaysCount)}
          label="Sắp gia hạn (7 ngày)"
          href="/calendar"
        />
        <StatTile
          bg={colors.peach}
          icon="hourglass"
          value={String(data.trialCount)}
          label="Trial đang chạy"
          href="/trials"
        />
      </View>
      <View className="mt-3 flex-row gap-3">
        <StatTile
          bg={colors.mint}
          icon="piggy"
          value={formatShort(data.potentialSavingsMinor, data.currency)}
          label="Có thể tiết kiệm / tháng"
          href="/review"
        />
        <StatTile
          bg={colors.stone}
          icon="sparkle"
          value={data.plan === 'PLUS' ? 'Plus' : `${tracked}/${FREE_LIMITS.maxSubscriptions}`}
          label={data.plan === 'PLUS' ? 'Không giới hạn subscription' : 'Subscription gói Free'}
          href="/subscriptions"
        />
      </View>

      {data.budget ? <BudgetCard budget={data.budget} currency={data.currency} /> : null}

      <SectionHead title="Sắp gia hạn" action={{ label: 'Xem tất cả', href: '/subscriptions' }} />
      {data.upcoming.length > 0 ? (
        <View className="gap-[10px]">
          {data.upcoming.map((sub) => (
            <UpcomingRow key={sub.id} sub={sub} />
          ))}
        </View>
      ) : (
        <Text className="mx-[2px] text-[14px] leading-[21px] text-ink-3">
          Chưa có khoản nào sắp bị trừ tiền.
        </Text>
      )}

      {data.trials.length > 0 ? (
        <>
          <SectionHead title="Trial đang chạy" />
          <View className="gap-[10px]">
            {data.trials.map((sub) => (
              <UpcomingRow key={sub.id} sub={sub} />
            ))}
          </View>
        </>
      ) : null}

      <FxAttribution />
    </>
  );
}

/** Tài khoản mới: thay 4 ô toàn số 0 bằng lời mời thêm subscription đầu tiên. */
function EmptyHome() {
  return (
    <Card className="mt-3 items-center gap-3 px-6 py-8">
      <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-sky-soft">
        <Icon name="plus" size={26} color={colors['sky-deep']} strokeWidth={2.2} />
      </View>
      <Text weight="bold" className="text-[17px] leading-[22px]">
        Thêm subscription đầu tiên
      </Text>
      <Text className="text-center text-[14px] leading-[21px] text-ink-3">
        Netflix, Spotify, iCloud… Thêm các gói bạn đang trả tiền để biết mỗi tháng tốn bao nhiêu và
        được nhắc trước ngày bị trừ tiền.
      </Text>
      <Button
        title="Thêm subscription"
        icon="chev"
        className="mt-2 self-stretch"
        onPress={() => router.push('/add')}
      />
    </Card>
  );
}

function HeroChip({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 rounded-[16px] bg-[rgba(255,255,255,0.58)] px-3 py-[10px]">
      <Text weight="bold" tabular className="text-[17px] leading-[22px]">
        {value}
      </Text>
      <Text className="text-[12px] leading-[17px] text-[#34504A]">{label}</Text>
    </View>
  );
}

function StatTile({
  bg,
  icon,
  value,
  label,
  href,
}: {
  bg: string;
  icon: IconName;
  value: string;
  label: string;
  href?: Href;
}) {
  const body: ReactNode = (
    <>
      <View className="h-9 w-9 items-center justify-center rounded-[12px] bg-[rgba(255,255,255,0.7)]">
        <Icon name={icon} />
      </View>
      <View>
        <Text
          weight="bold"
          tabular
          className="mt-[10px] text-[22px] leading-[28px]"
          style={{ letterSpacing: -0.66 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        <Text weight="medium" className="text-[12.5px] leading-[17px] text-ink-2">
          {label}
        </Text>
      </View>
    </>
  );
  const className = 'min-h-[118px] flex-1 justify-between rounded-md p-4';
  if (!href) {
    return (
      <View className={className} style={{ backgroundColor: bg }}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.navigate(href)}
      className={`${className} active:scale-[0.97]`}
      style={{ backgroundColor: bg }}
    >
      {body}
    </Pressable>
  );
}

function BudgetCard({
  budget,
  currency,
}: {
  budget: NonNullable<HomeDto['budget']>;
  currency: HomeDto['currency'];
}) {
  const over = budget.overBudget;
  return (
    <Card className="mt-3" onPress={() => router.push('/budget')}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-[10px]">
          <View className="h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-coral">
            <Icon name="target" size={16} color="#7A2E17" />
          </View>
          <Text weight="bold">Ngân sách subscription</Text>
        </View>
        <Pill
          tone={over ? 'warn' : 'active'}
          icon={over ? 'alert' : undefined}
          label={over ? `Vượt ${budget.percent - 100}%` : `Đã dùng ${budget.percent}%`}
        />
      </View>
      <View className="mt-4">
        <Progress percent={budget.percent} over={over} />
      </View>
      <View className="mt-2 flex-row justify-between">
        <Text tabular className="text-[13px]">
          <Text weight="bold" className="text-[13px]">
            {formatAmount(budget.spentMinor, currency)}
          </Text>{' '}
          <Text className="text-[13px] text-ink-3">đã chi</Text>
        </Text>
        <Text tabular className="text-[13px] text-ink-3">
          Hạn mức {formatAmount(budget.amountMinor, budget.currency)}
        </Text>
      </View>
    </Card>
  );
}

function SectionHead({ title, action }: { title: string; action?: { label: string; href: Href } }) {
  return (
    <View className="mx-[2px] mb-3 mt-[26px] flex-row items-baseline justify-between">
      <Text weight="bold" className="text-[17px] leading-[22px]" style={{ letterSpacing: -0.17 }}>
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate(action.href)}
          hitSlop={8}
        >
          <Text weight="semibold" className="text-[14px] text-sky-deep">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Điều khoản ExchangeRate-API bắt buộc ghi nguồn ở nơi hiện số đã quy đổi. */
function FxAttribution() {
  return (
    <Pressable
      accessibilityRole="link"
      className="mt-6 items-center"
      onPress={() => WebBrowser.openBrowserAsync('https://www.exchangerate-api.com')}
    >
      <Text className="text-[12px] leading-[17px] text-ink-3">
        Tổng đã quy đổi theo tỷ giá{' '}
        <Text className="text-[12px] text-sky-deep underline">Rates By Exchange Rate API</Text>
      </Text>
    </Pressable>
  );
}
