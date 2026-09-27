import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme';
import { formatCountdown } from './otp-cooldown';

/** Dòng đếm ngược hiện rõ thời gian còn lại trước khi được gửi lại mã. */
export function ResendCountdown({ seconds }: { seconds: number }) {
  if (seconds <= 0) return null;
  return (
    <View className="mt-4 flex-row items-center justify-center gap-2">
      <Icon name="clock" size={16} color={colors['ink-3']} />
      <Text className="text-[13.5px] leading-[19px] text-ink-3">
        Gửi lại mã sau{' '}
        <Text weight="bold" tabular className="text-[13.5px] text-ink">
          {formatCountdown(seconds)}
        </Text>
      </Text>
    </View>
  );
}
