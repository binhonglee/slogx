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
import { existsSync, mkdirSync, rmSync, copyFileSync, cpSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Clean dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir);

const entries = [
  { name: 'app', input: 'app.html' },
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

// Copy static landing page to dist
console.log('\nCopying landing page...');
copyFileSync(path.join(rootDir, 'index.html'), path.join(distDir, 'index.html'));

// Copy shared styles for the landing page and app UIs.
const stylesSrc = path.join(rootDir, 'styles');
const stylesDest = path.join(distDir, 'styles');
if (existsSync(stylesSrc)) {
  console.log('\nCopying shared styles...');
  cpSync(stylesSrc, stylesDest, { recursive: true });
}

// Copy Docusaurus docs build output into dist/docs.
const docsSrc = path.join(rootDir, 'website', 'build');
const docsDest = path.join(distDir, 'docs');
if (existsSync(path.join(docsSrc, 'index.html'))) {
  console.log('\nCopying docs site...');
  cpSync(docsSrc, docsDest, { recursive: true });
} else {
  console.warn('\nDocs build not found at website/build. Run `npm run docs:build` before `npm run build`.');
}

// Run the inline script
console.log('\nInlining assets...');
const { execSync } = await import('child_process');
execSync('node scripts/inline.js', { cwd: rootDir, stdio: 'inherit' });

console.log('\nBuild complete!');
