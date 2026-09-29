import type { CurrencyCode } from '@subca/shared';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceSheet } from '@/components/ui/choice-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import {
  useBudget,
  useDeleteAccount,
  useUpdateProfile,
  useUpdateSettings,
} from '@/features/account/queries';
import { useMe } from '@/features/auth/use-me';
import { registerForPush, unregisterPush } from '@/features/notifications/push';
import { usePaymentMethods } from '@/features/subscriptions/queries';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/theme';

const CURRENCIES: { value: CurrencyCode; label: string; note: string }[] = [
  { value: 'VND', label: 'VND (đ)', note: 'Việt Nam đồng' },
  { value: 'USD', label: 'USD ($)', note: 'Đô la Mỹ' },
  { value: 'EUR', label: 'EUR (€)', note: 'Euro' },
  { value: 'JPY', label: 'JPY (¥)', note: 'Yên Nhật' },
];

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Việt Nam (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'America/Los_Angeles', label: 'Los Angeles' },
];

/** Giờ nhận nhắc, tính bằng phút từ 00:00 (API: reminderMinuteOfDay). */
const REMIND_TIMES = [420, 510, 720, 1080, 1260].map((m) => ({
  value: m,
  label: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
}));

type SheetKind = 'name' | 'currency' | 'timezone' | 'time' | null;

/** Hồ sơ & Cài đặt — màn 16 của mockup. */
export default function Settings() {
  const { data: me } = useMe();
  const paymentMethods = usePaymentMethods();
  const budget = useBudget();
  const updateSettings = useUpdateSettings();
  const deleteAccount = useDeleteAccount();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [signingOut, setSigningOut] = useState(false);

  const settings = me?.settings;
  const name = me?.displayName ?? me?.email?.split('@')[0] ?? '';
  const isPlus = me?.plan.tier === 'PLUS';

  const changeSettings = (input: Parameters<typeof updateSettings.mutate>[0]) =>
    updateSettings.mutate(input, {
      onSuccess: () => setSheet(null),
      onError: (e) => Alert.alert('Chưa lưu được', e.message),
    });

  async function signOut() {
    setSigningOut(true);
    // Gỡ push token trước (cần còn đăng nhập), rồi mới đăng xuất.
    await unregisterPush();
    // Phiên đổi → _layout tự quay về màn chào; cache được xóa trong SessionProvider.
    await supabase.auth.signOut();
    setSigningOut(false);
  }

  function confirmSignOut() {
    Alert.alert('Đăng xuất?', 'Bạn có thể đăng nhập lại bằng email bất cứ lúc nào.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Xóa tài khoản vĩnh viễn?',
      'Toàn bộ subscription, lịch sử, nhóm chia tiền và cài đặt sẽ bị xóa và không khôi phục được.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onSuccess: async () => {
                await supabase.auth.signOut({ scope: 'local' });
              },
              onError: (e) =>
                Alert.alert(
                  'Chưa xóa được',
                  e instanceof ApiError && e.status === 503
                    ? 'Tính năng xóa tài khoản đang được bảo trì. Thử lại sau hoặc liên hệ hỗ trợ.'
                    : e.message,
                ),
            }),
        },
      ],
    );
  }

  return (
    <Screen>
      <TopBar title="Cài đặt" />

      {/* ── Hồ sơ ── */}
      <Card className="flex-row items-center gap-[14px]">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: colors.coral,
          }}
        >
          <Text weight="bold" className="text-[22px] leading-[28px] text-on-coral">
            {(name[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text weight="bold" className="text-[18px] leading-[24px]" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-[13px] text-ink-3" numberOfLines={1}>
            {me?.email}
          </Text>
          <View className="mt-2">
            <Pill
              tone={isPlus ? 'trial' : 'cancel'}
              icon={isPlus ? 'sparkle' : undefined}
              label={isPlus ? 'Subca Plus' : 'Gói Free'}
            />
          </View>
        </View>
        <Pressable
          onPress={() => setSheet('name')}
          accessibilityRole="button"
          accessibilityLabel="Sửa tên"
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <Icon name="edit" />
        </Pressable>
      </Card>

      <GroupLabel title="Tài khoản" />
      <Group>
        <SetRow
          icon="coin"
          bg={colors.mint}
          title="Tiền tệ chính"
          value={CURRENCIES.find((c) => c.value === settings?.currency)?.label}
          onPress={() => setSheet('currency')}
        />
        <SetRow
          icon="clock"
          bg={colors.peach}
          title="Múi giờ"
          value={TIMEZONES.find((t) => t.value === settings?.timezone)?.label ?? settings?.timezone}
          onPress={() => setSheet('timezone')}
          divider
        />
      </Group>

      <GroupLabel title="Nhắc nhở" />
      <Group>
        <View className="flex-row items-center gap-3 px-4 py-[13px]">
          <RowIcon icon="bell" bg={colors.coral} />
          <View className="flex-1">
            <Text weight="semibold">Thông báo nhắc gia hạn</Text>
            <Text className="text-[12.5px] text-ink-3">
              Nhắc trước ngày bị trừ tiền và hết trial
            </Text>
          </View>
          <Switch
            value={settings?.notificationsEnabled ?? true}
            onValueChange={(on) => {
              changeSettings({ notificationsEnabled: on });
              if (on) registerForPush({ ask: true });
            }}
            trackColor={{ true: colors['ink-brand'], false: colors.line }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.line}
          />
        </View>
        <SetRow
          icon="clock"
          bg={colors['sky-soft']}
          title="Giờ nhận nhắc"
          value={
            REMIND_TIMES.find((t) => t.value === settings?.reminderMinuteOfDay)?.label ??
            (settings
              ? `${Math.floor(settings.reminderMinuteOfDay / 60)}:${String(settings.reminderMinuteOfDay % 60).padStart(2, '0')}`
              : undefined)
          }
          onPress={() => setSheet('time')}
          divider
        />
      </Group>

      <GroupLabel title="Quản lý" />
      <Group>
        <SetRow
          icon="link"
          bg={colors.mint}
          title="Kết nối hộp thư"
          value="Tự tìm subscription"
          onPress={() => router.push('/connections')}
          divider
        />
        <SetRow
          icon="card"
          bg={colors['sky-soft']}
          title="Phương thức thanh toán"
          value={paymentMethods.data ? String(paymentMethods.data.length) : undefined}
          onPress={() => router.push('/payments')}
        />
        <SetRow
          icon="target"
          bg={colors.mint}
          title="Ngân sách mỗi tháng"
          value={
            budget.data
              ? formatAmount(budget.data.amountMinor, budget.data.currency)
              : budget.isSuccess
                ? 'Chưa đặt'
                : undefined
          }
          onPress={() => router.push('/budget')}
          divider
        />
        <SetRow
          icon="hourglass"
          bg={colors.peach}
          title="Quản lý Trial"
          onPress={() => router.push('/trials')}
          divider
        />
        <SetRow
          icon="users"
          bg={colors.stone}
          title="Chia tiền nhóm"
          onPress={() => router.push('/groups')}
          divider
        />
      </Group>

      <GroupLabel title="Khác" />
      <Group>
        <SetRow icon="logout" bg={colors.coral} title="Đăng xuất" danger onPress={confirmSignOut} />
        <SetRow
          icon="alert"
          bg={colors['muted-bg']}
          title="Xóa tài khoản"
          danger
          onPress={confirmDeleteAccount}
          divider
        />
      </Group>
      {signingOut || deleteAccount.isPending ? (
        <Text className="mt-3 text-center text-[13px] text-ink-3">Đang xử lý…</Text>
      ) : null}

      <Text className="mt-5 text-center text-[13px] text-ink-3">
        Subca v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>

      {/* ── Các bottom sheet ── */}
      {sheet === 'name' ? (
        <NameSheet initial={me?.displayName ?? ''} onClose={() => setSheet(null)} />
      ) : null}
      <ChoiceSheet
        visible={sheet === 'currency'}
        title="Tiền tệ chính"
        subtitle="Tổng chi phí, ngân sách và phân tích sẽ quy đổi về tiền tệ này."
        options={CURRENCIES}
        value={settings?.currency}
        onPick={(currency) => changeSettings({ currency })}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === 'timezone'}
        title="Múi giờ"
        subtitle="Dùng để tính “hôm nay”, ngày gia hạn và giờ gửi nhắc."
        options={TIMEZONES}
        value={settings?.timezone}
        onPick={(timezone) => changeSettings({ timezone })}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === 'time'}
        title="Giờ nhận nhắc"
        subtitle="Subca gửi nhắc vào giờ này, theo múi giờ của bạn."
        options={REMIND_TIMES}
        value={settings?.reminderMinuteOfDay}
        onPick={(reminderMinuteOfDay) => changeSettings({ reminderMinuteOfDay })}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function GroupLabel({ title }: { title: string }) {
  return (
    <Text weight="semibold" className="mb-2 ml-1 mt-6 text-[13px] uppercase text-ink-3">
      {title}
    </Text>
  );
}

function Group({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-lg bg-surface" style={{ boxShadow: shadow.sm }}>
      {children}
    </View>
  );
}

function RowIcon({ icon, bg }: { icon: IconName; bg: string }) {
  return (
    <View
      className="h-[34px] w-[34px] items-center justify-center rounded-[11px]"
      style={{ backgroundColor: bg }}
    >
      <Icon name={icon} size={18} />
    </View>
  );
}

/** Một dòng cài đặt (mockup: .set-row). `divider` = có đường kẻ phía trên. */
function SetRow({
  icon,
  bg,
  title,
  value,
  onPress,
  danger = false,
  divider = false,
}: {
  icon: IconName;
  bg: string;
  title: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  divider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        'flex-row items-center gap-3 px-4 py-[13px] active:bg-bg',
        divider && 'border-t border-line',
      )}
    >
      <RowIcon icon={icon} bg={bg} />
      <Text weight="semibold" className={cn('flex-1', danger && 'text-coral-deep')}>
        {title}
      </Text>
      {value ? <Text className="text-[14px] text-ink-3">{value}</Text> : null}
      {danger ? null : <Icon name="chev" size={18} color={colors['ink-3']} />}
    </Pressable>
  );
}

function NameSheet({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const update = useUpdateProfile();
  return (
    <Sheet visible onClose={onClose} title="Tên hiển thị">
      <Input
        value={value}
        onChangeText={setValue}
        placeholder="VD: Khánh"
        maxLength={60}
        autoFocus
      />
      <Button
        title="Lưu"
        icon="check"
        className="mt-4"
        loading={update.isPending}
        onPress={() =>
          update.mutate(
            { displayName: value.trim() || null },
            { onSuccess: onClose, onError: (e) => Alert.alert('Chưa lưu được', e.message) },
          )
        }
      />
    </Sheet>
  );
}
