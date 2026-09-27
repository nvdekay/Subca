import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';
import { ICONS, type IconName } from '../icons';

export type { IconName };

const ELEMENTS = { path: Path, circle: Circle, rect: Rect } as const;

export function Icon({
  name,
  size = 20,
  color = colors.ink,
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name].map(({ t, p }, i) => {
        const Element = ELEMENTS[t];
        // Một số icon có phần tô đặc (fill="currentColor") trong mockup.
        const fill = p.fill === 'currentColor' ? color : p.fill;
        return <Element key={i} {...p} {...(fill ? { fill } : {})} />;
      })}
    </Svg>
  );
}
