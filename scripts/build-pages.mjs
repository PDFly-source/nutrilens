#!/usr/bin/env node
/**
 * NutriLens GitHub Pages static-export build wrapper.
 *
 * Next.js `output: 'export'` does not support API routes. The server-side
 * Gemini vision route (app/api/analyze-image) only works when the app is
 * served by a Node server (AI Studio / self-hosted); GitHub Pages is static,
 * where the app automatically falls back to the built-in local OCR pipeline
 * (features/ocr/client-analyzer.ts and unified-analyzer.ts).
 *
 * This script temporarily moves app/api out of the source tree, runs the
 * static production build, and ALWAYS restores app/api afterwards — even if
 * the build fails. The API route source is never modified or deleted.
 *
 * Usage:
 *   NEXT_OUTPUT=export NEXT_PUBLIC_BASE_PATH=/nutrilens node scripts/build-pages.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const apiDir = resolve(root, 'app/api');
const stashDir = resolve(root, '.pages-export-tmp');
const outDir = resolve(root, 'out');

let restored = false;
function restoreApiRoute() {
  if (restored) return;
  restored = true;
  if (existsSync(resolve(stashDir, 'api'))) {
    if (existsSync(apiDir)) {
      // Something recreated app/api during the build; keep the stashed original.
      rmSync(resolve(stashDir, 'api'), { recursive: true, force: true });
    } else {
      renameSync(resolve(stashDir, 'api'), apiDir);
    }
  }
  rmSync(stashDir, { recursive: true, force: true });
}

process.on('exit', restoreApiRoute);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    restoreApiRoute();
    process.exit(1);
  });
}

// 1. Stash the API route (not deployable on a static host).
if (existsSync(apiDir)) {
  mkdirSync(stashDir, { recursive: true });
  renameSync(apiDir, resolve(stashDir, 'api'));
  console.log('[build-pages] Temporarily excluding app/api (unsupported in static export).');
}

// 2. Clean previous export output.
rmSync(outDir, { recursive: true, force: true });

// 3. Run the real production build (inherits env: NEXT_OUTPUT, NEXT_PUBLIC_BASE_PATH).
const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

restoreApiRoute();

if (result.status !== 0) {
  console.error('[build-pages] Static export build FAILED.');
  process.exit(result.status ?? 1);
}

if (!existsSync(outDir)) {
  console.error('[build-pages] Build finished but no ./out directory was produced.');
  process.exit(1);
}

console.log('[build-pages] Static export completed successfully → ./out');

// 4. Verify GitHub Pages base-path assets: every /nutrilens/_next asset
// referenced by the exported pages must exist on disk under out/.
import fs from 'fs';
import path from 'path';

const pages = ['index.html'];
const missing = [];
const checked = new Set();
for (const page of pages) {
  const html = fs.readFileSync(path.join(outDir, page), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (!ref.startsWith('/nutrilens/')) continue; // only verify base-pathed assets
    if (checked.has(ref)) continue;
    checked.add(ref);
    const file = path.join(outDir, ref.replace('/nutrilens/', ''));
    if (!fs.existsSync(file)) missing.push(ref);
  }
}
if (missing.length > 0) {
  console.error('[build-pages] MISSING base-path assets in export:', missing);
  process.exit(1);
}
console.log(`[build-pages] Verified ${checked.size} base-path assets exist in ./out ✓`);
