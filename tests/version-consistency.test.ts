/**
 * NutriLens v2.4.1 version & build-identifier consistency suite.
 *
 * The forensic audit found THREE stale version labels in the shipped UI
 * ("NutriLens 2.3" in the Scan Hub notice, "Version 1.0.0 PWA" in Settings)
 * while the deployed build was actually 2.4 — the user could not verify
 * which version was running. One source of truth (lib/build-info.ts) now
 * feeds every label, the build injects the real commit SHA, and these tests
 * make stale labels fail the suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION, COMMIT_SHA, buildLabel, scanHubNotice, isReleaseBuild } from '../lib/build-info';

const REPO_ROOT = path.resolve(__dirname, '..');

test('APP_VERSION is a semver release identifier', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test('COMMIT_SHA is a 7-hex git SHA or the honest "dev" marker', () => {
  assert.match(COMMIT_SHA, /^([0-9a-f]{7}|dev)$/);
  // In a git-backed release build the SHA must be git-shaped, and the
  // isReleaseBuild predicate must agree with it.
  assert.equal(isReleaseBuild(), COMMIT_SHA !== 'dev');
});

test('buildLabel exposes version + short SHA for Settings/About', () => {
  assert.ok(buildLabel().includes(APP_VERSION));
  assert.ok(buildLabel().includes(COMMIT_SHA));
});

test('scan hub notice is generated from the same source of truth', () => {
  const notice = scanHubNotice(false);
  assert.ok(notice.includes(`NutriLens ${APP_VERSION}`), 'notice must name the current version');
  assert.ok(notice.includes('on-device recognition'), 'local-first notice preserved');
  assert.ok(notice.includes('No cloud, no API keys'), 'privacy stance preserved');
  assert.ok(!/\b2\.3\b|\b1\.0\.0\b/.test(notice), 'no stale version numbers');
  const cloud = scanHubNotice(true);
  assert.ok(cloud.includes(`NutriLens ${APP_VERSION}`));
});

test('no stale hardcoded version labels anywhere in the UI source', () => {
  const uiSources = [
    'features/scanner/ScanHub.tsx',
    'features/settings/SettingsView.tsx',
    'features/home/HomeView.tsx',
    'app/layout.tsx',
    'app/page.tsx',
    'app/manifest.ts',
  ];
  for (const rel of uiSources) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    // "NutriLens 2.3", "(Version 1.0.0 PWA)" etc. — any literal version next
    // to the product name is a stale label waiting to happen.
    assert.ok(
      !/NutriLens\s+v?\d+\.\d/.test(src) && !/Version\s+\d+\.\d+\.\d/.test(src),
      `${rel} must not hardcode a version — use lib/build-info.ts`
    );
  }
});

test('scan hub and settings actually derive their labels from lib/build-info', () => {
  const scanHub = fs.readFileSync(path.join(REPO_ROOT, 'features/scanner/ScanHub.tsx'), 'utf8');
  assert.ok(scanHub.includes('scanHubNotice'), 'ScanHub must use the shared notice builder');
  const settings = fs.readFileSync(path.join(REPO_ROOT, 'features/settings/SettingsView.tsx'), 'utf8');
  assert.ok(settings.includes('buildLabel'), 'Settings/About must display the shared build label');
});

test('the build script injects the real commit SHA (never hardcoded)', () => {
  const buildScript = fs.readFileSync(path.join(REPO_ROOT, 'scripts/build-pages.mjs'), 'utf8');
  assert.ok(buildScript.includes('NEXT_PUBLIC_COMMIT_SHA'), 'build must inject the SHA env var');
  assert.ok(buildScript.includes('rev-parse'), 'SHA must come from git at build time');
  const buildInfo = fs.readFileSync(path.join(REPO_ROOT, 'lib/build-info.ts'), 'utf8');
  assert.ok(buildInfo.includes('NEXT_PUBLIC_COMMIT_SHA'), 'build-info reads the injected SHA');
  // Comments may show FORMAT examples; actual code must not hardcode a SHA.
  const codeOnly = buildInfo
    .split('\n')
    .filter(
      (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')
    )
    .join('\n');
  assert.ok(!/[0-9a-f]{7}/.test(codeOnly), 'build-info code must not hardcode any SHA');
});
