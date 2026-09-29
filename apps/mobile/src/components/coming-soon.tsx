import { View } from 'react-native';
import { colors } from '@/theme';
import { Screen, TopBar } from './screen';
import { Icon, type IconName } from './ui/icon';
import { Text } from './ui/text';

/** Màn giữ chỗ cho tính năng chưa làm (theo thứ tự trong docs/SUBCA-CHECKLIST.md). */
export function ComingSoon({
  title,
  icon,
  note,
  tabBar = false,
}: {
  title: string;
  icon: IconName;
  note: string;
  tabBar?: boolean;
}) {
  return (
    <Screen tabBar={tabBar}>
      {tabBar ? (
        <Text
          weight="extrabold"
          className="mb-5 mt-[6px] text-[26px] leading-[32px]"
          style={{ letterSpacing: -0.65 }}
        >
          {title}
        </Text>
      ) : (
        <TopBar title={title} />
      )}
      <View className="items-center gap-3 px-[10px] py-10">
        <View className="h-14 w-14 items-center justify-center rounded-sm bg-sky-soft">
          <Icon name={icon} size={24} color={colors['sky-deep']} />
        </View>
        <Text weight="bold" className="text-[17px]">
          Đang xây dựng
        </Text>
        <Text className="text-center text-[14px] leading-[21px] text-ink-3">{note}</Text>
      </View>
    </Screen>
  );
}
