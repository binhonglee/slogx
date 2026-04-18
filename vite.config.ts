import path from 'path';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  // Build config is in scripts/build.js for separate entry point builds
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'sdk/',
        'scripts/',
        '**/*.d.ts',
        'vite.config.ts',
        'playwright.config.ts',
        '**/*.spec.ts',
      ]
    },
    include: ['components/*.test.{ts,tsx}', 'hooks/*.test.{ts,tsx}', 'services/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  }
});
