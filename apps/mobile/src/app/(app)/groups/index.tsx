import type { GroupCardDto, GroupsOverviewDto } from '@subca/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { FxAttribution } from '@/components/fx-attribution';
import { Screen, TopBar } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Text } from '@/components/ui/text';
import { CreateGroupSheet } from '@/features/groups/create-group-sheet';
import { JoinGroupSheet } from '@/features/groups/join-group-sheet';
import { MemberStack } from '@/features/groups/member-avatar';
import { useGroups } from '@/features/groups/queries';
import { formatAmount, formatShortDate } from '@/lib/format';
import { colors, shadow } from '@/theme';

/** Chia tiền nhóm — màn 12 của mockup. */
export default function Groups() {
  const groups = useGroups();
  const [sheet, setSheet] = useState<'create' | 'join' | null>(null);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={groups.isRefetching}
          onRefresh={() => groups.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar
        title="Chia tiền nhóm"
        right={<IconButton icon="plus" label="Tạo nhóm mới" onPress={() => setSheet('create')} />}
      />

      {groups.data ? (
        <Content
          data={groups.data}
          onCreate={() => setSheet('create')}
          onJoin={() => setSheet('join')}
        />
      ) : groups.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{groups.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => groups.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}

      {sheet === 'create' ? (
        <CreateGroupSheet
          visible
          onClose={() => setSheet(null)}
          usedSubscriptionIds={(groups.data?.owned ?? [])
            .map((g) => g.subscriptionId)
            .filter((id): id is string => id !== null)}
        />
      ) : null}
      {sheet === 'join' ? <JoinGroupSheet visible onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}

function Content({
  data,
  onCreate,
  onJoin,
}: {
  data: GroupsOverviewDto;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const atLimit = data.ownedLimit !== null && data.owned.length >= data.ownedLimit;
  return (
    <>
      <View className="flex-row gap-3">
        <SumTile
          tone="bg-mint"
          textClass="text-on-mint"
          label="Sẽ nhận"
          amount={formatAmount(data.incomingMinor, data.currency)}
          note={
            data.incomingPeople > 0
              ? `từ ${data.incomingPeople} người chưa trả`
              : 'Đã thu đủ tháng này'
          }
        />
        <SumTile
          tone="bg-peach"
          textClass="text-on-peach"
          label="Cần trả"
          amount={formatAmount(data.outgoingMinor, data.currency)}
          note={data.outgoingGroups > 0 ? `cho ${data.outgoingGroups} nhóm` : 'Không còn khoản nào'}
        />
      </View>

      {data.missingRates.length > 0 ? (
        <Card tone="peach" className="mt-3 flex-row items-center gap-3 p-[14px]">
          <Icon name="alert" color="#8A4B1E" />
          <Text className="flex-1 text-[13px] leading-[19px] text-on-peach">
            Chưa có tỷ giá {data.missingRates.join(', ')} nên các nhóm này chưa được cộng vào tổng.
          </Text>
        </Card>
      ) : null}

      <SectionHead
        title="Bạn là chủ nhóm"
        note={`${data.owned.length} nhóm${
          data.ownedLimit !== null ? ` / ${data.ownedLimit} (gói Free)` : ''
        }`}
      />
      <View className="gap-3">
        {data.owned.map((g) => (
          <GroupCard key={g.id} group={g} currency={g.currency} />
        ))}
      </View>

      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        className="mt-3 flex-row items-center gap-3 rounded-lg border-[1.5px] border-dashed border-sage bg-surface p-[18px] active:scale-[0.985]"
      >
        <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-mint">
          <Icon name="plus" size={20} color="#2E5B45" strokeWidth={2.2} />
        </View>
        <View className="flex-1">
          <Text weight="bold">Tạo nhóm mới</Text>
          <Text className="text-[13px] leading-[18px] text-ink-3">
            {atLimit
              ? 'Gói Free tạo 1 nhóm. Nâng cấp Plus để tạo thêm.'
              : 'Chia gói gia đình với bạn bè, người thân'}
          </Text>
        </View>
      </Pressable>

      <SectionHead title="Nhóm bạn tham gia" />
      {data.joined.length > 0 ? (
        <View className="gap-3">
          {data.joined.map((g) => (
            <GroupCard key={g.id} group={g} currency={g.currency} />
          ))}
        </View>
      ) : (
        <Card className="items-center gap-2 px-5 py-6">
          <Text className="text-center text-[14px] leading-[21px] text-ink-3">
            Chưa tham gia nhóm nào. Có link mời của bạn bè thì vào nhóm ở đây.
          </Text>
          <Button
            title="Vào nhóm bằng mã mời"
            size="sm"
            variant="soft"
            icon="link"
            onPress={onJoin}
          />
        </Card>
      )}

      {data.joined.length > 0 ? (
        <Button
          title="Vào nhóm bằng mã mời"
          variant="ghost"
          size="sm"
          icon="link"
          className="mt-3"
          onPress={onJoin}
        />
      ) : null}

      <FxAttribution />
    </>
  );
}

function SumTile({
  tone,
  textClass,
  label,
  amount,
  note,
}: {
  tone: string;
  textClass: string;
  label: string;
  amount: string;
  note: string;
}) {
  return (
    <View className={`flex-1 rounded-lg p-[16px] ${tone}`}>
      <Text className={`text-[12.5px] ${textClass}`}>{label}</Text>
      <Text weight="extrabold" tabular className="my-[2px] text-[20px] leading-[26px] text-ink">
        {amount}
      </Text>
      <Text className={`text-[12px] leading-[17px] ${textClass}`}>{note}</Text>
    </View>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <View className="mb-3 mt-6 flex-row items-center justify-between">
      <Text weight="bold" className="text-[16px]">
        {title}
      </Text>
      {note ? <Text className="text-[12.5px] text-ink-3">{note}</Text> : null}
    </View>
  );
}

function GroupCard({
  group,
  currency,
}: {
  group: GroupCardDto;
  currency: GroupCardDto['currency'];
}) {
  const done = group.paidCount >= group.payerCount && group.payerCount > 0;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}
      accessibilityRole="button"
      accessibilityLabel={group.name}
      className="rounded-lg bg-surface p-[18px] active:scale-[0.985]"
      style={{ boxShadow: shadow.sm }}
    >
      <View className="flex-row items-center gap-3">
        <ServiceLogo name={group.name} service={group.service} />
        <View className="flex-1">
          <Text weight="bold" numberOfLines={1}>
            {group.name}
          </Text>
          <Text className="text-[12.5px] leading-[18px] text-ink-3">
            {group.isOwner ? 'Bạn là chủ nhóm' : `Chủ nhóm: ${group.ownerName}`} · hạn{' '}
            {formatShortDate(group.dueDate)}
          </Text>
        </View>
        <View className="items-end">
          <Text weight="bold" tabular>
            {formatAmount(group.myShareMinor, currency)}
          </Text>
          <Text className="text-[11.5px] text-ink-3">
            {group.isOwner ? 'phần của bạn' : 'bạn cần trả'}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between border-t border-line pt-3">
        <MemberStack members={group.members} />
        {group.isOwner ? (
          <Pill
            label={done ? 'Đã thu đủ' : `${group.paidCount}/${group.payerCount} đã trả`}
            tone={done ? 'active' : 'review'}
            icon={done ? 'check' : undefined}
          />
        ) : (
          <Pill
            label={
              group.myPaymentStatus === 'CONFIRMED'
                ? 'Bạn đã trả'
                : group.myPaymentStatus === 'CLAIMED_PAID'
                  ? 'Chờ xác nhận'
                  : group.myPaymentStatus === 'WAIVED'
                    ? 'Được miễn'
                    : 'Bạn chưa trả'
            }
            tone={
              group.myPaymentStatus === 'CONFIRMED'
                ? 'active'
                : group.myPaymentStatus === 'CLAIMED_PAID'
                  ? 'trial'
                  : group.myPaymentStatus === 'WAIVED'
                    ? 'cancel'
                    : 'warn'
            }
            icon={group.myPaymentStatus === 'CONFIRMED' ? 'check' : undefined}
          />
        )}
      </View>
    </Pressable>
  );
}
