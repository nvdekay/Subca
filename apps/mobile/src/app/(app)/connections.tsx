import type { ConnectedAccountDto, DiscoverySummaryDto } from '@subca/shared';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { ScanProgressCard } from '@/features/detection/scan-progress-card';
import { ScanWindowPicker, type ScanWindowMonths } from '@/features/detection/scan-window-picker';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme';

/** Kết nối Gmail để Subca tự tìm subscription — thay cho việc nhập tay từng gói. */
export default function Connections() {
  const connections = useConnections();
  const summary = useDiscoverySummary((connections.data?.accounts.length ?? 0) > 0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const connected = connections.data?.accounts ?? [];
  const connect = useConnectGmail();

  const refresh = async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([connections.refetch(), summary.refetch()]);
    } finally {
      setPullRefreshing(false);
    }
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={pullRefreshing}
          onRefresh={refresh}
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
            {summary.data ? (
              <Summary data={summary.data} />
            ) : (
              <Card className="min-h-[204px] justify-center gap-3">
                <ActivityIndicator color={colors.accent} />
                <Text className="text-center text-[13px] text-ink-3">
                  Đang tải tiến độ quét hộp thư…
                </Text>
              </Card>
            )}
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
      <View className="items-center rounded-sm border border-line bg-mint px-5 py-7">
        <View className="h-14 w-14 items-center justify-center rounded-sm bg-surface">
          <Icon name="sparkle" size={26} color={colors['on-mint']} />
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
          <Icon name="alert" color={colors['on-peach']} />
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
  if (scanning) {
    return (
      <ScanProgressCard scannedCount={data.scannedCount} candidateCount={data.candidateCount} />
    );
  }
  return (
    <Card tone="surface" className="gap-3 border-[#E8C9AE] bg-[#FFF8F1] p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-sm bg-[#FCE2CC]">
          <Text weight="extrabold" tabular className="text-[25px] leading-[30px] text-[#C65312]">
            {data.detected}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Icon name="check-circle" size={15} color="#39836B" />
            <Text weight="bold" className="text-[11px] uppercase tracking-[0.6px] text-[#39836B]">
              Quét hoàn tất
            </Text>
          </View>
          <Text weight="extrabold" className="text-[16px] leading-[21px] text-ink">
            Subscription được tìm thấy
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Text weight="bold" className="text-[11px] uppercase tracking-[0.5px] text-ink-3">
          Trạng thái gói
        </Text>
        <View className="flex-row gap-2">
          <ResultMetric label="Hoạt động" value={data.active} tone="green" />
          <ResultMetric label="Dùng thử" value={data.trial} tone="amber" />
          <ResultMetric label="Đã hủy" value={data.cancelled} tone="neutral" />
        </View>
      </View>

      <ReviewNote count={data.needsReview} total={data.detected} />

      {data.openInboxCount > 0 ? (
        <Button
          title={`Xem ${data.openInboxCount} việc cần bạn quyết định`}
          size="sm"
          variant="primary"
          icon="chev"
          className="mt-0.5"
          onPress={() => router.push('/inbox')}
        />
      ) : null}
    </Card>
  );
}

function ResultMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'neutral';
}) {
  const style = {
    green: { backgroundColor: '#E4F3E9', color: '#34764F' },
    amber: { backgroundColor: '#FFF0D7', color: '#A86B16' },
    neutral: { backgroundColor: '#ECEDEF', color: '#5E636A' },
  }[tone];

  return (
    <View
      className="min-h-[62px] flex-1 items-center justify-center gap-0.5 rounded-sm px-1.5 py-2"
      style={{ backgroundColor: style.backgroundColor }}
    >
      <Text
        weight="extrabold"
        tabular
        className="text-[20px] leading-[24px]"
        style={{ color: style.color }}
      >
        {value}
      </Text>
      <Text numberOfLines={1} className="text-center text-[10px] leading-[13px] text-ink-2">
        {label}
      </Text>
    </View>
  );
}

function ReviewNote({ count, total }: { count: number; total: number }) {
  const needsReview = count > 0;
  return (
    <View
      className="flex-row items-center gap-2.5 rounded-sm px-3 py-2.5"
      style={{ backgroundColor: needsReview ? '#E7EFFA' : '#E4F3E9' }}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: needsReview ? '#D5E3F5' : '#D1E9D9' }}
      >
        <Icon
          name={needsReview ? 'alert' : 'check-circle'}
          size={17}
          color={needsReview ? '#4779B8' : '#39836B'}
        />
      </View>
      <View className="flex-1">
        <Text weight="bold" className="text-[12.5px] text-ink">
          {needsReview ? `${count} gói cần bạn kiểm tra` : 'Không có gói cần kiểm tra'}
        </Text>
        <Text className="text-[10.5px] leading-[14px] text-ink-3">
          {needsReview
            ? `Đã tính trong tổng ${total} subscription phía trên.`
            : 'Các trạng thái ở trên đã được phân loại.'}
        </Text>
      </View>
    </View>
  );
}

function AccountCard({ account }: { account: ConnectedAccountDto }) {
  const sync = useSyncConnection();
  const disconnect = useDisconnect();
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [scanWindowMonths, setScanWindowMonths] = useState<ScanWindowMonths>(3);
  const running = account.sync?.status === 'RUNNING' || sync.isPending;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-sm bg-sky-soft">
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
          className={account.status === 'ACTIVE' ? 'bg-[#DDF2E5]' : undefined}
        />
      </View>

      {account.sync?.status === 'FAILED' ? (
        <Text className="text-[12.5px] leading-[18px] text-coral-deep">
          Lần quét trước lỗi: {account.sync.error}
        </Text>
      ) : null}

      {showScanOptions && !running ? (
        <View className="gap-3 rounded-sm border border-[#E8C9AE] bg-[#FFF8F1] p-3">
          <ScanWindowPicker value={scanWindowMonths} onChange={setScanWindowMonths} />
          <Button
            title="Bắt đầu quét"
            size="sm"
            onPress={() =>
              sync.mutate(
                { accountId: account.id, windowMonths: scanWindowMonths },
                { onSuccess: () => setShowScanOptions(false) },
              )
            }
          />
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <Button
          title={running ? 'Đang quét…' : showScanOptions ? 'Ẩn lựa chọn' : 'Chọn phạm vi quét'}
          size="sm"
          variant="soft"
          icon="repeat"
          loading={running}
          className="flex-1"
          disabled={running}
          onPress={() => setShowScanOptions((visible) => !visible)}
        />
        <Button
          title="Ngắt kết nối"
          size="sm"
          variant="danger"
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
        <Icon name={icon} size={16} color={colors['on-mint']} strokeWidth={2.4} />
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
