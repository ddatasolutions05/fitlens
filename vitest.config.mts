import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          include: ['packages/core/src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'schemas',
          include: ['packages/schemas/src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'scripts',
          include: ['scripts/food-import/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'db',
          include: ['supabase/test/**/*.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
