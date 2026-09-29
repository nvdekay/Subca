import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';
import { colors, fontFamily, shadow } from '@/theme';
import { Text } from './text';

/** Ô nhập nền giấy, viền brass khi focus, lỗi dùng dusty red. */
export function Input({
  label,
  error,
  className,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; className?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={className}>
      {label ? (
        <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors['ink-3']}
        className={cn(
          'h-[52px] rounded-[12px] border border-line bg-surface px-4 text-[15px] text-ink',
          focused && 'border-brass',
          error && 'border-coral-deep',
        )}
        style={[{ fontFamily: fontFamily.regular, boxShadow: shadow.sm }, style]}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
      {error ? (
        <Text className="ml-1 mt-[6px] text-[13px] leading-[18px] text-coral-deep">{error}</Text>
      ) : null}
    </View>
  );
}
