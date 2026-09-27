import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** Vòng tiến độ (mockup: .ring) — `progress` từ 0 tới 1, nội dung đặt ở giữa. */
export function Ring({
  progress,
  color,
  size = 62,
  stroke = 6,
  children,
}: {
  progress: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(progress, 1));
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#EFEFE9"
          strokeWidth={stroke}
          fill="#FFFFFF"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * p} ${circumference}`}
          // Bắt đầu từ đỉnh vòng tròn thay vì bên phải.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
