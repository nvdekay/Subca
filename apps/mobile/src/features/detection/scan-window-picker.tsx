import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';

export const SCAN_WINDOWS = [1, 3, 6, 12] as const;
export type ScanWindowMonths = (typeof SCAN_WINDOWS)[number];

const OPTIONS = SCAN_WINDOWS.map((months) => ({ value: months, label: `${months} tháng` }));

export function ScanWindowPicker({
  value,
  onChange,
}: {
  value: ScanWindowMonths;
  onChange: (months: ScanWindowMonths) => void;
}) {
  return (
    <>
      <Text weight="bold" className="mb-2 text-[13px] text-ink-2">
        Quét email trong khoảng
      </Text>
      <Segmented options={OPTIONS} value={value} onChange={onChange} />
      <Text className="mt-2 text-[11.5px] leading-[17px] text-ink-3">
        Chỉ email từ khoảng thời gian này được đưa vào lượt quét. Mỗi lượt xử lý tối đa 400 email.
      </Text>
    </>
  );
}
