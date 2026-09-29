import {
  groupTransferNote,
  type GroupCycleDto,
  type GroupDetailDto,
  type GroupMemberDto,
} from '@subca/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Share,
  TextInput,
  View,
} from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Progress } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { EditGroupSheet, PayoutSheet } from '@/features/groups/group-sheets';
import { MemberAvatar } from '@/features/groups/member-avatar';
import { QrCard } from '@/features/groups/qr-card';
import {
  useAddGroupMember,
  useArchiveGroup,
  useGroup,
  usePaymentAction,
  useRemindAll,
  useRemoveGroupMember,
  useSetSplit,
} from '@/features/groups/queries';
import { cn } from '@/lib/cn';
import { formatAmount, formatShortDate } from '@/lib/format';
import { colors, fontFamily, shadow } from '@/theme';

type SheetKind = 'options' | 'edit' | 'payout' | 'qr' | null;

/** Chi tiết nhóm — màn 13 của mockup. */
export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  const [sheet, setSheet] = useState<SheetKind>(null);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={group.isRefetching}
          onRefresh={() => group.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar
        title="Chi tiết nhóm"
        right={
          group.data ? (
            <IconButton icon="more" label="Tùy chọn nhóm" onPress={() => setSheet('options')} />
          ) : undefined
        }
      />

      {group.data ? (
        <Content data={group.data} openSheet={setSheet} />
      ) : group.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{group.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => group.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}

      {group.data && sheet === 'options' ? (
        <OptionsSheet group={group.data} onClose={() => setSheet(null)} openSheet={setSheet} />
      ) : null}
      {group.data && sheet === 'edit' ? (
        <EditGroupSheet visible group={group.data} onClose={() => setSheet(null)} />
      ) : null}
      {group.data && sheet === 'payout' ? (
        <PayoutSheet visible group={group.data} onClose={() => setSheet(null)} />
      ) : null}
      {group.data && sheet === 'qr' && group.data.payout ? (
        <Sheet
          visible
          onClose={() => setSheet(null)}
          title="Mã QR nhận tiền"
          subtitle="Gửi cho thành viên để chuyển khoản nhanh, nội dung đã điền sẵn."
        >
          <QrCard
            payload={group.data.vietQrPayload}
            payout={group.data.payout}
            amountMinor={null}
            currency={group.data.currency}
            note={group.data.transferNote}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

function Content({
  data,
  openSheet,
}: {
  data: GroupDetailDto;
  openSheet: (sheet: SheetKind) => void;
}) {
  return (
    <>
      <Hero data={data} />
      {data.isOwner ? <OwnerBody data={data} openSheet={openSheet} /> : <MemberBody data={data} />}
      <History cycle={data.cycle} history={data.history} />
    </>
  );
}

function Hero({ data }: { data: GroupDetailDto }) {
  return (
    <View
      className={cn(
        'items-center rounded-sm border border-line px-5 py-6',
        data.isOwner ? 'bg-mint' : 'bg-sky-soft',
      )}
    >
      <ServiceLogo name={data.name} service={data.service} size="lg" />
      <Text weight="extrabold" className="mt-3 text-center text-[22px] leading-[28px]">
        {data.name}
      </Text>
      <Text className="mt-1 text-center text-[13px] leading-[19px] text-ink-2">
        {data.isOwner ? 'Bạn là chủ nhóm' : `Chủ nhóm: ${data.ownerName}`} · {data.members.length}{' '}
        người · {data.splitMode === 'EQUAL' ? 'chia đều' : 'chia tùy chỉnh'}
      </Text>
      <Text weight="extrabold" tabular className="mt-3 text-[30px] leading-[36px]">
        {formatAmount(data.myShareMinor, data.currency)}
        <Text className="text-[14px] text-ink-2"> / phần của bạn</Text>
      </Text>
      <Text className="mt-[2px] text-[12.5px] text-ink-2">
        Tổng {formatAmount(data.totalAmountMinor, data.currency)}/tháng · hạn chuyển{' '}
        {formatShortDate(data.cycle.dueDate)}
      </Text>
    </View>
  );
}

function OwnerBody({
  data,
  openSheet,
}: {
  data: GroupDetailDto;
  openSheet: (sheet: SheetKind) => void;
}) {
  const setSplit = useSetSplit(data.id);
  const remindAll = useRemindAll(data.id);
  const [custom, setCustom] = useState<Record<string, string> | null>(null);

  const expected = BigInt(data.cycle.expectedMinor);
  const collected = BigInt(data.cycle.collectedMinor);
  const percent = expected > 0n ? Number((collected * 100n) / expected) : 0;
  const unpaid = data.members.filter(
    (m) => m.payment && m.payment.status !== 'CONFIRMED' && m.payment.status !== 'WAIVED',
  );
  const customTotal = custom
    ? Object.values(custom).reduce((a, t) => a + BigInt(t || '0'), 0n)
    : 0n;
  const diff = BigInt(data.totalAmountMinor) - customTotal;

  const startCustom = () =>
    setCustom(Object.fromEntries(data.members.map((m) => [m.id, m.shareMinor])));

  return (
    <>
      <Card className="mt-3">
        <View className="flex-row items-center justify-between">
          <Text weight="bold">Đã thu tháng này</Text>
          <Text tabular className="text-[14px] text-ink-3">
            <Text weight="bold" tabular>
              {formatAmount(data.cycle.collectedMinor, data.currency)}
            </Text>{' '}
            / {formatAmount(data.cycle.expectedMinor, data.currency)}
          </Text>
        </View>
        <View className="mt-3">
          <Progress percent={percent} />
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-[12.5px] text-ink-3">
            {data.cycle.paidCount}/{data.cycle.payerCount} người đã trả
          </Text>
          <Text className="text-[12.5px] text-ink-3">
            Phần của bạn: {formatAmount(data.myShareMinor, data.currency)}
          </Text>
        </View>
      </Card>

      <Text weight="bold" className="mb-3 mt-6 text-[16px]">
        Thành viên
      </Text>
      <Segmented
        options={[
          { value: 'EQUAL', label: 'Chia đều' },
          { value: 'CUSTOM', label: 'Tùy chỉnh' },
        ]}
        value={custom ? 'CUSTOM' : data.splitMode}
        onChange={(mode) => {
          if (mode === 'CUSTOM') startCustom();
          else {
            setCustom(null);
            if (data.splitMode !== 'EQUAL') setSplit.mutate({ splitMode: 'EQUAL' });
          }
        }}
      />

      <View className="mt-3 rounded-lg bg-surface px-[18px]" style={{ boxShadow: shadow.sm }}>
        {data.members.map((m, i) => (
          <MemberRow
            key={m.id}
            member={m}
            group={data}
            index={i}
            last={i === data.members.length - 1}
            customAmount={custom?.[m.id]}
            onCustomChange={(text) => setCustom({ ...(custom ?? {}), [m.id]: text })}
          />
        ))}
      </View>

      {custom ? (
        <>
          <View
            className={cn(
              'mt-3 flex-row items-center gap-[10px] rounded-sm p-[14px]',
              diff === 0n ? 'bg-mint' : 'bg-coral',
            )}
          >
            <Icon
              name={diff === 0n ? 'check-circle' : 'alert'}
              color={diff === 0n ? colors['on-mint'] : colors['on-coral']}
            />
            <Text
              className={cn(
                'flex-1 text-[13px] leading-[19px]',
                diff === 0n ? 'text-on-mint' : 'text-on-coral',
              )}
            >
              {diff === 0n
                ? 'Đã chia khớp tổng tiền gói'
                : diff > 0n
                  ? `Còn thiếu ${formatAmount(diff.toString(), data.currency)} so với giá gói`
                  : `Đang dư ${formatAmount((-diff).toString(), data.currency)} so với giá gói`}
            </Text>
          </View>
          <Button
            title="Lưu cách chia"
            disabled={diff !== 0n}
            loading={setSplit.isPending}
            className="mt-3"
            onPress={() =>
              setSplit.mutate(
                {
                  splitMode: 'CUSTOM',
                  shares: Object.entries(custom).map(([memberId, amountMinor]) => ({
                    memberId,
                    amountMinor: amountMinor || '0',
                  })),
                },
                { onSuccess: () => setCustom(null) },
              )
            }
          />
        </>
      ) : null}

      <View className="mt-4 flex-row gap-3">
        <Button
          title="Mã QR"
          variant="soft"
          icon="qr"
          className="flex-1"
          onPress={() => openSheet(data.payout ? 'qr' : 'payout')}
        />
        <Button
          title={unpaid.length > 0 ? `Nhắc (${unpaid.length})` : 'Nhắc tất cả'}
          icon="bell"
          className="flex-1"
          disabled={unpaid.length === 0}
          loading={remindAll.isPending}
          onPress={() =>
            remindAll.mutate(undefined, {
              onSuccess: ({ reminded, skipped }) =>
                Alert.alert(
                  reminded > 0 ? 'Đã gửi nhắc' : 'Chưa nhắc được ai',
                  reminded > 0
                    ? `Đã nhắc ${reminded} người.${skipped > 0 ? ` Bỏ qua ${skipped} người (chưa tham gia hoặc vừa nhắc).` : ''}`
                    : 'Những người còn lại chưa tham gia nhóm hoặc vừa được nhắc xong.',
                ),
            })
          }
        />
      </View>

      {!data.payout ? (
        <Card tone="sky" className="mt-3 gap-2">
          <Text weight="bold">Thêm thông tin nhận tiền</Text>
          <Text className="text-[13px] leading-[19px] text-on-sky">
            Có số tài khoản là thành viên thấy mã QR chuyển nhanh với số tiền điền sẵn.
          </Text>
          <Button
            title="Nhập số tài khoản"
            size="sm"
            variant="soft"
            className="mt-1 self-start"
            onPress={() => openSheet('payout')}
          />
        </Card>
      ) : null}

      <View className="mb-3 mt-6 flex-row items-center justify-between">
        <Text weight="bold" className="text-[16px]">
          Mời thêm người
        </Text>
        <Text className="text-[12.5px] text-ink-3">
          {data.members.length}/{data.maxMembers} chỗ
        </Text>
      </View>
      <Card className="gap-3">
        <Text className="text-[13.5px] leading-[20px] text-ink-2">
          Gửi link để bạn bè vào nhóm và nhận nhắc chuyển tiền mỗi tháng.
        </Text>
        <View className="flex-row items-center gap-2 rounded-sm bg-bg px-3 py-[10px]">
          <Text tabular className="flex-1 text-[13px]" numberOfLines={1}>
            {data.inviteUrl.replace('https://', '')}
          </Text>
          <Button
            title="Chia sẻ"
            size="sm"
            icon="link"
            onPress={() =>
              Share.share({
                message: `Vào nhóm ${data.name} trên Subca để chia tiền gói này: ${data.inviteUrl}`,
              })
            }
          />
        </View>
      </Card>
    </>
  );
}

function MemberBody({ data }: { data: GroupDetailDto }) {
  const action = usePaymentAction(data.id);
  const me = data.members.find((m) => m.isMe);
  const payment = me?.payment ?? null;
  const done = payment?.status === 'CONFIRMED' || payment?.status === 'WAIVED';

  return (
    <>
      {done ? (
        <Card tone="mint" className="mt-3 flex-row items-center gap-3">
          <Icon name="check-circle" color={colors['on-mint']} />
          <View className="flex-1">
            <Text weight="bold">
              {payment?.status === 'WAIVED' ? 'Bạn được miễn tháng này' : 'Bạn đã trả tháng này'}
            </Text>
            <Text className="text-[12.5px] text-on-mint">
              {payment?.confirmedAt
                ? `Chủ nhóm xác nhận ${formatShortDate(payment.confirmedAt.slice(0, 10))}`
                : `Nhóm ${data.name}`}
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <Card tone={payment?.status === 'CLAIMED_PAID' ? 'sky' : 'coral'} className="mt-3">
            <Text weight="bold" className="text-[16px]">
              {payment?.status === 'CLAIMED_PAID'
                ? `Đang chờ ${data.ownerName} xác nhận`
                : `Bạn cần trả ${data.ownerName} ${formatAmount(data.myShareMinor, data.currency)}`}
            </Text>
            <Text className="mt-[2px] text-[13px] leading-[19px] text-ink-2">
              {payment?.status === 'CLAIMED_PAID'
                ? 'Bạn đã báo là đã chuyển tiền. Chủ nhóm sẽ xác nhận khi thấy tiền về.'
                : `Trước ${formatShortDate(data.cycle.dueDate)} · quét mã hoặc chuyển khoản theo thông tin bên dưới`}
            </Text>
          </Card>

          {data.payout ? (
            <QrCard
              payload={data.vietQrPayload}
              payout={data.payout}
              amountMinor={data.myShareMinor}
              currency={data.currency}
              note={data.transferNote ?? groupTransferNote(data.name, data.cycle.period)}
            />
          ) : (
            <Card className="mt-3">
              <Text className="text-[13.5px] leading-[20px] text-ink-2">
                Chủ nhóm chưa nhập số tài khoản nhận tiền. Nhắn trực tiếp để lấy thông tin chuyển
                khoản nhé.
              </Text>
            </Card>
          )}

          {payment && payment.status === 'PENDING' ? (
            <Button
              title="Tôi đã chuyển"
              icon="check"
              loading={action.isPending}
              className="mt-3"
              onPress={() =>
                Alert.alert(
                  'Đã chuyển tiền?',
                  `Subca sẽ báo ${data.ownerName} để xác nhận đã nhận ${formatAmount(payment.amountMinor, data.currency)}.`,
                  [
                    { text: 'Chưa', style: 'cancel' },
                    {
                      text: 'Tôi đã chuyển',
                      onPress: () => action.mutate({ paymentId: payment.id, action: 'claim' }),
                    },
                  ],
                )
              }
            />
          ) : null}
        </>
      )}

      <View className="mb-3 mt-6 flex-row items-center justify-between">
        <Text weight="bold" className="text-[16px]">
          Thành viên
        </Text>
        <Text className="text-[12.5px] text-ink-3">
          {data.cycle.paidCount}/{data.cycle.payerCount} đã trả
        </Text>
      </View>
      <View className="rounded-lg bg-surface px-[18px]" style={{ boxShadow: shadow.sm }}>
        {data.members.map((m, i) => (
          <MemberRow
            key={m.id}
            member={m}
            group={data}
            index={i}
            last={i === data.members.length - 1}
          />
        ))}
      </View>
    </>
  );
}

/** Nhãn trạng thái dưới tên thành viên. */
function memberTag(m: GroupMemberDto, isOwnerView: boolean): { text: string; warn: boolean } {
  if (m.role === 'OWNER') return { text: m.isMe ? 'Bạn · chủ nhóm' : 'Chủ nhóm', warn: false };
  if (m.status === 'INVITED') return { text: 'Đã gửi link mời', warn: false };
  const status = m.payment?.status;
  if (status === 'CONFIRMED') return { text: m.isMe ? 'Bạn · đã trả' : 'Đã trả', warn: false };
  if (status === 'WAIVED') return { text: 'Được miễn kỳ này', warn: false };
  if (status === 'CLAIMED_PAID')
    return {
      text: isOwnerView ? 'Đã báo đã chuyển · chờ bạn xác nhận' : 'Đã báo đã chuyển',
      warn: false,
    };
  if (m.payment?.lastRemindedAt) return { text: 'Chưa trả · đã nhắc', warn: true };
  return { text: m.isMe ? 'Bạn · chưa trả' : 'Chưa trả', warn: true };
}

function MemberRow({
  member,
  group,
  index,
  last,
  customAmount,
  onCustomChange,
}: {
  member: GroupMemberDto;
  group: GroupDetailDto;
  index: number;
  last: boolean;
  customAmount?: string;
  onCustomChange?: (text: string) => void;
}) {
  const action = usePaymentAction(group.id);
  const remove = useRemoveGroupMember(group.id);
  const tag = memberTag(member, group.isOwner);
  const payment = member.payment;
  const owing = payment && (payment.status === 'PENDING' || payment.status === 'CLAIMED_PAID');

  const confirmRemove = () =>
    Alert.alert(
      member.status === 'INVITED' ? 'Bỏ chỗ này?' : `Gỡ ${member.displayName}?`,
      'Khoản chưa trả của kỳ này sẽ bị xóa, phần của những người còn lại được chia lại.',
      [
        { text: 'Thôi', style: 'cancel' },
        { text: 'Gỡ', style: 'destructive', onPress: () => remove.mutate(member.id) },
      ],
    );

  return (
    <View className={cn('py-[13px]', !last && 'border-b border-line')}>
      <View className="flex-row items-center gap-3">
        <MemberAvatar member={member} index={index} size="lg" />
        <View className="flex-1">
          <Text weight="bold" numberOfLines={1}>
            {member.isMe ? 'Bạn' : member.displayName}
          </Text>
          <Text
            className={cn(
              'text-[12.5px] leading-[18px]',
              tag.warn ? 'text-coral-deep' : 'text-ink-3',
            )}
            weight={tag.warn ? 'semibold' : 'regular'}
          >
            {tag.text}
          </Text>
        </View>
        {customAmount !== undefined && onCustomChange ? (
          <TextInput
            value={customAmount}
            onChangeText={(t) => onCustomChange(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            accessibilityLabel={`Số tiền của ${member.displayName}`}
            className="h-10 w-[104px] rounded-sm bg-bg px-3 text-right text-[14px] text-ink"
            style={{ fontFamily: fontFamily.semibold }}
          />
        ) : (
          <Text weight="bold" tabular>
            {formatAmount(member.shareMinor, group.currency)}
          </Text>
        )}
      </View>

      {group.isOwner && customAmount === undefined ? (
        <View className="mt-[10px] flex-row gap-2 pl-[56px]">
          {member.status === 'INVITED' ? (
            <>
              <MiniButton
                icon="copy"
                title="Link mời"
                onPress={() =>
                  Share.share({
                    message: `Vào nhóm ${group.name} trên Subca để chia tiền gói này: ${group.inviteUrl}`,
                  })
                }
              />
              <MiniButton icon="x" title="Bỏ chỗ" onPress={confirmRemove} />
            </>
          ) : owing ? (
            <>
              <MiniButton
                icon="bell"
                title="Nhắc"
                loading={action.isPending}
                onPress={() =>
                  action.mutate(
                    { paymentId: payment.id, action: 'remind' },
                    {
                      onError: (error) => Alert.alert('Chưa nhắc được', error.message),
                      onSuccess: () =>
                        Alert.alert('Đã gửi nhắc', `Subca vừa nhắc ${member.displayName}.`),
                    },
                  )
                }
              />
              <MiniButton
                icon="check"
                title="Đã nhận"
                dark
                onPress={() => action.mutate({ paymentId: payment.id, action: 'confirm' })}
              />
              <MiniButton
                icon="archive"
                title="Miễn"
                onPress={() =>
                  Alert.alert(
                    `Miễn phần của ${member.displayName}?`,
                    'Kỳ này coi như xong, không tính vào số cần thu.',
                    [
                      { text: 'Thôi', style: 'cancel' },
                      {
                        text: 'Miễn',
                        onPress: () => action.mutate({ paymentId: payment.id, action: 'waive' }),
                      },
                    ],
                  )
                }
              />
            </>
          ) : payment ? (
            <MiniButton
              icon="repeat"
              title="Mở lại"
              onPress={() => action.mutate({ paymentId: payment.id, action: 'reopen' })}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MiniButton({
  icon,
  title,
  dark = false,
  loading = false,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  dark?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      className={cn(
        'h-9 flex-row items-center gap-[5px] rounded-full px-3 active:scale-95',
        dark ? 'bg-ink' : 'bg-bg',
        loading && 'opacity-60',
      )}
    >
      <Icon name={icon} size={15} color={dark ? '#FFFFFF' : colors['ink-2']} strokeWidth={2.1} />
      <Text weight="semibold" className={cn('text-[12.5px]', dark ? 'text-white' : 'text-ink-2')}>
        {title}
      </Text>
    </Pressable>
  );
}

function History({ cycle, history }: { cycle: GroupCycleDto; history: GroupCycleDto[] }) {
  return (
    <>
      <Text weight="bold" className="mb-3 mt-6 text-[16px]">
        Lịch sử
      </Text>
      <Card>
        <Row
          label={`Tháng ${Number(cycle.period.slice(5, 7))}`}
          note="đang thu"
          right={`${cycle.paidCount}/${cycle.payerCount}`}
          first
        />
        {history.map((c) => (
          <Row
            key={c.period}
            label={`Tháng ${Number(c.period.slice(5, 7))}`}
            note={`${c.paidCount}/${c.payerCount} đã trả`}
            right={c.paidCount >= c.payerCount ? 'done' : 'missing'}
          />
        ))}
        {history.length === 0 ? (
          <Text className="mt-2 text-[13px] text-ink-3">Chưa có kỳ nào trước đó.</Text>
        ) : null}
      </Card>
    </>
  );
}

function Row({
  label,
  note,
  right,
  first = false,
}: {
  label: string;
  note: string;
  right: string;
  first?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between gap-3 py-[10px]',
        !first && 'border-t border-line',
      )}
    >
      <Text className="text-[14px]">
        {label} <Text className="text-[13px] text-ink-3">· {note}</Text>
      </Text>
      {right === 'done' ? (
        <Icon name="check" size={18} color={colors['on-mint']} strokeWidth={2.2} />
      ) : right === 'missing' ? (
        <Icon name="alert" size={18} color={colors['coral-deep']} />
      ) : (
        <Text weight="bold" tabular className="text-[14px]">
          {right}
        </Text>
      )}
    </View>
  );
}

function OptionsSheet({
  group,
  onClose,
  openSheet,
}: {
  group: GroupDetailDto;
  onClose: () => void;
  openSheet: (sheet: SheetKind) => void;
}) {
  const archive = useArchiveGroup(group.id);
  const addMember = useAddGroupMember(group.id);
  const remove = useRemoveGroupMember(group.id);
  const me = group.members.find((m) => m.isMe);
  const full = group.members.length >= group.maxMembers;

  const leaveOrDelete = () => {
    if (group.isOwner) {
      Alert.alert('Xóa nhóm này?', 'Nhóm sẽ biến mất khỏi danh sách của mọi thành viên.', [
        { text: 'Thôi', style: 'cancel' },
        {
          text: 'Xóa nhóm',
          style: 'destructive',
          onPress: () =>
            archive.mutate(undefined, {
              onSuccess: () => {
                onClose();
                router.back();
              },
            }),
        },
      ]);
      return;
    }
    Alert.alert('Rời nhóm này?', 'Bạn sẽ không nhận nhắc chuyển tiền của nhóm nữa.', [
      { text: 'Thôi', style: 'cancel' },
      {
        text: 'Rời nhóm',
        style: 'destructive',
        onPress: () =>
          me &&
          remove.mutate(me.id, {
            onSuccess: () => {
              onClose();
              router.back();
            },
          }),
      },
    ]);
  };

  return (
    <Sheet visible onClose={onClose} title="Tùy chọn nhóm" subtitle={group.name}>
      <View className="overflow-hidden rounded-sm bg-surface">
        {group.isOwner ? (
          <>
            <OptionRow
              icon="edit"
              title="Thông tin nhóm"
              note="Tên, giá gói, hạn chuyển tiền"
              onPress={() => {
                onClose();
                openSheet('edit');
              }}
            />
            <OptionRow
              icon="card"
              title="Thông tin nhận tiền"
              note={
                group.payout ? `${group.payout.accountNo}` : 'Chưa có — thành viên không thấy QR'
              }
              onPress={() => {
                onClose();
                openSheet('payout');
              }}
            />
            <OptionRow
              icon="plus"
              title="Thêm chỗ cho thành viên"
              note={full ? `Đã đủ ${group.maxMembers} chỗ` : `Đang có ${group.members.length} chỗ`}
              disabled={full}
              onPress={() =>
                addMember.mutate(
                  { displayName: 'Chờ tham gia' },
                  {
                    onSuccess: onClose,
                    onError: (error) => Alert.alert('Chưa thêm được', error.message),
                  },
                )
              }
            />
          </>
        ) : null}
        <OptionRow
          icon="logout"
          title={group.isOwner ? 'Xóa nhóm' : 'Rời nhóm'}
          note={group.isOwner ? 'Giữ lịch sử, chỉ ẩn khỏi danh sách' : undefined}
          danger
          onPress={leaveOrDelete}
        />
      </View>
    </Sheet>
  );
}

function OptionRow({
  icon,
  title,
  note,
  danger = false,
  disabled = false,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  note?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn(
        'flex-row items-center gap-3 border-t border-line px-4 py-[14px] first:border-t-0 active:bg-bg',
        disabled && 'opacity-50',
      )}
    >
      <Icon name={icon} size={19} color={danger ? colors['coral-deep'] : colors['ink-2']} />
      <View className="flex-1">
        <Text weight="semibold" className={danger ? 'text-coral-deep' : undefined}>
          {title}
        </Text>
        {note ? <Text className="text-[12.5px] text-ink-3">{note}</Text> : null}
      </View>
    </Pressable>
  );
}
