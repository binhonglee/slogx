import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run SDK test files in this folder when invoked from sdk/ts
    include: ['slogx.test.ts', 'sourcemap.test.ts'],
    environment: 'node',
    globals: false,
  },
});
