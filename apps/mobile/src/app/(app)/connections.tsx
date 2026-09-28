import type { ConnectedAccountDto, DiscoverySummaryDto } from '@subca/shared';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Pill } from '@/components/ui/pill';
import { Text } from '@/components/ui/text';
import {
  useConnectGmail,
  useConnections,
  useDisconnect,
  useDiscoverySummary,
  useSyncConnection,
} from '@/features/detection/queries';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme';

/** Kết nối Gmail để Subca tự tìm subscription — thay cho việc nhập tay từng gói. */
export default function Connections() {
  const connections = useConnections();
  const connected = connections.data?.accounts ?? [];
  const summary = useDiscoverySummary(connected.length > 0);
  const connect = useConnectGmail();

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={connections.isRefetching}
          onRefresh={() => connections.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar title="Kết nối hộp thư" />

      {connections.data ? (
        connected.length === 0 ? (
          <Intro
            available={connections.data.gmailAvailable}
            loading={connect.isPending}
            error={connect.isError ? connect.error.message : null}
            onConnect={() => connect.mutate()}
          />
        ) : (
          <>
            {summary.data ? <Summary data={summary.data} /> : null}
            <View className="mt-3 gap-3">
              {connected.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </View>
            <Privacy />
          </>
        )
      ) : connections.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{connections.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => connections.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function Intro({
  available,
  loading,
  error,
  onConnect,
}: {
  available: boolean;
  loading: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  return (
    <>
      <View className="items-center rounded-[30px] bg-mint px-5 py-7">
        <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-surface">
          <Icon name="sparkle" size={26} color="#2E5B45" />
        </View>
        <Text weight="extrabold" className="mt-3 text-center text-[20px] leading-[26px]">
          Để Subca tự tìm subscription
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-[21px] text-ink-2">
          Kết nối Gmail một lần, Subca đọc hóa đơn và email gia hạn để dựng sẵn danh sách gói bạn
          đang trả — bạn chỉ xác nhận khi Subca chưa chắc.
        </Text>
      </View>

      <Card className="mt-3 gap-3">
        <Row icon="check" text="Chỉ đọc email hóa đơn, gia hạn, dùng thử và hủy gói" />
        <Row icon="check" text="Không lưu nội dung thư, chỉ lưu thông tin gói" />
        <Row icon="check" text="Ngắt kết nối bất cứ lúc nào, Subca xóa quyền truy cập" />
      </Card>

      {!available ? (
        <Card tone="peach" className="mt-3 flex-row items-center gap-3">
          <Icon name="alert" color="#8A4B1E" />
          <Text className="flex-1 text-[13px] leading-[19px] text-on-peach">
            Máy chủ chưa bật kết nối Gmail. Thử lại sau nhé.
          </Text>
        </Card>
      ) : null}
      {error ? <Text className="mt-3 text-center text-[13px] text-coral-deep">{error}</Text> : null}

      <Button
        title="Kết nối Gmail"
        icon="link"
        className="mt-4"
        disabled={!available}
        loading={loading}
        onPress={onConnect}
      />
      <Button
        title="Tự thêm bằng tay"
        variant="ghost"
        className="mt-1"
        onPress={() => router.push('/add')}
      />
    </>
  );
}

function Summary({ data }: { data: DiscoverySummaryDto }) {
  const scanning = data.status === 'RUNNING';
  return (
    <Card tone={scanning ? 'sky' : 'mint'} className="gap-2">
      <View className="flex-row items-center gap-2">
        {scanning ? (
          <ActivityIndicator color={colors['sky-deep']} />
        ) : (
          <Icon name="check-circle" color="#2E5B45" />
        )}
        <Text weight="bold" className="flex-1 text-[16px]">
          {scanning
            ? 'Subca đang tìm subscription của bạn…'
            : `Đã tìm thấy ${data.detected} subscription`}
        </Text>
      </View>
      <Text className="text-[13px] leading-[19px] text-ink-2">
        {scanning
          ? `Đã đọc ${data.scannedCount} email, thấy ${data.candidateCount} email liên quan.`
          : `${data.active} đang hoạt động · ${data.trial} dùng thử · ${data.needsReview} cần kiểm tra · ${data.cancelled} đã hủy`}
      </Text>
      {!scanning && data.openInboxCount > 0 ? (
        <Button
          title={`Xem ${data.openInboxCount} việc cần bạn quyết định`}
          size="sm"
          variant="soft"
          icon="chev"
          className="mt-1 self-start"
          onPress={() => router.push('/inbox')}
        />
      ) : null}
    </Card>
  );
}

function AccountCard({ account }: { account: ConnectedAccountDto }) {
  const sync = useSyncConnection();
  const disconnect = useDisconnect();
  const running = account.sync?.status === 'RUNNING' || sync.isPending;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-sky-soft">
          <Icon name="user" size={20} color={colors['sky-deep']} />
        </View>
        <View className="flex-1">
          <Text weight="bold" numberOfLines={1}>
            {account.providerEmail}
          </Text>
          <Text className="text-[12.5px] text-ink-3">
            {account.lastSyncAt
              ? `Quét gần nhất ${formatDate(account.lastSyncAt.slice(0, 10))}`
              : 'Chưa quét lần nào'}
          </Text>
        </View>
        <Pill
          label={account.status === 'ACTIVE' ? 'Đang kết nối' : 'Cần kết nối lại'}
          tone={account.status === 'ACTIVE' ? 'active' : 'warn'}
        />
      </View>

      {account.sync?.status === 'FAILED' ? (
        <Text className="text-[12.5px] leading-[18px] text-coral-deep">
          Lần quét trước lỗi: {account.sync.error}
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <Button
          title={running ? 'Đang quét…' : 'Quét ngay'}
          size="sm"
          variant="soft"
          icon="repeat"
          loading={running}
          className="flex-1"
          onPress={() => sync.mutate(account.id)}
        />
        <Button
          title="Ngắt kết nối"
          size="sm"
          variant="ghost"
          loading={disconnect.isPending}
          onPress={() =>
            Alert.alert(
              'Ngắt kết nối hộp thư?',
              'Subca ngừng quét và xóa quyền truy cập. Các subscription đã tìm thấy vẫn được giữ.',
              [
                { text: 'Thôi', style: 'cancel' },
                {
                  text: 'Ngắt kết nối',
                  style: 'destructive',
                  onPress: () => disconnect.mutate(account.id),
                },
              ],
            )
          }
        />
      </View>
    </Card>
  );
}

function Row({ icon, text }: { icon: 'check'; text: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <View className="mt-[2px]">
        <Icon name={icon} size={16} color="#2E5B45" strokeWidth={2.4} />
      </View>
      <Text className="flex-1 text-[13.5px] leading-[20px] text-ink-2">{text}</Text>
    </View>
  );
}

function Privacy() {
  return (
    <Text className="mt-6 text-center text-[12px] leading-[18px] text-ink-3">
      Subca chỉ đọc email liên quan subscription và lưu đúng thông tin gói (tên dịch vụ, giá, ngày
      gia hạn). Nội dung thư không được lưu.
    </Text>
  );
}
