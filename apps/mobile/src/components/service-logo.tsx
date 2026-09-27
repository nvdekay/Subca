import type { ServiceSummaryDto } from '@subca/shared';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';
import { BRAND_LOGOS } from './brand-logos.generated';
import { Text } from './ui/text';

const SIZE = {
  sm: { box: 30, radius: 10, font: 13 },
  md: { box: 40, radius: 13, font: 17 },
  lg: { box: 64, radius: 20, font: 26 },
};

/** Màu thương hiệu quá sáng (gần trắng) thì vẽ bằng màu chữ để còn nhìn thấy trên nền sáng. */
function visible(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const luminance =
    (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.85 ? colors.ink : hex;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return (words[0] ?? '?').slice(0, 1).toUpperCase();
}

/**
 * Logo dịch vụ: logo thương hiệu đóng gói sẵn (chỉ logo, không khung — như mockup);
 * không có logo thì hiện chữ viết tắt trên nền màu thương hiệu.
 */
export function ServiceLogo({
  name,
  service,
  size = 'md',
}: {
  name: string;
  service: Pick<ServiceSummaryDto, 'logoKey' | 'brandColor'> | null;
  size?: keyof typeof SIZE;
}) {
  const s = SIZE[size];
  const brand = service?.logoKey ? BRAND_LOGOS[service.logoKey] : undefined;
  if (brand) {
    const inner = Math.round(s.box * 0.86);
    return (
      <View style={{ width: s.box, height: s.box }} className="items-center justify-center">
        <Svg width={inner} height={inner} viewBox="0 0 24 24">
          <Path d={brand.path} fill={visible(brand.color)} />
        </Svg>
      </View>
    );
  }
  return (
    <View
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
        backgroundColor: service?.brandColor ?? colors['ink-brand'],
      }}
      className="items-center justify-center"
    >
      <Text
        weight="extrabold"
        style={{ fontSize: s.font, lineHeight: s.font * 1.2, letterSpacing: -0.5 }}
        className="text-white"
      >
        {initials(name)}
      </Text>
    </View>
  );
}
