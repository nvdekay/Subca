import { MAX_GROUP_MEMBERS, type SubscriptionDto } from '@subca/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useSubscriptions } from '@/features/subscriptions/queries';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/format';
import { colors } from '@/theme';
import { useCreateGroup } from './queries';

/**
 * Tạo nhóm từ một gói đang trả (mockup: sheet "Tạo nhóm chia tiền"): chọn gói, chọn số người,
 * xem trước mỗi người trả bao nhiêu. Chia đều trước, đổi sang tùy chỉnh ở màn Chi tiết nhóm.
 */
export function CreateGroupSheet({
  visible,
  onClose,
  /** Gói đã có nhóm thì không cho chia lại. */
  usedSubscriptionIds,
}: {
  visible: boolean;
  onClose: () => void;
  usedSubscriptionIds: string[];
}) {
  const subs = useSubscriptions();
  const create = useCreateGroup();
  const candidates = (subs.data?.items ?? []).filter(
    (s) => s.status !== 'CANCELLED' && !usedSubscriptionIds.includes(s.id),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const selected: SubscriptionDto | undefined =
    candidates.find((s) => s.id === picked) ?? candidates[0];

  const share = selected ? (BigInt(selected.amountMinor) / BigInt(count)).toString() : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Tạo nhóm chia tiền"
      subtitle="Chọn gói bạn đang trả và số người dùng chung."
    >
      {candidates.length === 0 ? (
        <>
          <Text className="text-[14px] leading-[21px] text-ink-2">
            Chưa có gói nào để chia. Thêm gói bạn đang trả (Netflix, Spotify Family…) rồi tạo nhóm.
          </Text>
          <Button
            title="Thêm subscription"
            icon="plus"
            className="mt-4"
            onPress={() => {
              onClose();
              router.push('/add');
            }}
          />
        </>
      ) : (
        <>
          <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] text-ink-2">
            Gói dùng chung
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 px-1">
            <View className="flex-row gap-2 pb-1">
              {candidates.map((s) => {
                const on = s.id === selected?.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setPicked(s.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className={cn(
                      'w-[96px] items-center gap-[6px] rounded-sm border-[1.5px] bg-surface px-2 py-3',
                      on ? 'border-sky' : 'border-transparent',
                    )}
                  >
                    <ServiceLogo name={s.name} service={s.service} size="sm" />
                    <Text
                      weight={on ? 'bold' : 'medium'}
                      className="text-center text-[12.5px]"
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View className="mt-4 flex-row items-center justify-between">
            <View>
              <Text weight="semibold" className="text-[13px] text-ink-2">
                Số người (gồm bạn)
              </Text>
              <Text className="text-[12.5px] text-ink-3">Tối đa {MAX_GROUP_MEMBERS} người</Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-surface p-1">
              <StepButton
                icon="minus"
                label="Bớt người"
                disabled={count <= 2}
                onPress={() => setCount(Math.max(2, count - 1))}
              />
              <Text weight="bold" tabular className="w-8 text-center text-[17px]">
                {count}
              </Text>
              <StepButton
                icon="plus"
                label="Thêm người"
                disabled={count >= MAX_GROUP_MEMBERS}
                onPress={() => setCount(Math.min(MAX_GROUP_MEMBERS, count + 1))}
              />
            </View>
          </View>

          {selected && share ? (
            <View className="mt-4 flex-row items-end justify-between rounded-lg bg-mint p-[18px]">
              <View>
                <Text className="text-[13px] text-on-mint">Mỗi người trả</Text>
                <Text weight="extrabold" tabular className="text-[22px] leading-[28px] text-ink">
                  {formatAmount(share, selected.currency)}
                </Text>
              </View>
              <Text className="flex-1 text-right text-[12.5px] text-on-mint" numberOfLines={2}>
                {selected.name} · {formatAmount(selected.amountMinor, selected.currency)}
              </Text>
            </View>
          ) : null}

          {create.isError ? (
            <Text className="ml-1 mt-3 text-[13px] leading-[18px] text-coral-deep">
              {create.error.message}
            </Text>
          ) : null}

          <Button
            title="Tạo nhóm & lấy link mời"
            icon="link"
            loading={create.isPending}
            className="mt-4"
            onPress={() => {
              if (!selected) return;
              create.mutate(
                { subscriptionId: selected.id, memberCount: count },
                {
                  onSuccess: (group) => {
                    onClose();
                    router.push({ pathname: '/groups/[id]', params: { id: group.id } });
                  },
                },
              );
            }}
          />
        </>
      )}
    </Sheet>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'plus' | 'minus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={cn(
        'h-9 w-9 items-center justify-center rounded-full bg-bg active:scale-95',
        disabled && 'opacity-40',
      )}
    >
      <Icon name={icon} size={18} color={colors.ink} strokeWidth={2.2} />
    </Pressable>
  );
}
