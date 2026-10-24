/**
 * NutriLens 2.4 deployment & regression suite.
 *
 * Guards the properties that make the static GitHub Pages deployment real:
 * the shipped model asset is byte-present and valid ONNX, every registry
 * asset resolves inside the export (base-path join), the post-evaluation
 * pad_thai mapping stays honest, and the numbers quoted in the evaluation
 * report cannot drift from the committed results.json.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getBundledModel, MODEL_REGISTRY, modelCacheKey } from '../features/engine-v2/model-registry';
import { mapFood101Class, FOOD_101_CLASSES } from '../features/engine-v2/food101';
import { classifyConfidence } from '../features/engine-v2/confidence-policy';
import { getDishById } from '../features/engine-v2/cooked/dishes';

const REPO_ROOT = path.resolve(__dirname, '..');
const hasOut = fs.existsSync(path.join(REPO_ROOT, 'out'));

// ------------------------------------------------ shipped model integrity

test('bundled registry entry matches the file actually shipped in public/', () => {
  const m = getBundledModel();
  assert.equal(m.assetPath, '/models/food101-mobilenetv2.onnx');
  const file = path.join(REPO_ROOT, 'public', m.assetPath.replace(/^\//, ''));
  assert.ok(fs.existsSync(file), 'public/models/food101-mobilenetv2.onnx must exist');
  const size = fs.statSync(file).size;
  assert.equal(size, m.approximateBytes, 'registry approximateBytes must match the shipped file');
});

test('shipped model file is a valid ONNX protobuf (magic bytes)', () => {
  const buf = fs.readFileSync(path.join(REPO_ROOT, 'public/models/food101-mobilenetv2.onnx'));
  assert.equal(buf.length, 9385782);
  // ONNX is protobuf: field 1 (ir_version) is varint — 0x08, then a small value.
  assert.equal(buf[0], 0x08, 'first byte must be protobuf field tag for ir_version');
  assert.ok(buf[1] < 16, 'ir_version must be a small varint');
});

test('ORT wasm runtime assets ship next to the model with stable sizes', () => {
  const wasm = fs.readFileSync(path.join(REPO_ROOT, 'public/ort/ort-wasm-simd-threaded.wasm'));
  const glue = fs.readFileSync(path.join(REPO_ROOT, 'public/ort/ort-wasm-simd-threaded.mjs'));
  assert.equal(wasm.length, 11210254, 'wasm runtime size must be the verified one');
  assert.ok(glue.length > 10000, 'ESM glue file must be the real runtime, not a stub');
});

// --------------------------------------------- deployment path joins

test('registry asset paths resolve inside the static export when built', { skip: !hasOut }, () => {
  const base = path.join(REPO_ROOT, 'out');
  const bundledAsset = getBundledModel().assetPath!;
  for (const asset of [
    bundledAsset,
    '/ort/ort-wasm-simd-threaded.wasm',
    '/ort/ort-wasm-simd-threaded.mjs',
    '/manifest.webmanifest',
    '/sw.js',
    '/index.html',
  ]) {
    const resolved = path.join(base, asset.replace(/^\//, ''));
    assert.ok(fs.existsSync(resolved), `out${asset} must exist in the built export`);
  }
  // Byte-parity between source asset and exported copy (no transform may occur).
  const src = fs.readFileSync(path.join(REPO_ROOT, 'public/models/food101-mobilenetv2.onnx'));
  const dst = fs.readFileSync(path.join(base, 'models/food101-mobilenetv2.onnx'));
  assert.ok(src.equals(dst), 'exported model must be byte-identical to public/models');
});

test('base-path join produces the production URL shape', () => {
  const base = '/nutrilens';
  const m = getBundledModel();
  const url = `${base}${m.assetPath}`;
  assert.equal(url, '/nutrilens/models/food101-mobilenetv2.onnx');
  assert.equal(`${base}/ort/`, '/nutrilens/ort/');
});

// ------------------------------------------------- pad_thai mapping (2.4)

test('pad_thai maps honestly: near-kind, note, existing dish, confirm policy', () => {
  const m = mapFood101Class('pad_thai');
  assert.ok(m, 'pad_thai must be mapped (added in 2.4)');
  assert.equal(m.kind, 'near', 'pad_thai is a relative, not the dish');
  assert.equal(m.dishId, 'chowmein');
  assert.ok(m.note && m.note.length > 10);
  assert.ok(getDishById(m.dishId));
  const policy = classifyConfidence([
    { name: m.observedName, confidence: 0.953, dishId: m.dishId, kind: m.kind, rawClass: 'pad_thai' },
  ]);
  assert.equal(policy.decision, 'confirm', 'even a 95% pad_thai score must require confirmation');
});

test('mapping table integrity: direct kinds only for exact dishes, all dishIds exist', () => {
  const directAllow = new Set(['samosa', 'chow_mein']);
  for (const cls of FOOD_101_CLASSES) {
    const m = mapFood101Class(cls);
    if (!m) continue;
    if (m.kind === 'direct') {
      assert.ok(directAllow.has(cls), `${cls} is direct — add it to the allowlist deliberately`);
    }
    assert.ok(getDishById(m.dishId), `${cls} -> ${m.dishId} must exist in the dish DB`);
    if (m.kind === 'near') assert.ok(m.note, `${cls} near-mapping must carry a note`);
  }
});

// ------------------------------------------- eval report / data integrity

test('committed evaluation results match the numbers quoted in the report', () => {
  const resultsPath = path.join(REPO_ROOT, 'eval/real-image-eval/results.json');
  const docPath = path.join(REPO_ROOT, 'docs/real-image-eval-2.4.md');
  assert.ok(fs.existsSync(resultsPath), 'results.json must be committed');
  const s = JSON.parse(fs.readFileSync(resultsPath, 'utf8')).summary;
  const doc = fs.readFileSync(docPath, 'utf8');
  assert.equal(s.images_total, 31);
  assert.equal(s.supported_set.n, 16);
  assert.equal(s.supported_set.raw_model_top1, 4);
  assert.equal(s.supported_set.raw_model_top3, 7);
  assert.equal(s.supported_set.ground_truth_family_mapped, 8);
  assert.equal(s.unsupported_set.n, 15);
  assert.equal(s.unsupported_set.wrongly_auto_routed, 0, 'safety property: never silently auto-routed');
  // the doc must quote exactly these values (no drift in either direction)
  assert.ok(doc.includes('4/16 = **25.0%**'));
  assert.ok(doc.includes('7/16 = **43.8%**'));
  assert.ok(doc.includes('8/16 = **50.0%**'));
  assert.ok(doc.includes('9/15 = 60.0%'), 're-run numbers must match results.json');
  assert.ok(doc.includes('10/15 = **66.7%**'), 'first-pass numbers must stay disclosed');
  assert.ok(doc.includes('0/15 = 0%'));
});

test('every evaluation image is accounted for in the licence manifest', () => {
  const manifestPath = path.join(REPO_ROOT, 'eval/real-image-eval/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.length, 31);
  for (const item of manifest) {
    assert.match(item.licence, /CC |Public domain/i, `${item.file}: licence must be recorded`);
    assert.ok(item.source_url.startsWith('https://commons.wikimedia.org'), 'provenance must be Commons');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'eval/real-image-eval', item.file)), `${item.file} missing`);
  }
});

// ------------------------------------------------ cache versioning guard

test('cache keys still invalidate on version bumps (regression)', () => {
  const m = getBundledModel();
  const key = modelCacheKey(m);
  assert.ok(key.includes(m.version), 'the shipped cache key must embed the shipped version');
  assert.notEqual(key, modelCacheKey({ id: m.id, version: '9.9.9' }));
});

test('planned indian-food model stays unshipped (no fake weights)', () => {
  const planned = MODEL_REGISTRY.find((m) => m.id === 'indian-food')!;
  assert.equal(planned.status, 'planned');
  assert.equal(planned.assetPath, null);
  const file = path.join(REPO_ROOT, 'public/models');
  for (const f of fs.readdirSync(file)) {
    assert.match(f, /food101/, `unexpected model file in public/models: ${f}`);
  }
});
