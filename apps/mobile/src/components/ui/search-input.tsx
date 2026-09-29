import { TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontFamily, shadow } from '@/theme';
import { Icon } from './icon';

/** Ô tìm kiếm cao 50 có icon kính lúp (mockup: .search). */
export function SearchInput(props: TextInputProps) {
  return (
    <View
      className="h-[50px] flex-row items-center gap-[10px] rounded-[12px] border border-line bg-surface px-4"
      style={{ boxShadow: shadow.sm }}
    >
      <Icon name="search" color={colors['ink-3']} />
      <TextInput
        placeholderTextColor={colors['ink-3']}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="while-editing"
        className="h-full flex-1 text-[15px] text-ink"
        style={{ fontFamily: fontFamily.regular }}
        {...props}
      />
    </View>
  );
}
