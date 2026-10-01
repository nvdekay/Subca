import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GmailLogo } from '@/components/gmail-logo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  useConnectGmail,
  useConnections,
  useDiscoverySummary,
  useSyncConnection,
} from '@/features/detection/queries';
import { ScanProgressCard } from '@/features/detection/scan-progress-card';
import { useSubscriptions } from '@/features/subscriptions/queries';
import { ScanWindowPicker, type ScanWindowMonths } from '@/features/detection/scan-window-picker';
import { colors } from '@/theme';

type Step = 'connect' | 'connected' | 'scanning' | 'summary';

/** Sau intro và đăng nhập, onboarding bắt đầu từ kết nối Gmail. */
export default function Welcome() {
  const { connected } = useLocalSearchParams<{ connected?: string }>();
  const connections = useConnections();
  const subscriptions = useSubscriptions();
  const connect = useConnectGmail('welcome');
  const sync = useSyncConnection();
  const [step, setStep] = useState<Step>('connect');
  const [scanRequested, setScanRequested] = useState(false);
  const [scanRunId, setScanRunId] = useState<string | null>(null);
  const [scanWindowMonths, setScanWindowMonths] = useState<ScanWindowMonths>(3);
  const accounts = useMemo(() => connections.data?.accounts ?? [], [connections.data?.accounts]);
  const account = accounts[0];
  const resumableRun =
    account?.sync &&
    !account.initialSyncDoneAt &&
    (account.sync.status === 'RUNNING' || account.sync.status === 'FAILED')
      ? account.sync
      : null;
  if (!scanRequested && resumableRun && scanRunId !== resumableRun.id) {
    setScanRunId(resumableRun.id);
  }
  const isScanFlow = scanRequested || Boolean(resumableRun) || Boolean(scanRunId);
  const activeRunId = scanRunId ?? resumableRun?.id ?? null;
  const summary = useDiscoverySummary(accounts.length > 0 && isScanFlow);
  const summaryMatchesRun = Boolean(activeRunId && summary.data?.runId === activeRunId);
  const runStatus =
    account?.sync?.id === activeRunId
      ? account.sync.status
      : summaryMatchesRun
        ? summary.data?.status
        : undefined;
  const scanFailed = sync.isError || summary.isError || runStatus === 'FAILED';
  const scanFinished = runStatus === 'DONE';
  const currentStep: Step =
    isScanFlow && scanFinished
      ? 'summary'
      : isScanFlow
        ? 'scanning'
        : connected === '1' && accounts.length > 0
          ? 'connected'
          : step;

  useEffect(() => {
    // Người đã có dữ liệu không cần xem lại onboarding; OAuth callback là ngoại lệ.
    if (
      connected !== '1' &&
      !isScanFlow &&
      (subscriptions.data?.items.length || (connections.isSuccess && accounts.length > 0))
    ) {
      router.replace('/(app)/(tabs)');
    }
  }, [
    accounts.length,
    connected,
    connections.isSuccess,
    isScanFlow,
    subscriptions.data?.items.length,
  ]);

  const continueToApp = () => router.replace('/(app)/(tabs)');
  const connectGmail = () => {
    connect.mutate(undefined, {
      onSuccess: (didConnect) => {
        if (didConnect) setStep('connected');
      },
    });
  };
  const startScan = () => {
    if (!account) return;
    setScanRunId(null);
    setScanRequested(true);
    sync.mutate(
      { accountId: account.id, windowMonths: scanWindowMonths },
      { onSuccess: (run) => setScanRunId(run.id) },
    );
  };

  if (currentStep === 'connect') {
    return (
      <Screen>
        <View className="flex-1 pb-7 pt-2">
          <Text weight="extrabold" className="mb-2 mt-4 text-[27px] leading-[35px]">
            Kết nối email của bạn
          </Text>
          <Text className="mb-6 leading-[23px] text-ink-3">
            Subca sử dụng email thanh toán để tìm các subscription bạn đang sử dụng.
          </Text>
          <Card tone="mint" className="gap-4 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-sm bg-white">
                <GmailLogo width={32} />
              </View>
              <View className="flex-1">
                <Text weight="bold" className="text-[16px]">
                  Gmail
                </Text>
                <Text className="text-[12px] text-ink-3">Chỉ đọc email thanh toán</Text>
              </View>
              <View className="rounded-full bg-butter px-3 py-1">
                <Text weight="bold" className="text-[11px] text-ink-2">
                  Khuyên dùng
                </Text>
              </View>
            </View>
            <Button
              title={connections.data?.gmailAvailable ? 'Kết nối Gmail' : 'Gmail chưa khả dụng'}
              icon="link"
              loading={connect.isPending}
              disabled={!connections.data?.gmailAvailable}
              onPress={connectGmail}
            />
          </Card>
          <Card className="mt-3 flex-row items-center gap-3 p-4 opacity-70">
            <View className="h-11 w-11 items-center justify-center rounded-sm bg-surface">
              <Icon name="link" size={21} color={colors['ink-3']} />
            </View>
            <Text weight="semibold" className="flex-1">
              Outlook
            </Text>
            <Text className="text-[12px] text-ink-3">Sắp ra mắt</Text>
          </Card>
          <View className="mt-5 flex-row items-start gap-3 px-1">
            <Icon name="check-circle" size={19} color={colors['ink-2']} />
            <Text className="flex-1 text-[13px] leading-[20px] text-ink-3">
              Subca chỉ đọc hóa đơn, gia hạn và email hủy. Không đọc thư cá nhân.
            </Text>
          </View>
          {connect.isError ? (
            <Text className="mt-3 text-center text-coral-deep">{connect.error.message}</Text>
          ) : null}
          <View className="flex-1" />
          <Button title="Bỏ qua và về trang chủ" variant="ghost" onPress={continueToApp} />
        </View>
      </Screen>
    );
  }

  if (currentStep === 'connected') {
    return (
      <Screen>
        <View className="flex-1 justify-between pb-7 pt-8">
          <View className="flex-1 justify-center">
            <View className="mb-7 h-[72px] w-[72px] items-center justify-center rounded-full bg-mint">
              <Icon name="check" size={34} color={colors['on-mint']} />
            </View>
            <Text weight="extrabold" className="mb-4 text-[28px] leading-[36px]">
              Đã kết nối Gmail
            </Text>
            <View className="mb-4 self-start flex-row items-center gap-2 rounded-xl bg-surface px-3 py-2">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
                <GmailLogo width={20} />
              </View>
              <Text weight="semibold" className="text-[14px]">
                {maskEmail(account?.providerEmail ?? '')}
              </Text>
            </View>
            <Text className="text-[15px] leading-[23px] text-ink-3">
              Subca sẽ tìm email liên quan đến thanh toán, gia hạn, trial và hủy subscription.
            </Text>
          </View>
          <View className="gap-2">
            <Card className="gap-2 p-4">
              <ScanWindowPicker value={scanWindowMonths} onChange={setScanWindowMonths} />
            </Card>
            <Button title="Bắt đầu tìm subscription" onPress={startScan} />
            <Button title="Để sau" variant="ghost" onPress={continueToApp} />
          </View>
        </View>
      </Screen>
    );
  }

  if (currentStep === 'scanning') {
    return (
      <Screen>
        <View className="flex-1 pb-7 pt-8">
          <Text weight="extrabold" className="mb-2 text-[25px] leading-[33px]">
            {scanFailed ? 'Chưa thể quét hộp thư' : 'Đang tìm subscription cho bạn'}
          </Text>
          <Text className="mb-5 text-ink-3">
            {scanFailed
              ? 'Kết nối Gmail vẫn được giữ. Bạn có thể thử lại hoặc tiếp tục vào ứng dụng.'
              : 'Subca đang đọc email thanh toán, lọc hóa đơn và nhận diện gói đăng ký.'}
          </Text>
          {scanFailed ? (
            <Card tone="peach" className="min-h-[204px] justify-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-sm bg-[#FCE2CC]">
                <Icon name="alert" size={21} color="#D65C16" />
              </View>
              <Text weight="bold" className="text-[15px]">
                Lượt quét bị gián đoạn
              </Text>
              <Text className="text-[13px] text-ink-3">
                Đã đọc {summary.data?.scannedCount ?? account?.sync?.scannedCount ?? 0} email · liên
                quan {summary.data?.candidateCount ?? account?.sync?.candidateCount ?? 0} email
              </Text>
            </Card>
          ) : (
            <ScanProgressCard
              scannedCount={summary.data?.scannedCount ?? account?.sync?.scannedCount ?? 0}
              candidateCount={summary.data?.candidateCount ?? account?.sync?.candidateCount ?? 0}
            />
          )}
          {!scanFailed ? (
            <Text className="mt-4 text-center text-[12px] leading-[18px] text-ink-3">
              Bạn có thể đóng ứng dụng; Subca sẽ tiếp tục xử lý và lưu kết quả.
            </Text>
          ) : null}
          {scanFailed ? (
            <View className="mt-auto gap-2 pt-6">
              <Button title="Thử quét lại" onPress={startScan} />
              <Button title="Vào Subca" variant="ghost" onPress={continueToApp} />
            </View>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 pb-7 pt-8">
        <View className="mb-2 flex-row items-center gap-2">
          <Icon name="sparkle" size={17} color={colors['on-mint']} />
          <Text weight="bold" className="text-[12px] uppercase tracking-[1px] text-on-mint">
            Quét hoàn tất
          </Text>
        </View>
        <Text weight="extrabold" tabular className="text-[64px] leading-[74px] text-ink">
          {summary.data?.detected ?? subscriptions.data?.items.length ?? 0}
        </Text>
        <Text weight="extrabold" className="mb-6 text-[25px] leading-[33px]">
          Đã tìm thấy {summary.data?.detected ?? subscriptions.data?.items.length ?? 0} subscription
        </Text>
        <View className="flex-row gap-3">
          <SummaryCard label="Đang hoạt động" value={summary.data?.active ?? 0} tone="mint" />
          <SummaryCard label="Dùng thử" value={summary.data?.trial ?? 0} tone="peach" />
        </View>
        <View className="mt-3 flex-row gap-3">
          <SummaryCard label="Cần xem lại" value={summary.data?.needsReview ?? 0} tone="sky" />
          <SummaryCard
            label="Email đã quét"
            value={summary.data?.scannedCount ?? 0}
            tone="surface"
          />
        </View>
        <View className="mt-auto gap-2 pt-6">
          {summary.data?.openInboxCount ? (
            <Button
              title={`Xem ${summary.data.openInboxCount} mục cần xác nhận`}
              variant="soft"
              onPress={() => router.replace('/(app)/(tabs)/inbox')}
            />
          ) : null}
          <Button title="Vào Subca" onPress={continueToApp} />
          <Button title="Thêm gói thủ công" variant="ghost" onPress={() => router.push('/add')} />
        </View>
      </View>
    </Screen>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'mint' | 'peach' | 'sky' | 'surface';
}) {
  return (
    <Card tone={tone} className="min-h-[108px] flex-1 justify-center gap-1 p-4">
      <Text weight="extrabold" tabular className="text-[26px] leading-[32px]">
        {value}
      </Text>
      <Text className="text-[12px] leading-[17px] text-ink-3">{label}</Text>
    </Card>
  );
}

function maskEmail(email: string) {
  if (!email || !email.includes('@')) return 'Gmail đã kết nối';
  const [name, domain] = email.split('@');
  return `${name!.slice(0, 2)}***@${domain}`;
}
