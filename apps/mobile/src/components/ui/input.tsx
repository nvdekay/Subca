import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';
import { colors, fontFamily, shadow } from '@/theme';
import { Text } from './text';

/** Ô nhập cao 52, nền trắng, viền xanh khi đang nhập (giống .input trong mockup). */
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
          'h-[52px] rounded-[16px] border-[1.5px] border-transparent bg-surface px-4 text-[15px] text-ink',
          focused && 'border-sky',
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
