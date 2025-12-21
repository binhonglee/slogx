import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run only the SDK test file in this folder when invoked from sdk/ts
    include: ['slogx.test.ts'],
    environment: 'node',
    globals: false,
  },
});
