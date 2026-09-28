import * as WebBrowser from 'expo-web-browser';
import { Pressable } from 'react-native';
import { Text } from './ui/text';

/** Điều khoản ExchangeRate-API bắt buộc ghi nguồn ở nơi hiện số đã quy đổi. */
export function FxAttribution({ label = 'Tổng đã quy đổi theo tỷ giá' }: { label?: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      className="mt-6 items-center"
      onPress={() => WebBrowser.openBrowserAsync('https://www.exchangerate-api.com')}
    >
      <Text className="text-[12px] leading-[17px] text-ink-3">
        {label}{' '}
        <Text className="text-[12px] text-sky-deep underline">Rates By Exchange Rate API</Text>
      </Text>
    </Pressable>
  );
}
