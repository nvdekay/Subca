import { FREE_LIMITS, type SubscriptionDto, type SubscriptionStatus } from '@subca/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { SubscriptionListRow } from '@/components/subscription-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import { useSubscriptions } from '@/features/subscriptions/queries';
import { colors } from '@/theme';

type Filter = 'ALL' | Exclude<SubscriptionStatus, 'ARCHIVED'>;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'TRIAL', label: 'Dùng thử' },
  { value: 'REVIEW', label: 'Cần xem lại' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

/** Bỏ dấu để tìm "netflix" hay "phong gym" đều ra (người dùng hay gõ không dấu). */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Danh sách subscription — màn 3 của mockup. Lọc và tìm ngay trên máy. */
export default function SubscriptionList() {
  const query = useSubscriptions();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      ALL: items.length,
      ACTIVE: 0,
      TRIAL: 0,
      REVIEW: 0,
      CANCELLED: 0,
    };
    for (const s of items) if (s.status !== 'ARCHIVED') c[s.status] += 1;
    return c;
  }, [items]);
  const visible = useMemo(() => {
    const needle = normalize(q.trim());
    return items.filter(
      (s: SubscriptionDto) =>
        (filter === 'ALL' || s.status === filter) &&
        (!needle || normalize(`${s.name} ${s.planName ?? ''}`).includes(needle)),
    );
  }, [items, filter, q]);

  const limit = query.data?.limit;

  return (
    <Screen
      tabBar
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar
        title="Gói đăng ký"
        eyebrow={query.data ? `${items.length} gói trong thư viện` : 'THƯ VIỆN CỦA BẠN'}
        right={
          <IconButton icon="plus" label="Thêm subscription" onPress={() => router.push('/add')} />
        }
      />
      <SearchInput value={q} onChangeText={setQ} placeholder="Tìm Netflix, Spotify, gym…" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mb-1 mt-[14px]"
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 2, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            count={counts[f.value]}
            selected={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </ScrollView>

      {query.data ? (
        <>
          <View className="mx-1 mb-3 mt-[10px] flex-row justify-between">
            <Text className="text-[13px] text-ink-2">{visible.length} subscription</Text>
            {limit != null ? (
              <Text className="text-[13px] text-ink-2">
                Đang theo dõi {query.data.trackedCount}/{limit} · gói Free
              </Text>
            ) : null}
          </View>
          {visible.length > 0 ? (
            <View className="gap-[10px]">
              {visible.map((s) => (
                <SubscriptionListRow key={s.id} sub={s} />
              ))}
            </View>
          ) : items.length === 0 ? (
            <Card className="items-start gap-3 px-5 py-6">
              <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-brass-soft">
                <Text weight="extrabold" className="text-[22px] text-ink-brand">
                  S
                </Text>
              </View>
              <Text weight="bold" className="text-[18px]">
                Bắt đầu từ những gói quen thuộc
              </Text>
              <Text className="text-[13px] leading-[20px] text-ink-3">
                Kết nối email để tìm tự động, hoặc thêm thủ công nếu bạn muốn tự quản lý mọi chi
                tiết.
              </Text>
              <Button
                title="Kết nối Gmail"
                className="mt-1 self-stretch"
                onPress={() => router.push('/connections')}
              />
              <Button
                title="Tự thêm subscription"
                variant="ghost"
                className="self-stretch"
                onPress={() => router.push('/add')}
              />
            </Card>
          ) : (
            <Text className="px-[10px] py-10 text-center text-ink-3">
              Không có subscription nào khớp.
            </Text>
          )}
          {limit != null && query.data.trackedCount >= FREE_LIMITS.maxSubscriptions ? (
            <Text className="mt-4 text-center text-[12.5px] leading-[18px] text-ink-3">
              Gói Free theo dõi tối đa {FREE_LIMITS.maxSubscriptions} subscription. Hủy hoặc lưu trữ
              bớt để thêm mới.
            </Text>
          ) : null}
        </>
      ) : query.isError ? (
        <Card className="mt-4 items-center gap-3">
          <Text className="text-center text-ink-2">{query.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => query.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}
