import { bankByBin, type CurrencyCode, type GroupPayoutDto } from '@subca/shared';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatAmount } from '@/lib/format';
import { colors, shadow } from '@/theme';

/**
 * Thẻ mã QR chuyển khoản (mockup: .qr-card). Chuỗi QR do server sinh theo chuẩn VietQR
 * nên app chỉ vẽ lại, không tự ghép nội dung.
 */
export function QrCard({
  payload,
  payout,
  amountMinor,
  currency,
  note,
}: {
  payload: string | null;
  payout: GroupPayoutDto;
  amountMinor: string | null;
  currency: CurrencyCode;
  note: string | null;
}) {
  const bank = bankByBin(payout.bankBin);
  return (
    <View
      className="mt-3 items-center rounded-lg bg-surface p-[18px]"
      style={{ boxShadow: shadow.sm }}
    >
      {payload ? (
        <View className="rounded-[16px] bg-white p-3">
          <QRCode value={payload} size={168} color={colors.ink} backgroundColor="#FFFFFF" />
        </View>
      ) : (
        <Text className="py-4 text-center text-[13.5px] leading-[19px] text-ink-3">
          Mã QR chỉ có với nhóm tính bằng VND (chuyển nhanh NAPAS 247).
        </Text>
      )}
      <View className="mt-3 w-full">
        <BankRow label="Người nhận" value={payout.accountName} />
        <BankRow label="Ngân hàng" value={bank?.name ?? payout.bankName ?? payout.bankBin} />
        <BankRow label="Số tài khoản" value={payout.accountNo} tabular />
        {amountMinor ? (
          <BankRow label="Số tiền" value={formatAmount(amountMinor, currency)} tabular />
        ) : null}
        {note ? <BankRow label="Nội dung" value={note} /> : null}
      </View>
      <Button
        title="Chia sẻ thông tin chuyển khoản"
        variant="soft"
        size="sm"
        icon="link"
        className="mt-3 self-stretch"
        onPress={() =>
          Share.share({
            message: [
              `${payout.accountName} · ${bank?.name ?? payout.bankName ?? ''}`.trim(),
              `STK: ${payout.accountNo}`,
              amountMinor ? `Số tiền: ${formatAmount(amountMinor, currency)}` : null,
              note ? `Nội dung: ${note}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
          })
        }
      />
    </View>
  );
}

function BankRow({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: string;
  tabular?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 border-t border-line py-[9px]">
      <Text className="text-[13px] text-ink-3">{label}</Text>
      <Text weight="semibold" tabular={tabular} className="flex-1 text-right text-[14px]">
        {value}
      </Text>
    </View>
  );
}
