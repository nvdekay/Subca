import { daysInMonth, type IsoDate } from '@subca/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { colors, shadow } from '@/theme';
import { Button } from './button';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Text } from './text';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function iso(y: number, m: number, d: number): IsoDate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` as IsoDate;
}

/** Hôm nay theo giờ máy, chỉ để tô ngày hôm nay trên lịch. */
function localToday(): IsoDate {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/**
 * Ô chọn ngày: bấm mở lịch tháng trong bottom sheet. Tự dựng bằng JS (không dùng picker native)
 * để giao diện giống mockup và không cần build lại app.
 */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: IsoDate;
  onChange: (value: IsoDate) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value)}`}
        className="h-[52px] flex-row items-center justify-between rounded-[16px] bg-surface px-4"
        style={{ boxShadow: shadow.sm }}
      >
        <Text tabular>{formatDate(value)}</Text>
        <Icon name="cal" size={18} color={colors['ink-3']} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <MonthCalendar
          value={value}
          onPick={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
        <Button title="Đóng" variant="ghost" className="mt-2" onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}

function MonthCalendar({ value, onPick }: { value: IsoDate; onPick: (d: IsoDate) => void }) {
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const [month, setMonth] = useState(Number(value.slice(5, 7)));
  const today = localToday();

  const shift = (delta: number) => {
    const index = year * 12 + (month - 1) + delta;
    setYear(Math.floor(index / 12));
    setMonth((index % 12) + 1);
  };

  // Thứ của ngày 1 (T2 = 0 … CN = 6) để chừa ô trống đầu tháng.
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Tháng trước">
          <Icon name="back" />
        </Pressable>
        <Text weight="bold" className="text-[16px]">
          Tháng {month}/{year}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Tháng sau">
          <Icon name="chev" />
        </Pressable>
      </View>
      <View className="flex-row">
        {WEEKDAYS.map((w) => (
          <Text key={w} weight="semibold" className="flex-1 text-center text-[12px] text-ink-3">
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} className="mt-1 flex-row">
          {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
            if (day === null) return <View key={i} className="h-11 flex-1" />;
            const d = iso(year, month, day);
            const selected = d === value;
            return (
              <Pressable
                key={i}
                onPress={() => onPick(d)}
                accessibilityRole="button"
                accessibilityLabel={formatDate(d)}
                accessibilityState={{ selected }}
                className="h-11 flex-1 items-center justify-center"
              >
                <View
                  className={cn(
                    'h-10 w-10 items-center justify-center rounded-full',
                    selected && 'bg-ink',
                    !selected && d === today && 'bg-mint',
                  )}
                >
                  <Text
                    weight={selected ? 'bold' : 'medium'}
                    tabular
                    className={cn('text-[15px]', selected && 'text-white')}
                  >
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
