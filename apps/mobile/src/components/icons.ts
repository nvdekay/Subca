// Icon nét (stroke) lấy nguyên từ design/subca-mobile-mockup.html (các <symbol id="i-…">), viewBox 24×24.
type IconElement = { t: 'path' | 'circle' | 'rect'; p: Record<string, string> };

export type IconName =
  | 'home'
  | 'cal'
  | 'plus'
  | 'check-circle'
  | 'chart'
  | 'bell'
  | 'back'
  | 'chev'
  | 'x'
  | 'search'
  | 'clock'
  | 'hourglass'
  | 'piggy'
  | 'wallet'
  | 'card'
  | 'list'
  | 'alert'
  | 'edit'
  | 'flag'
  | 'help'
  | 'archive'
  | 'sparkle'
  | 'user'
  | 'coin'
  | 'tag'
  | 'logout'
  | 'repeat'
  | 'trend'
  | 'target'
  | 'check'
  | 'more'
  | 'settings'
  | 'users'
  | 'link';

export const ICONS: Record<IconName, IconElement[]> = {
  home: [
    { t: 'path', p: { d: 'M3 10.5 12 3l9 7.5' } },
    { t: 'path', p: { d: 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5' } },
  ],
  cal: [
    { t: 'rect', p: { x: '3', y: '4.5', width: '18', height: '17', rx: '4' } },
    { t: 'path', p: { d: 'M8 2.5v4M16 2.5v4M3 10h18' } },
  ],
  plus: [{ t: 'path', p: { d: 'M12 5v14M5 12h14' } }],
  'check-circle': [
    { t: 'circle', p: { cx: '12', cy: '12', r: '9' } },
    { t: 'path', p: { d: 'm8.5 12.5 2.5 2.5 4.5-5' } },
  ],
  chart: [
    { t: 'path', p: { d: 'M3 3v18h18' } },
    { t: 'path', p: { d: 'M7 15v2M11.5 11v6M16 7v10' } },
  ],
  bell: [
    { t: 'path', p: { d: 'M6 8a6 6 0 1 1 12 0c0 7 3 8.5 3 8.5H3S6 15 6 8' } },
    { t: 'path', p: { d: 'M10.3 20a2 2 0 0 0 3.4 0' } },
  ],
  back: [{ t: 'path', p: { d: 'm15 18-6-6 6-6' } }],
  chev: [{ t: 'path', p: { d: 'm9 18 6-6-6-6' } }],
  x: [{ t: 'path', p: { d: 'M18 6 6 18M6 6l12 12' } }],
  search: [
    { t: 'circle', p: { cx: '11', cy: '11', r: '7' } },
    { t: 'path', p: { d: 'm20 20-3.5-3.5' } },
  ],
  clock: [
    { t: 'circle', p: { cx: '12', cy: '12', r: '9' } },
    { t: 'path', p: { d: 'M12 7v5l3 2' } },
  ],
  hourglass: [
    { t: 'path', p: { d: 'M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4' } },
  ],
  piggy: [
    {
      t: 'path',
      p: {
        d: 'M19 10c1 .5 2 1.3 2 3h-2c-.4 1.3-1.2 2.4-2.3 3.2V19h-3v-1.5h-4V19h-3v-2.8A6.5 6.5 0 0 1 5 11c0-3.6 3.1-6 7-6 1.4 0 2.7.3 3.8.9L18 4v3.6c.4.7.8 1.5 1 2.4Z',
      },
    },
    { t: 'circle', p: { cx: '15', cy: '10', r: '.5', fill: 'currentColor' } },
  ],
  wallet: [
    {
      t: 'path',
      p: {
        d: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5',
      },
    },
    { t: 'path', p: { d: 'M17 14h.01' } },
  ],
  card: [
    { t: 'rect', p: { x: '2.5', y: '5', width: '19', height: '14', rx: '3' } },
    { t: 'path', p: { d: 'M2.5 10h19M6.5 15h3' } },
  ],
  list: [{ t: 'path', p: { d: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01' } }],
  alert: [
    {
      t: 'path',
      p: { d: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' },
    },
    { t: 'path', p: { d: 'M12 9v4M12 17h.01' } },
  ],
  edit: [
    { t: 'path', p: { d: 'M12 20h9' } },
    { t: 'path', p: { d: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z' } },
  ],
  flag: [
    { t: 'path', p: { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7' } },
  ],
  help: [
    { t: 'circle', p: { cx: '12', cy: '12', r: '9' } },
    { t: 'path', p: { d: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01' } },
  ],
  archive: [
    { t: 'rect', p: { x: '2.5', y: '3.5', width: '19', height: '5', rx: '1.5' } },
    { t: 'path', p: { d: 'M4 8.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5M10 12.5h4' } },
  ],
  sparkle: [
    { t: 'path', p: { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z' } },
    { t: 'path', p: { d: 'M19 17v4M17 19h4' } },
  ],
  user: [
    { t: 'circle', p: { cx: '12', cy: '8', r: '4' } },
    { t: 'path', p: { d: 'M4 21a8 8 0 0 1 16 0' } },
  ],
  coin: [
    { t: 'circle', p: { cx: '12', cy: '12', r: '9' } },
    {
      t: 'path',
      p: {
        d: 'M14.8 9.2A2.5 2.5 0 0 0 12.5 8h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1a2.5 2.5 0 0 1-2.3-1.2M12 6.5V8M12 16v1.5',
      },
    },
  ],
  tag: [
    {
      t: 'path',
      p: { d: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z' },
    },
    { t: 'circle', p: { cx: '7.5', cy: '7.5', r: '1.2' } },
  ],
  logout: [
    { t: 'path', p: { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' } },
  ],
  repeat: [
    { t: 'path', p: { d: 'm17 2 4 4-4 4' } },
    { t: 'path', p: { d: 'M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4' } },
    { t: 'path', p: { d: 'M21 13v1a4 4 0 0 1-4 4H3' } },
  ],
  trend: [
    { t: 'path', p: { d: 'm22 7-8.5 8.5-5-5L2 17' } },
    { t: 'path', p: { d: 'M16 7h6v6' } },
  ],
  target: [
    { t: 'circle', p: { cx: '12', cy: '12', r: '9' } },
    { t: 'circle', p: { cx: '12', cy: '12', r: '5' } },
    { t: 'circle', p: { cx: '12', cy: '12', r: '1' } },
  ],
  check: [{ t: 'path', p: { d: 'M20 6 9 17l-5-5' } }],
  more: [
    { t: 'circle', p: { cx: '5', cy: '12', r: '1', fill: 'currentColor' } },
    { t: 'circle', p: { cx: '12', cy: '12', r: '1', fill: 'currentColor' } },
    { t: 'circle', p: { cx: '19', cy: '12', r: '1', fill: 'currentColor' } },
  ],
  settings: [
    { t: 'circle', p: { cx: '12', cy: '12', r: '3' } },
    {
      t: 'path',
      p: {
        d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
      },
    },
  ],
  users: [
    { t: 'circle', p: { cx: '9', cy: '8', r: '4' } },
    { t: 'path', p: { d: 'M2 21a7 7 0 0 1 14 0' } },
    { t: 'path', p: { d: 'M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3' } },
  ],
  link: [
    { t: 'path', p: { d: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7' } },
    { t: 'path', p: { d: 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7' } },
  ],
};
