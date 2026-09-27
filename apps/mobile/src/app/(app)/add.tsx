import { router } from 'expo-router';
import { useState } from 'react';
import { Screen, TopBar } from '@/components/screen';
import { useCreateSubscription } from '@/features/subscriptions/queries';
import { alertSaveError } from '@/features/subscriptions/save-error';
import { emptyValues, SubscriptionForm } from '@/features/subscriptions/subscription-form';

/** Thêm subscription — màn 4 của mockup (mở dạng modal). */
export default function AddSubscription() {
  const create = useCreateSubscription();
  const [initial] = useState(emptyValues);
  return (
    <Screen keyboard modal>
      <TopBar title="Thêm subscription" close />
      <SubscriptionForm
        mode="create"
        initial={initial}
        submitting={create.isPending}
        onSubmitCreate={(input) =>
          create.mutate(input, {
            onSuccess: (created) =>
              router.replace({ pathname: '/subscriptions/[id]', params: { id: created.id } }),
            onError: alertSaveError,
          })
        }
      />
    </Screen>
  );
}
