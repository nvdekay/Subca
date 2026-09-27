import {
  CreatePaymentMethodSchema,
  type PaymentMethodDto,
  type PaymentMethodType,
} from '@subca/shared';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { PAYMENT_TYPE_LABEL } from '@/features/subscriptions/labels';
import { BRAND_LABEL, BRANDS_BY_TYPE } from './card-style';
import { useDeletePaymentMethod, useSavePaymentMethod } from './queries';

const TYPES: PaymentMethodType[] = [
  'CARD',
  'E_WALLET',
  'PAYPAL',
  'APP_STORE',
  'GOOGLE_PLAY',
  'BANK_TRANSFER',
  'OTHER',
];

/** Tên gợi ý khi người dùng chưa gõ tên, VD "Visa", "MoMo", "App Store". */
function suggestedLabel(type: PaymentMethodType, brand: string | null): string {
  return brand ? (BRAND_LABEL[brand] ?? brand) : PAYMENT_TYPE_LABEL[type];
}

/** Bottom sheet thêm / sửa phương thức thanh toán. `method` = null là thêm mới. */
export function PaymentMethodSheet({
  visible,
  method,
  onClose,
}: {
  visible: boolean;
  method: PaymentMethodDto | null;
  onClose: () => void;
}) {
  // Sheet được dựng lại theo `key` mỗi lần mở, nên state khởi tạo từ `method` là đủ.
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? 'CARD');
  const [brand, setBrand] = useState<string | null>(method?.brand ?? 'VISA');
  const [label, setLabel] = useState(method?.label ?? '');
  const [last4, setLast4] = useState(method?.last4 ?? '');
  const [isDefault, setIsDefault] = useState(method?.isDefault ?? false);
  const [error, setError] = useState<string | null>(null);
  const save = useSavePaymentMethod(method?.id ?? null);
  const remove = useDeletePaymentMethod();

  const brands = BRANDS_BY_TYPE[type] ?? [];
  const isCard = type === 'CARD';

  function submit() {
    const input = {
      type,
      brand: brands.length > 0 ? brand : null,
      label: label.trim() || suggestedLabel(type, brands.length > 0 ? brand : null),
      last4: isCard && last4 ? last4 : null,
      isDefault,
    };
    const parsed = CreatePaymentMethodSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ');
      return;
    }
    save.mutate(parsed.data, {
      onSuccess: onClose,
      onError: (e) => setError(e.message),
    });
  }

  function confirmDelete() {
    if (!method) return;
    Alert.alert(
      `Xóa ${method.label}?`,
      method.subscriptionCount > 0
        ? `${method.subscriptionCount} subscription đang dùng phương thức này sẽ chuyển về "Chưa chọn".`
        : 'Không có subscription nào đang dùng phương thức này.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () =>
            remove.mutate(method.id, {
              onSuccess: onClose,
              onError: (e) => setError(e.message),
            }),
        },
      ],
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={method ? 'Sửa phương thức' : 'Thêm phương thức thanh toán'}
    >
      <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] text-ink-2">
        Loại
      </Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {TYPES.map((t) => (
          <Chip
            key={t}
            label={PAYMENT_TYPE_LABEL[t]}
            selected={type === t}
            onPress={() => {
              setType(t);
              setBrand(BRANDS_BY_TYPE[t]?.[0] ?? null);
            }}
          />
        ))}
      </View>

      {brands.length > 0 ? (
        <>
          <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] text-ink-2">
            {isCard ? 'Loại thẻ' : 'Ví'}
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {brands.map((b) => (
              <Chip
                key={b}
                label={BRAND_LABEL[b] ?? b}
                selected={brand === b}
                onPress={() => setBrand(b)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Input
        label="Tên gọi"
        value={label}
        onChangeText={setLabel}
        placeholder={`VD: ${isCard ? 'Visa Techcombank' : suggestedLabel(type, brand)}`}
        maxLength={40}
        className="mb-4"
      />

      {isCard ? (
        <Input
          label="4 số cuối (không bắt buộc)"
          value={last4}
          onChangeText={(t) => setLast4(t.replace(/\D/g, '').slice(0, 4))}
          placeholder="4821"
          keyboardType="number-pad"
          maxLength={4}
          className="mb-1"
        />
      ) : null}
      {isCard ? (
        <Text className="mb-4 ml-1 text-[12.5px] leading-[18px] text-ink-3">
          Subca chỉ lưu 4 số cuối để bạn nhận ra thẻ, không bao giờ cần số thẻ đầy đủ.
        </Text>
      ) : null}

      <ToggleRow
        title="Phương thức mặc định"
        note="Tự chọn khi thêm subscription mới"
        value={isDefault}
        onChange={setIsDefault}
      />

      {error ? <Text className="mt-3 text-center text-[13px] text-coral-deep">{error}</Text> : null}

      <Button
        title={method ? 'Lưu thay đổi' : 'Thêm phương thức'}
        icon="check"
        className="mt-5"
        loading={save.isPending}
        onPress={submit}
      />
      {method ? (
        <Button
          title="Xóa phương thức này"
          variant="ghost"
          className="mt-2"
          loading={remove.isPending}
          onPress={confirmDelete}
        />
      ) : (
        <Button title="Để sau" variant="ghost" className="mt-2" onPress={onClose} />
      )}
    </Sheet>
  );
}
