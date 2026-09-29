import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { colors, fontFamily, shadow } from '@/theme';
import { Text } from './text';

/** Ô nhập nền sáng, viền mực dày; focus dùng cam, lỗi dùng đỏ đất. */
export function Input({
  label,
  error,
  className,
  right,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  error?: string | null;
  className?: string;
  right?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={className}>
      {label ? (
        <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
          {label}
        </Text>
      ) : null}
      <View>
        <TextInput
          placeholderTextColor={colors['ink-3']}
          className={cn(
            'h-[52px] rounded-sm border-2 border-ink bg-surface px-4 text-[15px] text-ink',
            focused && 'border-accent',
            error && 'border-coral-deep',
          )}
          style={[
            { fontFamily: fontFamily.regular, boxShadow: shadow.sm },
            right ? { paddingRight: 54 } : null,
            style,
          ]}
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
        {right ? (
          <View className="absolute bottom-0 right-1 top-0 justify-center">{right}</View>
        ) : null}
      </View>
      {error ? (
        <Text className="ml-1 mt-[6px] text-[13px] leading-[18px] text-coral-deep">{error}</Text>
      ) : null}
    </View>
  );
}
