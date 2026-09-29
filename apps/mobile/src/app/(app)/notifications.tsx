import type { ReminderFeedItemDto, ReminderRuleDto } from '@subca/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useMe } from '@/features/auth/use-me';
import {
  useReminderRules,
  useReminders,
  useSaveReminderRules,
} from '@/features/notifications/queries';
import { colors, shadow } from '@/theme';

/** Các mốc nhắc cho người dùng bật / tắt (mockup: tab "Cài đặt nhắc"). */
const RULE_OPTIONS: { rule: Omit<ReminderRuleDto, 'enabled'>; title: string; note: string }[] = [
  {
    rule: { kind: 'RENEWAL', offsetDays: 30, minInterval: 'YEAR' },
    title: 'Gói năm: trước 30 ngày',
    note: 'Khoản lớn, cần chuẩn bị tiền sớm',
  },
  {
    rule: { kind: 'RENEWAL', offsetDays: 7, minInterval: null },
    title: 'Trước 7 ngày',
    note: 'Đủ thời gian quyết định giữ hay hủy',
  },
  {
    rule: { kind: 'RENEWAL', offsetDays: 3, minInterval: null },
    title: 'Trước 3 ngày',
    note: 'Nhắc lại khi sắp tới ngày',
  },
  {
    rule: { kind: 'RENEWAL', offsetDays: 1, minInterval: null },
    title: 'Trước 1 ngày',
    note: 'Hạn chót để hủy trước khi bị trừ tiền',
  },
  {
    rule: { kind: 'RENEWAL', offsetDays: 0, minInterval: null },
    title: 'Đúng ngày gia hạn',
    note: 'Báo khi tiền bị trừ',
  },
  {
    rule: { kind: 'TRIAL_END', offsetDays: 3, minInterval: null },
    title: 'Trial: trước 3 ngày',
    note: 'Trước khi hết dùng thử',
  },
  {
    rule: { kind: 'TRIAL_END', offsetDays: 1, minInterval: null },
    title: 'Trial: trước 1 ngày',
    note: 'Hủy kịp trước khi bắt đầu tính phí',
  },
];

const sameRule = (a: Omit<ReminderRuleDto, 'enabled'>, b: Omit<ReminderRuleDto, 'enabled'>) =>
  a.kind === b.kind && a.offsetDays === b.offsetDays;

/** Thông báo & Nhắc nhở — màn 12 của mockup. */
export default function Notifications() {
  const [tab, setTab] = useState<'feed' | 'rules'>('feed');
  const reminders = useReminders();
  const rules = useReminderRules();

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={reminders.isRefetching || rules.isRefetching}
          onRefresh={() => {
            reminders.refetch();
            rules.refetch();
          }}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar title="Nhắc nhở" />
      <Segmented
        options={[
          { value: 'feed', label: 'Thông báo' },
          { value: 'rules', label: 'Cài đặt nhắc' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'feed' ? <Feed query={reminders} /> : <Rules query={rules} />}
    </Screen>
  );
}

function Feed({ query }: { query: ReturnType<typeof useReminders> }) {
  if (query.isError) {
    return (
      <Card className="mt-4 items-center gap-3">
        <Text className="text-center text-ink-2">{query.error.message}</Text>
        <Button title="Thử lại" size="sm" variant="soft" onPress={() => query.refetch()} />
      </Card>
    );
  }
  if (!query.data) return <ActivityIndicator className="mt-16" color={colors['ink-3']} />;
  const { upcoming, history, notificationsEnabled } = query.data;

  return (
    <>
      {!notificationsEnabled ? (
        <Card tone="peach" className="mt-4 flex-row items-center gap-3 p-[14px]">
          <Icon name="bell" color={colors['on-peach']} />
          <Text className="flex-1 text-[13.5px] leading-[20px] text-on-peach">
            Bạn đang tắt thông báo nhắc. Bật lại trong Cài đặt để không bị trừ tiền bất ngờ.
          </Text>
        </Card>
      ) : null}

      <GroupLabel title="Sắp tới" />
      {upcoming.length > 0 ? (
        <View className="gap-[10px]">
          {upcoming.slice(0, 20).map((r) => (
            <FeedRow
              key={`${r.subscriptionId}-${r.kind}-${r.offsetDays}-${r.dueDate}`}
              item={r}
              upcoming
            />
          ))}
        </View>
      ) : (
        <Text className="ml-1 text-[13.5px] text-ink-3">
          {notificationsEnabled
            ? 'Không có nhắc nào trong 30 ngày tới.'
            : 'Không có nhắc vì đang tắt thông báo.'}
        </Text>
      )}

      <GroupLabel title="Đã gửi (30 ngày qua)" />
      {history.length > 0 ? (
        <View className="gap-[10px]">
          {history.map((r) => (
            <FeedRow key={r.id ?? r.at} item={r} />
          ))}
        </View>
      ) : (
        <Text className="ml-1 text-[13.5px] text-ink-3">Chưa có thông báo nào được gửi.</Text>
      )}
    </>
  );
}

function GroupLabel({ title }: { title: string }) {
  return (
    <Text weight="semibold" className="mb-2 ml-1 mt-6 text-[13px] uppercase text-ink-3">
      {title}
    </Text>
  );
}

/** "Hôm nay 08:30", "Ngày mai 08:30", "Th 5, 02/10 · 08:30" theo giờ máy. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(new Date())) / 86_400_000);
  if (days === 0) return `Hôm nay ${time}`;
  if (days === 1) return `Ngày mai ${time}`;
  if (days === -1) return `Hôm qua ${time}`;
  const weekday = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'][d.getDay()];
  return `${weekday}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${time}`;
}

/** Một thông báo (mockup: .notif). */
function FeedRow({ item, upcoming = false }: { item: ReminderFeedItemDto; upcoming?: boolean }) {
  const trial = item.kind === 'TRIAL_END';
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/subscriptions/[id]', params: { id: item.subscriptionId } })
      }
      accessibilityRole="button"
      className="flex-row gap-3 rounded-md bg-surface p-[14px] active:scale-[0.985]"
      style={{ boxShadow: shadow.sm }}
    >
      <View
        className="h-[42px] w-[42px] items-center justify-center rounded-sm"
        style={{
          backgroundColor: trial ? colors.peach : upcoming ? colors['sky-soft'] : colors.mint,
        }}
      >
        <Icon name={trial ? 'hourglass' : upcoming ? 'clock' : 'bell'} color={colors.ink} />
      </View>
      <View className="flex-1">
        <Text weight="bold" className="text-[14.5px] leading-[20px]">
          {item.title}
        </Text>
        <Text className="mt-[2px] text-[13px] leading-[19px] text-ink-2">{item.body}</Text>
        <Text className="mt-1 text-[12px] text-ink-3">
          {upcoming ? `Sẽ nhắc ${whenLabel(item.at)}` : whenLabel(item.at)}
        </Text>
      </View>
    </Pressable>
  );
}

function Rules({ query }: { query: ReturnType<typeof useReminderRules> }) {
  const save = useSaveReminderRules();
  const { data: me } = useMe();
  if (query.isError) {
    return (
      <Card className="mt-4 items-center gap-3">
        <Text className="text-center text-ink-2">{query.error.message}</Text>
        <Button title="Thử lại" size="sm" variant="soft" onPress={() => query.refetch()} />
      </Card>
    );
  }
  if (!query.data) return <ActivityIndicator className="mt-16" color={colors['ink-3']} />;
  const current = query.data;
  const isOn = (r: Omit<ReminderRuleDto, 'enabled'>) =>
    current.some((c) => sameRule(c, r) && c.enabled);

  const toggle = (rule: Omit<ReminderRuleDto, 'enabled'>, enabled: boolean) => {
    // Giữ nguyên các quy tắc không có trên màn (VD do admin thêm), chỉ đổi / thêm quy tắc được bấm.
    const others = current.filter((c) => !sameRule(c, rule));
    save.mutate([...others, { ...rule, enabled }]);
  };
  const minute = me?.settings?.reminderMinuteOfDay ?? 510;
  const isFree = me?.plan.tier !== 'PLUS';

  return (
    <>
      <Text className="mx-1 mb-3 mt-[18px] text-[14px] leading-[21px] text-ink-2">
        Chọn thời điểm Subca nhắc bạn trước khi bị trừ tiền. Gói nào tự đặt mốc nhắc riêng thì dùng
        mốc của gói đó.
      </Text>
      <View className="gap-[10px]">
        {RULE_OPTIONS.map((o) => (
          <ToggleRow
            key={`${o.rule.kind}-${o.rule.offsetDays}`}
            title={o.title}
            note={o.note}
            value={isOn(o.rule)}
            onChange={(on) => toggle(o.rule, on)}
          />
        ))}
      </View>
      {isFree ? (
        <Text className="mx-1 mt-3 text-[12.5px] leading-[18px] text-ink-3">
          Gói Free: mỗi subscription chỉ gửi mốc gần ngày gia hạn nhất trong các mốc đang bật. Subca
          Plus gửi tất cả.
        </Text>
      ) : null}
      <Card
        tone="mint"
        onPress={() => router.push('/profile')}
        className="mt-4 flex-row items-center gap-3"
      >
        <Icon name="clock" />
        <View className="flex-1">
          <Text weight="bold">Giờ nhận thông báo</Text>
          <Text className="text-[13px] text-on-mint">
            Mỗi ngày lúc {String(Math.floor(minute / 60)).padStart(2, '0')}:
            {String(minute % 60).padStart(2, '0')} · đổi trong Cài đặt
          </Text>
        </View>
        <Icon name="chev" size={18} />
      </Card>
    </>
  );
}
