import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Test tích hợp chạy trên database thật (Supabase dev) theo DATABASE_URL trong .env.
// Không chạy trong CI. Chạy: pnpm --filter @subca/api test:int
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
