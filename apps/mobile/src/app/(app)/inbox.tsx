import type { InboxItemDto } from '@subca/shared';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useInbox, useResolveInboxItem } from '@/features/detection/queries';
import { colors } from '@/theme';

/** Subca Inbox — chỉ những việc Subca không tự quyết được. */
export default function Inbox() {
  const inbox = useInbox();

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={inbox.isRefetching}
          onRefresh={() => inbox.refetch()}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar title="Cần bạn xác nhận" />

      {inbox.data ? (
        inbox.data.items.length > 0 ? (
          <>
            <Text className="-mt-[6px] mb-4 ml-1 text-[14px] leading-[21px] text-ink-2">
              Subca chỉ hỏi khi chưa chắc. Trả lời xong là danh sách subscription tự cập nhật.
            </Text>
            <View className="gap-3">
              {inbox.data.items.map((item) => (
                <InboxCard key={item.id} item={item} />
              ))}
            </View>
          </>
        ) : (
          <Card className="items-center gap-3 px-6 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-mint">
              <Icon name="check-circle" size={26} color="#2E5B45" />
            </View>
            <Text weight="bold" className="text-[17px]">
              Không có việc nào cần bạn
            </Text>
            <Text className="text-center text-[14px] leading-[21px] text-ink-3">
              Subca đang tự theo dõi. Khi có gì chưa chắc — gói lạ, đổi giá, thanh toán lỗi — nó sẽ
              hiện ở đây.
            </Text>
          </Card>
        )
      ) : inbox.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{inbox.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => inbox.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

function InboxCard({ item }: { item: InboxItemDto }) {
  const resolve = useResolveInboxItem();
  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-3">
        <ServiceLogo name={item.title} service={item.service} />
        <View className="flex-1">
          <Text weight="bold" className="text-[15.5px] leading-[21px]">
            {item.title}
          </Text>
          <Text className="mt-[2px] text-[13px] leading-[19px] text-ink-2">{item.body}</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {item.actions.map((action) => (
          <Button
            key={action.key}
            title={action.label}
            size="sm"
            variant={
              action.tone === 'primary' ? 'primary' : action.tone === 'danger' ? 'coral' : 'soft'
            }
            loading={resolve.isPending}
            onPress={() => resolve.mutate({ id: item.id, action: action.key as never })}
          />
        ))}
        {item.subscriptionId ? (
          <Button
            title="Xem gói"
            size="sm"
            variant="ghost"
            onPress={() =>
              router.push({ pathname: '/subscriptions/[id]', params: { id: item.subscriptionId! } })
            }
          />
        ) : null}
      </View>
      {resolve.isError ? (
        <Text className="text-[12.5px] text-coral-deep">{resolve.error.message}</Text>
      ) : null}
    </Card>
  );
}
