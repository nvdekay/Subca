import { CURRENCY_DECIMALS, toMinor, type CurrencyCode } from '@subca/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useSaveBudget } from './queries';

/** Sheet đặt / bỏ hạn mức ngân sách tháng (dùng ở màn Ngân sách). */
export function BudgetSheet({
  currency,
  current,
  onClose,
}: {
  currency: CurrencyCode;
  current: { amountMinor: string; currency: CurrencyCode } | null;
  onClose: () => void;
}) {
  const budgetCurrency = current?.currency ?? currency;
  const decimals = CURRENCY_DECIMALS[budgetCurrency];
  // Ô nhập hiện đơn vị lớn (VD 20.5 USD), API lưu đơn vị nhỏ nhất (2050 cent).
  const [value, setValue] = useState(() =>
    current ? String(Number(current.amountMinor) / 10 ** decimals) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const save = useSaveBudget();

  function submit() {
    let amountMinor: string;
    try {
      const text = value.replace(/\s/g, '');
      amountMinor = toMinor(
        decimals === 0 ? text.replace(/[.,]/g, '') : text.replace(',', '.'),
        budgetCurrency,
      ).toString();
    } catch {
      setError('Nhập số tiền, VD 2000000');
      return;
    }
    if (amountMinor === '0') {
      setError('Hạn mức phải lớn hơn 0');
      return;
    }
    save.mutate(
      { amountMinor, currency: budgetCurrency, alertAtPercent: 90 },
      { onSuccess: onClose, onError: (e) => setError(e.message) },
    );
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Ngân sách mỗi tháng"
      subtitle="Subca cảnh báo khi tổng chi phí subscription vượt 90% hạn mức."
    >
      <Input
        label={`Hạn mức (${budgetCurrency})`}
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setError(null);
        }}
        placeholder="2000000"
        keyboardType={decimals === 0 ? 'number-pad' : 'decimal-pad'}
        autoFocus
        error={error}
      />
      <Button
        title="Lưu ngân sách"
        icon="check"
        className="mt-4"
        loading={save.isPending}
        onPress={submit}
      />
      {current ? (
        <Button
          title="Bỏ ngân sách"
          variant="ghost"
          className="mt-2"
          onPress={() => save.mutate(null, { onSuccess: onClose })}
        />
      ) : null}
    </Sheet>
  );
}
