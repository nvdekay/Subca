import {
  CURRENCY_DECIMALS,
  toMinor,
  VIETQR_BANKS,
  type GroupDetailDto,
  type UpdateGroup,
} from '@subca/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { useUpdateGroup } from './queries';

/** Số tiền dạng chuỗi minor → chữ để nhập lại (VND "260000", USD "19.99"). */
function amountText(minor: string, decimals: number): string {
  if (decimals === 0) return minor;
  const padded = minor.padStart(decimals + 1, '0');
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`.replace(/\.?0+$/, '');
}

/** Sửa tên nhóm, giá gói và hạn chuyển tiền mỗi tháng. */
export function EditGroupSheet({
  visible,
  onClose,
  group,
}: {
  visible: boolean;
  onClose: () => void;
  group: GroupDetailDto;
}) {
  const decimals = CURRENCY_DECIMALS[group.currency];
  const update = useUpdateGroup(group.id);
  const [name, setName] = useState(group.name);
  const [amount, setAmount] = useState(amountText(group.totalAmountMinor, decimals));
  const [dueDay, setDueDay] = useState(String(group.dueDay));
  const [errors, setErrors] = useState<{ amount?: string; dueDay?: string }>({});

  const save = () => {
    const next: { amount?: string; dueDay?: string } = {};
    let totalAmountMinor = '';
    try {
      totalAmountMinor = toMinor(
        decimals === 0 ? amount.replace(/[.,\s]/g, '') : amount.replace(',', '.'),
        group.currency,
      ).toString();
      if (BigInt(totalAmountMinor) <= 0n) next.amount = 'Giá gói phải lớn hơn 0';
    } catch {
      next.amount = decimals === 0 ? 'Nhập số tiền, VD 260000' : 'Nhập số tiền, VD 19.99';
    }
    const day = Number(dueDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      next.dueDay = 'Chọn ngày từ 1 đến 28 (tháng nào cũng có)';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: UpdateGroup = { name: name.trim(), totalAmountMinor, dueDay: day };
    update.mutate(input, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Thông tin nhóm"
      subtitle="Đổi giá gói thì phần phải trả của những người chưa chuyển tiền cũng đổi theo."
    >
      <Input label="Tên nhóm" value={name} onChangeText={setName} maxLength={60} />
      <Input
        label={`Giá gói mỗi tháng (${group.currency})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        className="mt-3"
        error={errors.amount}
      />
      <Input
        label="Hạn chuyển tiền (ngày trong tháng)"
        value={dueDay}
        onChangeText={(t) => setDueDay(t.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        className="mt-3"
        error={errors.dueDay}
      />
      {update.isError ? (
        <Text className="ml-1 mt-3 text-[13px] text-coral-deep">{update.error.message}</Text>
      ) : null}
      <Button title="Lưu" loading={update.isPending} className="mt-4" onPress={save} />
    </Sheet>
  );
}

/** Thông tin nhận tiền của chủ nhóm — dùng để sinh mã QR VietQR cho thành viên. */
export function PayoutSheet({
  visible,
  onClose,
  group,
}: {
  visible: boolean;
  onClose: () => void;
  group: GroupDetailDto;
}) {
  const update = useUpdateGroup(group.id);
  const [bankBin, setBankBin] = useState(group.payout?.bankBin ?? '');
  const [accountNo, setAccountNo] = useState(group.payout?.accountNo ?? '');
  const [accountName, setAccountName] = useState(group.payout?.accountName ?? '');
  const [pickingBank, setPickingBank] = useState(false);
  const bank = VIETQR_BANKS.find((b) => b.bin === bankBin);
  const ready = Boolean(bank) && accountNo.length >= 4 && accountName.trim().length > 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={pickingBank ? 'Chọn ngân hàng' : 'Thông tin nhận tiền'}
      subtitle={
        pickingBank
          ? undefined
          : 'Thành viên sẽ thấy mã QR chuyển nhanh với số tiền và nội dung điền sẵn.'
      }
    >
      {pickingBank ? (
        <View className="overflow-hidden rounded-sm bg-surface">
          {VIETQR_BANKS.map((b, i) => (
            <Pressable
              key={b.bin}
              onPress={() => {
                setBankBin(b.bin);
                setPickingBank(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: b.bin === bankBin }}
              className={cn(
                'flex-row items-center gap-3 px-4 py-[13px] active:bg-bg',
                i > 0 && 'border-t border-line',
              )}
            >
              <Text weight={b.bin === bankBin ? 'bold' : 'regular'} className="flex-1">
                {b.name}
              </Text>
              {b.bin === bankBin ? <Icon name="check" color={colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] text-ink-2">
            Ngân hàng
          </Text>
          <Pressable
            onPress={() => setPickingBank(true)}
            accessibilityRole="button"
            className="h-[52px] flex-row items-center justify-between rounded-sm bg-surface px-4"
          >
            <Text className={cn('text-[15px]', !bank && 'text-ink-3')}>
              {bank?.name ?? 'Chọn ngân hàng'}
            </Text>
            <Icon name="chev" size={18} color={colors['ink-3']} />
          </Pressable>
          <Input
            label="Số tài khoản"
            value={accountNo}
            onChangeText={(t) => setAccountNo(t.replace(/[^0-9A-Za-z]/g, '').slice(0, 19))}
            keyboardType="number-pad"
            className="mt-3"
          />
          <Input
            label="Tên chủ tài khoản"
            value={accountName}
            onChangeText={(t) => setAccountName(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={60}
            className="mt-3"
          />
          {update.isError ? (
            <Text className="ml-1 mt-3 text-[13px] text-coral-deep">{update.error.message}</Text>
          ) : null}
          <Button
            title="Lưu thông tin"
            disabled={!ready}
            loading={update.isPending}
            className="mt-4"
            onPress={() =>
              update.mutate(
                {
                  payout: {
                    bankBin,
                    bankName: bank?.name,
                    accountNo,
                    accountName: accountName.trim(),
                  },
                },
                { onSuccess: onClose },
              )
            }
          />
          {group.payout ? (
            <Button
              title="Xóa thông tin nhận tiền"
              variant="ghost"
              className="mt-1"
              onPress={() => update.mutate({ payout: null }, { onSuccess: onClose })}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}
