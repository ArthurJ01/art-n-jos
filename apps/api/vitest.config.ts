import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './test/global-setup.ts',
    // Tests share one database, so run test files one at a time.
    fileParallelism: false,
  },
});
