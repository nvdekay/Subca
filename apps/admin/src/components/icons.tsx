/** Icon nét lấy từ design/subca-admin-dashboard.html (viewBox 24×24). */
const PATHS = {
  grid: ['M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z'],
  users: ['M2 21a7 7 0 0 1 14 0', 'M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3'],
  layers: ['m12 3 9 5-9 5-9-5z', 'm3 13 9 5 9-5', 'm3 17 9 5 9-5'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  server: ['M4 4h16v6H4zM4 14h16v6H4z', 'M8 7h.01M8 17h.01'],
  search: ['m21 21-4.3-4.3', 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18M6 6l12 12'],
  alert: [
    'M12 9v4M12 17h.01',
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  ],
  plus: ['M12 5v14M5 12h14'],
  chev: ['m9 6 6 6-6 6'],
  back: ['m15 18-6-6 6-6'],
  lock: ['M8 11V7a4 4 0 0 1 8 0v4'],
  coin: [
    'M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'],
  refresh: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
} as const;

const RECTS: Partial<
  Record<keyof typeof PATHS, { x: number; y: number; w: number; h: number; rx: number }[]>
> = {
  lock: [{ x: 4, y: 11, w: 16, h: 10, rx: 2 }],
};

const CIRCLES: Partial<Record<keyof typeof PATHS, { cx: number; cy: number; r: number }[]>> = {
  users: [{ cx: 9, cy: 8, r: 4 }],
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = 'size-[18px]',
  strokeWidth = 1.9,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {CIRCLES[name]?.map((c, i) => (
        <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
      {RECTS[name]?.map((r, i) => (
        <rect key={`r${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} />
      ))}
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
