import type { CurrencyCode, PaymentMethodDto, SubscriptionDto } from '@subca/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { Screen, TopBar } from '@/components/screen';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { useMe } from '@/features/auth/use-me';
import { BRAND_LABEL, cardColor } from '@/features/payments/card-style';
import { PaymentMethodSheet } from '@/features/payments/payment-method-sheet';
import { PAYMENT_TYPE_LABEL } from '@/features/subscriptions/labels';
import { usePaymentMethods, useSubscriptions } from '@/features/subscriptions/queries';
import { formatAmount, formatShortDate } from '@/lib/format';
import { colors, shadow } from '@/theme';

/** Phương thức thanh toán — màn 11 của mockup. */
export default function Payments() {
  const methods = usePaymentMethods();
  // Danh sách subscription thường đã có sẵn trong cache (Trang chủ / Danh sách) → dùng để hiện gói theo từng thẻ.
  const subs = useSubscriptions();
  const me = useMe();
  const currency = me.data?.settings?.currency ?? 'VND';
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ method: PaymentMethodDto | null; key: number } | null>(
    null,
  );

  const subItems = subs.data?.items;
  const subsByMethod = useMemo(() => {
    const map = new Map<string, SubscriptionDto[]>();
    for (const s of subItems ?? []) {
      if (!s.paymentMethodId || s.status === 'CANCELLED') continue;
      map.set(s.paymentMethodId, [...(map.get(s.paymentMethodId) ?? []), s]);
    }
    return map;
  }, [subItems]);

  const openSheet = (method: PaymentMethodDto | null) => setEditing({ method, key: Date.now() });

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={methods.isRefetching}
          onRefresh={() => {
            methods.refetch();
            subs.refetch();
          }}
          tintColor={colors['ink-3']}
        />
      }
    >
      <TopBar
        title="Thanh toán"
        right={<IconButton icon="plus" label="Thêm phương thức" onPress={() => openSheet(null)} />}
      />

      {methods.data ? (
        methods.data.length > 0 ? (
          <>
            <Text className="-mt-[6px] mb-4 ml-1 text-[14px] text-ink-2">
              Chạm vào thẻ để xem subscription đang dùng.
            </Text>
            <View className="gap-3">
              {methods.data.map((m) => (
                <View key={m.id}>
                  <MethodCard
                    method={m}
                    currency={currency}
                    subs={subsByMethod.get(m.id) ?? []}
                    open={openId === m.id}
                    onPress={() => setOpenId(openId === m.id ? null : m.id)}
                  />
                  {openId === m.id ? (
                    <View
                      className="mx-2 -mt-[18px] rounded-b-[22px] bg-surface px-4 pb-2 pt-[26px]"
                      style={{ boxShadow: shadow.sm }}
                    >
                      {(subsByMethod.get(m.id) ?? []).map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() =>
                            router.push({ pathname: '/subscriptions/[id]', params: { id: s.id } })
                          }
                          className="flex-row items-center gap-3 border-b border-line py-[10px]"
                        >
                          <ServiceLogo name={s.name} service={s.service} size="sm" />
                          <View className="flex-1">
                            <Text weight="semibold">{s.name}</Text>
                            {s.nextRenewalDate ? (
                              <Text className="text-[12.5px] text-ink-3">
                                Gia hạn {formatShortDate(s.nextRenewalDate)}
                              </Text>
                            ) : null}
                          </View>
                          <Text weight="bold" tabular>
                            {formatAmount(s.amountMinor, s.currency)}
                          </Text>
                        </Pressable>
                      ))}
                      {(subsByMethod.get(m.id) ?? []).length === 0 ? (
                        <Text className="py-3 text-[13.5px] text-ink-3">
                          Chưa có subscription nào dùng phương thức này.
                        </Text>
                      ) : null}
                      <Button
                        title="Sửa phương thức"
                        variant="ghost"
                        size="sm"
                        icon="edit"
                        className="mt-1"
                        onPress={() => openSheet(m)}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : (
          <Card className="items-center gap-3 px-6 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-sky-soft">
              <Icon name="card" size={26} color={colors['sky-deep']} />
            </View>
            <Text weight="bold" className="text-[17px]">
              Chưa có phương thức thanh toán
            </Text>
            <Text className="text-center text-[14px] leading-[21px] text-ink-3">
              Thêm thẻ, ví MoMo, App Store… để biết mỗi thẻ đang bị trừ bao nhiêu mỗi tháng.
            </Text>
            <Button
              title="Thêm phương thức"
              icon="plus"
              className="mt-2 self-stretch"
              onPress={() => openSheet(null)}
            />
          </Card>
        )
      ) : methods.isError ? (
        <Card className="items-center gap-3">
          <Text className="text-center text-ink-2">{methods.error.message}</Text>
          <Button title="Thử lại" size="sm" variant="soft" onPress={() => methods.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator className="mt-16" color={colors['ink-3']} />
      )}

      {editing ? (
        <PaymentMethodSheet
          key={editing.key}
          visible
          method={editing.method}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}

/** Bỏ tên thương hiệu ở đầu tên gọi vì đã in đậm bên cạnh: "Visa Techcombank" → "Techcombank". */
function displayLabel(method: PaymentMethodDto, brandName: string | null): string {
  if (!brandName) return method.label || PAYMENT_TYPE_LABEL[method.type];
  return method.label.toLowerCase().startsWith(brandName.toLowerCase())
    ? method.label.slice(brandName.length).trim()
    : method.label;
}

function MethodCard({
  method,
  currency,
  subs,
  open,
  onPress,
}: {
  method: PaymentMethodDto;
  currency: CurrencyCode;
  subs: SubscriptionDto[];
  open: boolean;
  onPress: () => void;
}) {
  const brandName = method.brand ? (BRAND_LABEL[method.brand] ?? method.brand) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={method.label}
      className="min-h-[168px] justify-between overflow-hidden rounded-lg p-5 active:scale-[0.985]"
      style={{
        backgroundColor: cardColor(method.type, method.brand),
        boxShadow: shadow.md,
      }}
    >
      {/* Vòng tròn trang trí góc dưới phải (mockup: .pcard::after) */}
      <View className="absolute -bottom-[90px] -right-[60px] h-[200px] w-[200px] rounded-full bg-[rgba(255,255,255,0.12)]" />
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2">
          {brandName ? (
            <Text
              weight="extrabold"
              className="text-[20px] text-white"
              style={{ fontStyle: 'italic', letterSpacing: -0.4 }}
            >
              {brandName}
            </Text>
          ) : null}
          <Text weight="semibold" className="flex-1 text-[15px] text-white" numberOfLines={1}>
            {displayLabel(method, brandName)}
          </Text>
        </View>
        {method.isDefault ? (
          <View className="rounded-full bg-[rgba(255,255,255,0.22)] px-[10px] py-[3px]">
            <Text weight="semibold" className="text-[11.5px] text-white">
              Mặc định
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-[12px] text-white opacity-85">Trừ tiền mỗi tháng</Text>
          <Text weight="bold" tabular className="text-[24px] leading-[30px] text-white">
            {formatAmount(method.monthlyTotalMinor, currency)}
          </Text>
          <Text className="text-[12px] text-white opacity-85">
            {method.subscriptionCount} subscription
            {method.last4 ? `  ·  •••• ${method.last4}` : ''}
          </Text>
        </View>
        {/* Chồng logo các gói đang dùng thẻ (mockup: .stack) */}
        <View className="flex-row">
          {subs.slice(0, 4).map((s, i) => (
            <View
              key={s.id}
              className="h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full bg-surface"
              style={{ marginLeft: i === 0 ? 0 : -10 }}
            >
              <ServiceLogo name={s.name} service={s.service} size="sm" />
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}
