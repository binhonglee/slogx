#!/usr/bin/env node
/**
 * Inlines all JS, CSS, and images from Vite build into a single HTML file.
 * Run after `vite build` to produce dist/slogx.html
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, rmdirSync, existsSync, rename } from 'fs';
import { join } from 'path';

const distDir = join(import.meta.dirname, '..', 'dist');
const assetsDir = join(distDir, 'assets');

// Read the built index.html
let html = readFileSync(join(distDir, 'index.html'), 'utf-8');

// Find the JS and CSS file names
const cssFiles = readdirSync(assetsDir).filter(f => f.endsWith('.css'));
const jsFiles = readdirSync(assetsDir).filter(f => f.endsWith('.js'));

// Read file contents
const cssContent = cssFiles.length > 0 ? readFileSync(join(assetsDir, cssFiles[0]), 'utf-8') : '';
let jsContent = jsFiles.length > 0 ? readFileSync(join(assetsDir, jsFiles[0]), 'utf-8') : '';

// Convert images to base64 and inline them
const imageFiles = readdirSync(assetsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.svg'));
for (const img of imageFiles) {
  const imgPath = join(assetsDir, img);
  const imgData = readFileSync(imgPath);
  const ext = img.split('.').pop();
  const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  const base64 = imgData.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // Replace in HTML (favicon)
  html = html.split(`/assets/${img}`).join(dataUrl);

  // Replace in JS (logo)
  jsContent = jsContent.split(`/assets/${img}`).join(dataUrl);
}

// Replace tags with inline content
// Using arrow function to avoid $& and other special replacement patterns in JS content
if (cssFiles.length > 0) {
  const cssTag = `<link rel="stylesheet" crossorigin href="/assets/${cssFiles[0]}">`;
  html = html.replace(cssTag, () => `<style>${cssContent}</style>`);
}

if (jsFiles.length > 0) {
  const jsTag = `<script type="module" crossorigin src="/assets/${jsFiles[0]}"></script>`;
  html = html.replace(jsTag, () => `<script type="module">${jsContent}</script>`);
}

// Write the single-file output
const outputPath = join(distDir, 'slogx.html');
writeFileSync(outputPath, html);

// Clean up intermediate files
unlinkSync(join(distDir, 'index.html'));
for (const file of readdirSync(assetsDir)) {
  unlinkSync(join(assetsDir, file));
}
rmdirSync(assetsDir);

const finalOutputPath = join(distDir, 'index.html');
rename(outputPath, finalOutputPath, (err) => {
  if (err) console.error('File rename failed!');
});

console.log(`Created: ${finalOutputPath} (${(html.length / 1024).toFixed(1)} KB)`);
