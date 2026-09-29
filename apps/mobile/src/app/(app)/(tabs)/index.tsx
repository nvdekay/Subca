import { FREE_LIMITS, type HomeDto } from '@subca/shared';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { FxAttribution } from '@/components/fx-attribution';
import { Screen } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { UpcomingRow } from '@/components/subscription-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Text } from '@/components/ui/text';
import { useMe } from '@/features/auth/use-me';
import { useInbox } from '@/features/detection/queries';
import { useHome } from '@/features/home/use-home';
import {
  formatAmount,
  formatShort,
  formatShortDate,
  greeting,
  perInterval,
  relativeDay,
  splitAmount,
} from '@/lib/format';
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
          <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FD7014]">
            <Text weight="extrabold" className="text-[#222831]">
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
      <View className="pb-4">
        <View className="flex-row items-center justify-between">
          <View className="rounded-sm border-2 border-ink bg-peach px-3 py-1.5">
            <Text weight="extrabold" className="text-[11px] uppercase tracking-[0.8px] text-ink">
              Tháng {month} · Tổng quan
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.navigate('/analytics')}
            hitSlop={8}
            className="flex-row items-center gap-1 rounded-sm border-2 border-ink bg-surface px-3 py-1.5"
            style={{ boxShadow: '0 3px 0 #202B34' }}
          >
            <Text weight="extrabold" className="text-[11px] text-ink">
              Phân tích
            </Text>
            <Icon name="chev" size={13} color={colors.accent} />
          </Pressable>
        </View>
        <View className="mt-7 flex-row items-center gap-2">
          <View className="h-5 w-1.5 bg-accent" />
          <Text weight="extrabold" className="text-[12px] uppercase tracking-[1px] text-ink-2">
            Chi phí subscription mỗi tháng
          </Text>
        </View>
        <Text
          weight="extrabold"
          tabular
          className="mt-1 text-[48px] leading-[56px] text-ink"
          style={{ letterSpacing: -1.7 }}
          numberOfLines={1}
        >
          {total.value}
          <Text weight="extrabold" className="text-[24px] text-accent">
            {total.unit}
          </Text>
        </Text>
        <Text className="mt-1 text-[13px] text-ink-3">
          Ước tính{' '}
          <Text weight="extrabold" className="text-ink-2">
            {formatAmount(data.yearlyProjectionMinor, data.currency)}
          </Text>{' '}
          mỗi năm
        </Text>

        <View className="mb-4 mt-6 h-[2px] bg-ink" />
        <View className="flex-row gap-2">
          <HeroStat value={data.activeCount} label="Gói trả phí" tone="mint" />
          <HeroStat value={data.trialCount} label="Đang dùng thử" tone="peach" />
          <HeroStat
            value={data.dueIn7DaysCount}
            label="Đến hạn · 7 ngày"
            highlight={data.dueIn7DaysCount > 0}
            tone="sky"
          />
        </View>
      </View>

      {tracked === 0 ? <EmptyHome /> : <TrackedContent data={data} tracked={tracked} />}
    </>
  );
}

function HeroStat({
  value,
  label,
  highlight = false,
  tone,
}: {
  value: number;
  label: string;
  highlight?: boolean;
  tone: 'mint' | 'peach' | 'sky';
}) {
  const background = tone === 'mint' ? colors.mint : tone === 'peach' ? colors.peach : colors.sky;
  return (
    <View
      className="min-h-[70px] flex-1 justify-center rounded-sm border-2 border-ink px-2.5 py-2"
      style={{
        backgroundColor: highlight ? colors.coral : background,
        boxShadow: '0 3px 0 #202B34',
      }}
    >
      <Text
        weight="extrabold"
        tabular
        className="text-[23px] leading-[26px]"
        style={{ color: highlight ? colors['coral-deep'] : colors['ink-brand'] }}
      >
        {value}
      </Text>
      <Text numberOfLines={2} className="text-[10px] leading-[13px] text-ink-2">
        {label}
      </Text>
    </View>
  );
}

function TrackedContent({ data, tracked }: { data: HomeDto; tracked: number }) {
  const nextUp = data.upcoming[0];
  return (
    <>
      {data.missingRates.length > 0 ? (
        <Card className="mt-3 flex-row items-center gap-3 border-[#E8C99B] bg-[#FFF5E3] p-[14px]">
          <Icon name="alert" color="#A66B19" />
          <Text className="flex-1 text-[13px] leading-[19px] text-ink-2">
            Chưa có tỷ giá {data.missingRates.join(', ')} nên các khoản này chưa được cộng vào tổng.
          </Text>
        </Card>
      ) : null}

      <AttentionSection />

      {nextUp ? (
        <View className="mt-5">
          <SectionHead title="Sắp bị trừ" action={{ label: 'Lịch', href: '/calendar' }} />
          <FeaturedUpcoming sub={nextUp} />
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

function FeaturedUpcoming({ sub }: { sub: HomeDto['upcoming'][number] }) {
  const days = sub.daysUntilRenewal;
  const renewalLabel = sub.nextRenewalDate ? formatShortDate(sub.nextRenewalDate) : 'Sắp tới';
  return (
    <Card
      className="border-[#F0D5B8] bg-[#FFF8F0] p-4"
      onPress={() => router.push({ pathname: '/subscriptions/[id]', params: { id: sub.id } })}
    >
      <View className="flex-row items-center gap-3">
        <ServiceLogo name={sub.name} service={sub.service} size="md" />
        <View className="min-w-0 flex-1">
          <Text weight="bold" numberOfLines={1} className="text-[15px]">
            {sub.name}
          </Text>
          <Text className="text-[12px] leading-[17px] text-ink-3" numberOfLines={1}>
            {renewalLabel} · {perInterval(sub.intervalUnit, sub.intervalCount)}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text weight="extrabold" tabular className="text-[14px]">
            {formatAmount(sub.amountMinor, sub.currency)}
          </Text>
          {days != null ? (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: days <= 3 ? '#FBE3DF' : '#FFE8C9' }}
            >
              <Text
                weight="bold"
                className="text-[10px]"
                style={{ color: days <= 3 ? '#A33B32' : '#9B641E' }}
              >
                {relativeDay(days)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** Tài khoản mới: thay 4 ô toàn số 0 bằng lời mời thêm subscription đầu tiên. */
function EmptyHome() {
  return (
    <Card className="mt-3 items-center gap-3 border-[#F0D5B8] bg-[#FFF8F0] px-6 py-7">
      <View className="h-16 w-16 items-center justify-center rounded-sm bg-[#FFE5CB]">
        <Icon name="sparkle" size={28} color="#C65312" strokeWidth={2.2} />
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
          <Card
            key={item.id}
            tone="peach"
            className="border-[#F0D29F] bg-[#FFF6E7] p-4"
            onPress={() => router.push('/inbox')}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-sm bg-[#FFE5B9]">
                <Icon name="alert" color="#B36D16" />
              </View>
              <View className="flex-1">
                <Text weight="bold" className="text-[14.5px]">
                  {item.title}
                </Text>
                <Text className="text-[12.5px] leading-[18px] text-ink-3" numberOfLines={2}>
                  {item.body}
                </Text>
              </View>
              <Icon name="chev" size={18} color="#B36D16" />
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
      <View className="gap-2">
        <View className="flex-row gap-2">
          <QuickAction
            icon="hourglass"
            label="Trial đang chạy"
            value={String(trialCount)}
            href="/trials"
            tone="amber"
          />
          <QuickAction
            icon="piggy"
            label="Có thể tiết kiệm / tháng"
            value={savings}
            href="/review"
            tone="orange"
          />
        </View>
        <View className="flex-row gap-2">
          <QuickAction
            icon="users"
            label="Chia tiền nhóm"
            value="Mở nhóm"
            href="/groups"
            tone="blue"
          />
          <QuickAction
            icon="sparkle"
            label="Hạn mức theo dõi"
            value={planLabel}
            href="/subscriptions"
            tone="green"
          />
        </View>
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  href: Href;
  tone: 'amber' | 'orange' | 'blue' | 'green';
}) {
  const palette = {
    amber: { bg: '#FFF2D9', iconBg: '#FFE4B1', icon: '#A66B19', value: '#8D5B15' },
    orange: { bg: '#FFF0E3', iconBg: '#FFDFC4', icon: '#C65312', value: '#A94A15' },
    blue: { bg: '#EAF1FB', iconBg: '#D6E4F7', icon: '#4779B8', value: '#355F96' },
    green: { bg: '#E9F4EC', iconBg: '#D2E9D8', icon: '#39836B', value: '#326E50' },
  }[tone];
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.navigate(href)}
      className="min-h-[118px] flex-1 rounded-sm border border-white px-3.5 py-3 active:scale-[0.98]"
      style={{ backgroundColor: palette.bg }}
    >
      <View
        className="mb-2 h-9 w-9 items-center justify-center rounded-sm"
        style={{ backgroundColor: palette.iconBg }}
      >
        <Icon name={icon} size={19} color={palette.icon} />
      </View>
      <Text weight="bold" numberOfLines={1} className="text-[12px] leading-[16px] text-ink-2">
        {label}
      </Text>
      <Text
        weight="extrabold"
        numberOfLines={1}
        className="mt-0.5 text-[16px] leading-[21px]"
        style={{ color: palette.value }}
      >
        {value}
      </Text>
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
    <Card
      className={`mt-3 gap-3 ${over ? 'border-[#EAB9B4] bg-[#FFF2F0]' : 'border-[#CFE3D4] bg-[#F1F8F3]'}`}
      onPress={() => router.push('/budget')}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-[10px]">
          <View
            className="h-9 w-9 items-center justify-center rounded-sm"
            style={{ backgroundColor: over ? '#F8D9D4' : '#DCEFE1' }}
          >
            <Icon name="target" size={18} color={over ? '#B44136' : '#39836B'} />
          </View>
          <View>
            <Text weight="bold">Ngân sách tháng</Text>
            <Text className="text-[11px] text-ink-3">Theo dõi tổng chi subscription</Text>
          </View>
        </View>
        <Pill
          tone={over ? 'warn' : 'active'}
          icon={over ? 'alert' : undefined}
          label={over ? `Vượt ${budget.percent - 100}%` : `Đã dùng ${budget.percent}%`}
          className={over ? undefined : 'bg-[#DDF2E5]'}
        />
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-white">
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(budget.percent, 100))}%`,
            backgroundColor: over ? '#C74747' : '#39836B',
          }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text tabular className="text-[13px]">
          <Text weight="bold" className="text-[13px]">
            {formatAmount(budget.spentMinor, currency)}
          </Text>{' '}
          <Text className="text-[13px] text-ink-3">đã chi</Text>
        </Text>
        <Text tabular className="text-right text-[12px] text-ink-3">
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
          <Text weight="bold" className="text-[14px] text-[#C65312]">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
