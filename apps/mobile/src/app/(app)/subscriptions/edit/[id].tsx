import type { SubscriptionDetailDto, UpdateSubscriptionInput } from '@subca/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { useSubscription, useUpdateSubscription } from '@/features/subscriptions/queries';
import { alertSaveError } from '@/features/subscriptions/save-error';
import { SubscriptionForm, valuesFrom } from '@/features/subscriptions/subscription-form';
import { colors } from '@/theme';

/** Sửa subscription: cùng form với màn Thêm, chỉ gửi các trường đã đổi. */
export default function EditSubscription() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useSubscription(id);
  const update = useUpdateSubscription(id);

  return (
    <Screen keyboard modal>
      <TopBar title="Chỉnh sửa" close />
      {detail.data ? (
        <EditForm
          sub={detail.data}
          submitting={update.isPending}
          onSubmit={(input) => {
            if (Object.keys(input).length === 0) {
              router.back();
              return;
            }
            update.mutate(input, { onSuccess: () => router.back(), onError: alertSaveError });
          }}
        />
      ) : detail.isError ? (
        <Text className="mt-10 text-center text-ink-3">{detail.error.message}</Text>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}
    </Screen>
  );
}

/** Giữ nguyên giá trị ban đầu kể cả khi dữ liệu được làm mới nền, để so đúng các trường đã đổi. */
function EditForm({
  sub,
  submitting,
  onSubmit,
}: {
  sub: SubscriptionDetailDto;
  submitting: boolean;
  onSubmit: (input: UpdateSubscriptionInput) => void;
}) {
  const [initial] = useState(() => valuesFrom(sub));
  return (
    <SubscriptionForm
      mode="edit"
      initial={initial}
      submitting={submitting}
      onSubmitUpdate={onSubmit}
    />
  );
}
