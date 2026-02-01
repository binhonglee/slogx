#!/usr/bin/env node
/**
 * Inlines all JS, CSS, and images from Vite build into standalone HTML files.
 * Run after `vite build` to produce self-contained dist/app.html, dist/replay.html, and dist/index.html
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, rmdirSync, existsSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dirname, '..');
const distDir = join(rootDir, 'dist');
const assetsDir = join(distDir, 'assets');

// Read source files for landing page
const landingCss = existsSync(join(rootDir, 'styles', 'landing.css'))
  ? readFileSync(join(rootDir, 'styles', 'landing.css'), 'utf-8')
  : '';

// Read source images for landing page
const sourceImages = {};
const publicAssetsDir = join(rootDir, 'public', 'assets');
if (existsSync(publicAssetsDir)) {
  for (const img of readdirSync(publicAssetsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.svg'))) {
    const imgData = readFileSync(join(publicAssetsDir, img));
    const ext = img.split('.').pop();
    const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    sourceImages[img] = `data:${mimeType};base64,${imgData.toString('base64')}`;
  }
}

if (!existsSync(assetsDir)) {
  // No Vite assets, but still process landing page
  processLandingPage();
  console.log('No Vite assets directory found, only processed landing page');
  process.exit(0);
}

// Get all asset files
const cssFiles = readdirSync(assetsDir).filter(f => f.endsWith('.css'));
const jsFiles = readdirSync(assetsDir).filter(f => f.endsWith('.js'));
const imageFiles = readdirSync(assetsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.svg'));

// Read CSS content
const cssContent = cssFiles.map(f => readFileSync(join(assetsDir, f), 'utf-8')).join('\n');

// Read all JS files into a map
const jsContents = {};
for (const jsFile of jsFiles) {
  jsContents[jsFile] = readFileSync(join(assetsDir, jsFile), 'utf-8');
}

// Convert images to base64
const imageDataUrls = {};
for (const img of imageFiles) {
  const imgPath = join(assetsDir, img);
  const imgData = readFileSync(imgPath);
  const ext = img.split('.').pop();
  const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  const base64 = imgData.toString('base64');
  imageDataUrls[img] = `data:${mimeType};base64,${base64}`;
}

/**
 * Process a single HTML file: inline all its JS, CSS, and images
 */
function processHtmlFile(htmlFileName) {
  const htmlPath = join(distDir, htmlFileName);
  if (!existsSync(htmlPath)) {
    console.log(`Skipping ${htmlFileName} (not found)`);
    return null;
  }

  let html = readFileSync(htmlPath, 'utf-8');

  // Replace image references in HTML
  for (const [img, dataUrl] of Object.entries(imageDataUrls)) {
    html = html.split(`/assets/${img}`).join(dataUrl);
  }

  // Remove modulepreload links (not needed when inlined)
  html = html.replace(/<link\s+rel="modulepreload"[^>]*>\s*/g, '');

  // Find and inline script tags
  const scriptRegex = /<script type="module" crossorigin src="\/assets\/([^"]+\.js)"><\/script>/g;
  html = html.replace(scriptRegex, (match, jsFileName) => {
    if (jsContents[jsFileName]) {
      let jsContent = jsContents[jsFileName];

      // Replace image references in JS
      for (const [img, dataUrl] of Object.entries(imageDataUrls)) {
        jsContent = jsContent.split(`/assets/${img}`).join(dataUrl);
      }

      return `<script type="module">${jsContent}</script>`;
    }
    return match;
  });

  // Replace CSS link tags with inline style
  for (const cssFile of cssFiles) {
    const cssTag = `<link rel="stylesheet" crossorigin href="/assets/${cssFile}">`;
    html = html.replace(cssTag, `<style>${cssContent}</style>`);
  }

  return html;
}

/**
 * Process the landing page: inline CSS and images from source
 */
function processLandingPage() {
  const htmlPath = join(distDir, 'index.html');
  if (!existsSync(htmlPath)) {
    console.log('Skipping index.html (not found)');
    return null;
  }

  let html = readFileSync(htmlPath, 'utf-8');

  // Replace source image references
  for (const [img, dataUrl] of Object.entries(sourceImages)) {
    html = html.split(`/assets/${img}`).join(dataUrl);
  }

  // Inline landing CSS
  html = html.replace(
    /<link rel="stylesheet" href="\/styles\/landing\.css" \/>/,
    `<style>${landingCss}</style>`
  );

  return html;
}

// Process HTML files
const htmlFiles = ['app.html', 'replay.html'];
const results = [];

for (const htmlFile of htmlFiles) {
  const result = processHtmlFile(htmlFile);
  if (result) {
    const outputPath = join(distDir, htmlFile);
    writeFileSync(outputPath, result);
    results.push({ name: htmlFile, size: result.length });
    console.log(`Created: ${outputPath} (${(result.length / 1024).toFixed(1)} KB)`);
  }
}

// Process landing page
const landingResult = processLandingPage();
if (landingResult) {
  const outputPath = join(distDir, 'index.html');
  writeFileSync(outputPath, landingResult);
  results.push({ name: 'index.html', size: landingResult.length });
  console.log(`Created: ${outputPath} (${(landingResult.length / 1024).toFixed(1)} KB)`);
}

// Clean up assets directory
for (const file of readdirSync(assetsDir)) {
  unlinkSync(join(assetsDir, file));
}
rmdirSync(assetsDir);

console.log(`\nInline complete: ${results.length} files processed`);
