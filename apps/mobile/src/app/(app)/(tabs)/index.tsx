import { FREE_LIMITS, type HomeDto } from '@subca/shared';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { FxAttribution } from '@/components/fx-attribution';
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
import { useInbox } from '@/features/detection/queries';
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
          <View className="h-11 w-11 items-center justify-center rounded-full bg-coral">
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
      <View className="overflow-hidden rounded-[22px] border border-line bg-mint p-5">
        <View className="mb-2 flex-row items-center justify-between">
          <Text weight="semibold" className="text-[12px] uppercase tracking-[1px] text-ink-brand">
            Bức tranh tháng {month}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.navigate('/analytics')}
            hitSlop={8}
          >
            <Text weight="semibold" className="text-[12px] text-ink-brand">
              Xem phân tích
            </Text>
          </Pressable>
        </View>
        <Text
          weight="extrabold"
          tabular
          className="text-[38px] leading-[44px] text-ink-brand"
          style={{ letterSpacing: -1.5 }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {total.value}
          <Text weight="bold" className="text-[18px] text-ink-brand">
            {total.unit}
          </Text>
        </Text>
        <Text className="text-[13px] leading-[18px] text-ink-2">
          ≈ {formatAmount(data.yearlyProjectionMinor, data.currency)} / năm
        </Text>
        <View className="mt-4 flex-row border-t border-line/70 pt-3">
          <View className="flex-1">
            <Text weight="bold" tabular className="text-[16px] leading-[21px]">
              {data.activeCount} <Text className="text-[12px] text-ink-2">đang theo dõi</Text>
            </Text>
          </View>
          <View className="flex-1">
            <Text weight="bold" tabular className="text-[16px] leading-[21px]">
              {data.dueIn7DaysCount} <Text className="text-[12px] text-ink-2">trong 7 ngày</Text>
            </Text>
          </View>
        </View>
      </View>

      {tracked === 0 ? <EmptyHome /> : <TrackedContent data={data} tracked={tracked} />}
    </>
  );
}

function TrackedContent({ data, tracked }: { data: HomeDto; tracked: number }) {
  const nextUp = data.upcoming[0];
  return (
    <>
      {data.missingRates.length > 0 ? (
        <Card tone="peach" className="mt-3 flex-row items-center gap-3 p-[14px]">
          <Icon name="alert" color={colors['on-peach']} />
          <Text className="flex-1 text-[13px] leading-[19px] text-on-peach">
            Chưa có tỷ giá {data.missingRates.join(', ')} nên các khoản này chưa được cộng vào tổng.
          </Text>
        </Card>
      ) : null}

      <AttentionSection />

      {nextUp ? (
        <View className="mt-5">
          <SectionHead
            title={nextUp.status === 'TRIAL' ? 'Mốc gần nhất' : 'Khoản sắp đến'}
            action={{ label: 'Lịch', href: '/calendar' }}
          />
          <UpcomingRow sub={nextUp} />
        </View>
      ) : null}

      {data.budget ? <BudgetCard budget={data.budget} currency={data.currency} /> : null}

      <QuickActions
        trialCount={data.trialCount}
        savings={formatShort(data.potentialSavingsMinor, data.currency)}
        planLabel={
          data.plan === 'PLUS' ? 'Subca Plus' : `${tracked}/${FREE_LIMITS.maxSubscriptions} gói`
        }
      />

      <SectionHead title="Lịch gia hạn" action={{ label: 'Xem tất cả', href: '/calendar' }} />
      {data.upcoming.length > (nextUp ? 1 : 0) ? (
        <View className="gap-[10px]">
          {data.upcoming.slice(nextUp ? 1 : 0).map((sub) => (
            <UpcomingRow key={sub.id} sub={sub} />
          ))}
        </View>
      ) : !nextUp ? (
        <Text className="mx-[2px] text-[14px] leading-[21px] text-ink-3">
          Chưa có khoản nào sắp bị trừ tiền.
        </Text>
      ) : null}

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
        title="Kết nối Gmail để tự tìm"
        icon="chev"
        className="mt-2 self-stretch"
        onPress={() => router.push('/connections')}
      />
      <Button
        title="Tự thêm bằng tay"
        variant="ghost"
        className="self-stretch"
        onPress={() => router.push('/add')}
      />
    </Card>
  );
}

/**
 * "Cần bạn chú ý" — việc Subca tự phát hiện nhưng chưa dám tự quyết (gói lạ, đổi giá,
 * thanh toán lỗi). Không có việc nào thì mục này biến mất.
 */
function AttentionSection() {
  const inbox = useInbox();
  const items = inbox.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <>
      <SectionHead title="Cần bạn chú ý" action={{ label: 'Xem tất cả', href: '/inbox' }} />
      <View className="gap-[10px]">
        {items.slice(0, 3).map((item) => (
          <Card key={item.id} tone="peach" onPress={() => router.push('/inbox')}>
            <View className="flex-row items-center gap-3">
              <Icon name="alert" color={colors['on-peach']} />
              <View className="flex-1">
                <Text weight="bold" className="text-[14.5px]">
                  {item.title}
                </Text>
                <Text className="text-[12.5px] leading-[18px] text-on-peach" numberOfLines={2}>
                  {item.body}
                </Text>
              </View>
              <Icon name="chev" size={18} color={colors['on-peach']} />
            </View>
          </Card>
        ))}
      </View>
    </>
  );
}

function QuickActions({
  trialCount,
  savings,
  planLabel,
}: {
  trialCount: number;
  savings: string;
  planLabel: string;
}) {
  return (
    <View className="mt-5">
      <SectionHead title="Lối tắt" />
      <View className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <QuickAction
          icon="hourglass"
          label="Trial đang chạy"
          value={String(trialCount)}
          href="/trials"
        />
        <QuickAction
          icon="piggy"
          label="Có thể tiết kiệm mỗi tháng"
          value={savings}
          href="/review"
        />
        <QuickAction icon="users" label="Chia tiền nhóm" value="Mở nhóm" href="/groups" />
        <QuickAction
          icon="sparkle"
          label="Hạn mức theo dõi"
          value={planLabel}
          href="/subscriptions"
          last
        />
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  value,
  href,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  href: Href;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.navigate(href)}
      className={`min-h-[56px] flex-row items-center gap-3 px-4 active:bg-bg ${last ? '' : 'border-b border-line'}`}
    >
      <Icon name={icon} size={18} color={colors['ink-3']} />
      <Text className="flex-1 text-[13px] text-ink-2">{label}</Text>
      <Text weight="semibold" className="text-[13px] text-ink-brand">
        {value}
      </Text>
      <Icon name="chev" size={16} color={colors['ink-3']} />
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
            <Icon name="target" size={16} color={colors['on-coral']} />
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
