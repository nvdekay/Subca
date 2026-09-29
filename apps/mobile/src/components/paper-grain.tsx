import Svg, { Circle } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

const SPECKS = Array.from({ length: 150 }, (_, index) => ({
  x: (index * 73 + index * index * 19 + 17) % 360,
  y: (index * 97 + index * index * 31 + 41) % 800,
  r: 0.28 + (index % 4) * 0.11,
  opacity: index % 5 === 0 ? 0.075 : 0.04,
}));

/** Lớp hạt giấy rất nhẹ; phủ bằng SVG nhỏ, không ảnh hưởng hit target hay khả năng đọc. */
export function PaperGrain() {
  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 360 800" preserveAspectRatio="none">
        {SPECKS.map((speck, index) => (
          <Circle
            key={index}
            cx={speck.x}
            cy={speck.y}
            r={speck.r}
            fill="#746044"
            opacity={speck.opacity}
          />
        ))}
      </Svg>
    </View>
  );
}
