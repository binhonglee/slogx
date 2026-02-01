#!/usr/bin/env node
/**
 * Build script that creates standalone HTML files for each entry point.
 * Builds each entry separately with inlineDynamicImports to avoid shared chunks,
 * then inlines all assets into the HTML files.
 */

import { build } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Clean dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir);

const entries = [
  { name: 'main', input: 'index.html' },
  { name: 'replay', input: 'replay.html' },
];

for (const entry of entries) {
  console.log(`\nBuilding ${entry.name}...`);

  await build({
    root: rootDir,
    plugins: [preact()],
    resolve: {
      alias: {
        '@': rootDir,
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false, // Don't clean between builds
      cssCodeSplit: false,
      rollupOptions: {
        input: path.resolve(rootDir, entry.input),
        output: {
          inlineDynamicImports: true,
          // Use entry name in output to avoid conflicts
          entryFileNames: `assets/${entry.name}-[hash].js`,
        }
      }
    },
    logLevel: 'info',
  });
}

// Run the inline script
console.log('\nInlining assets...');
const { execSync } = await import('child_process');
execSync('node scripts/inline.js', { cwd: rootDir, stdio: 'inherit' });

console.log('\nBuild complete!');
