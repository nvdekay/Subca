// Design token lấy từ design/subca-mobile-mockup.html (biến CSS trong :root).
const tokens = require('./src/theme/tokens.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: {
        lg: `${tokens.radius.lg}px`,
        md: `${tokens.radius.md}px`,
        sm: `${tokens.radius.sm}px`,
      },
    },
  },
  plugins: [],
};
