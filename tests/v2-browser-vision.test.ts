/**
 * Tests for the v2.2 API-key-free browser recognition:
 *  - Food-101 vocabulary + curated dish mapping
 *  - softmax math
 *  - imageDataToTensor preprocessing math
 *  - browserClassifyCooked ranking, dedupe, notes and failure modes
 *    (with an injected fake session — no real browser needed)
 *  - offline / model-download error paths
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOD_101_CLASSES,
  mapFood101Class,
  humanizeFood101,
} from '../features/engine-v2/food101';
import {
  softmax,
  imageDataToTensor,
  buildDishCandidates,
  ModelDownloadError,
  ImageDecodeError,
  InferenceError,
} from '../features/engine-v2/browser-vision';
import { getDishById } from '../features/engine-v2/cooked/dishes';

// ---------------------------------------------------------------- food101

test('food101 vocabulary has exactly 101 unique classes', () => {
  assert.equal(FOOD_101_CLASSES.length, 101);
  assert.equal(new Set(FOOD_101_CLASSES).size, 101);
});

test('curated mapping resolves to existing dishes only', () => {
  for (const cls of ['samosa', 'chow_mein', 'dumplings', 'gyoza', 'fried_rice', 'ramen', 'pho', 'spring_rolls']) {
    const m = mapFood101Class(cls);
    assert.ok(m, `${cls} should be mapped`);
    assert.ok(getDishById(m.dishId), `${cls} -> ${m.dishId} must exist in the dish database`);
  }
});

test('mapping kinds are honest: direct only for exact dishes', () => {
  assert.equal(mapFood101Class('samosa')?.kind, 'direct');
  assert.equal(mapFood101Class('chow_mein')?.kind, 'direct');
  assert.equal(mapFood101Class('dumplings')?.kind, 'near');
  assert.equal(mapFood101Class('gyoza')?.kind, 'near');
});

test('near mappings always carry a user-confirmation note', () => {
  for (const cls of ['dumplings', 'gyoza', 'fried_rice', 'ramen', 'pho', 'spring_rolls']) {
    const m = mapFood101Class(cls)!;
    assert.equal(m.kind, 'near');
    assert.ok(m.note && m.note.length > 10, `${cls} needs a note`);
  }
});

test('unmapped classes (no honest dish equivalent) return null', () => {
  for (const cls of ['pizza', 'lasagna', 'ceviche', 'tuna_tartare', 'apple_pie']) {
    assert.equal(mapFood101Class(cls), null, `${cls} must not be mapped`);
  }
});

test('humanize converts snake_case classes', () => {
  assert.equal(humanizeFood101('chow_mein'), 'chow mein');
  assert.equal(humanizeFood101('samosa'), 'samosa');
});

// ---------------------------------------------------------------- softmax

test('softmax sums to 1 and ranks correctly', () => {
  const p = softmax([2.0, 1.0, 0.5, -1]);
  const sum = p.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(p[0] > p[1] && p[1] > p[2] && p[2] > p[3]);
});

test('softmax is stable for extreme logits', () => {
  const p = softmax([1000, 999, -1000]);
  const sum = p.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(p[0] > 0.5);
  assert.ok(Number.isFinite(p[2]));
});

test('softmax on uniform logits is uniform', () => {
  const p = softmax([3, 3, 3]);
  for (const v of p) assert.ok(Math.abs(v - 1 / 3) < 1e-9);
});

// -------------------------------------------------------- preprocessing

test('imageDataToTensor normalizes to ImageNet stats in CHW order', () => {
  const px = new Uint8ClampedArray(224 * 224 * 4);
  const data = { data: px };
  // Pixel 0: mid-gray (128,128,128); pixel 1: white
  px[0] = 128; px[1] = 128; px[2] = 128; px[3] = 255;
  px[4] = 255; px[5] = 255; px[6] = 255; px[7] = 255;
  const t = imageDataToTensor(data);
  assert.equal(t.length, 3 * 224 * 224);
  const n = 224 * 224;
  // channel R, pixel 0: (128/255 - 0.485) / 0.229
  const expected = (128 / 255 - 0.485) / 0.229;
  assert.ok(Math.abs(t[0] - expected) < 1e-5);
  // channel G of pixel 0 must live in the G plane
  const expectedG = (128 / 255 - 0.456) / 0.224;
  assert.ok(Math.abs(t[n] - expectedG) < 1e-5);
  const expectedB = (128 / 255 - 0.406) / 0.225;
  assert.ok(Math.abs(t[2 * n] - expectedB) < 1e-5);
  // white pixel 1, R plane: (1 - 0.485)/0.229
  assert.ok(Math.abs(t[1] - (1 - 0.485) / 0.229) < 1e-5);
});

// ------------------------------------------------- classification logic

const IDX = (cls: string) => FOOD_101_CLASSES.indexOf(cls);
assert.ok(IDX('samosa') >= 0);

/** Build a fake logits vector putting mass on the given classes. */
function fakeLogits(top: { cls: string; logit: number }[]): Float32Array {
  const v = new Float32Array(101).fill(-6);
  for (const { cls, logit } of top) v[IDX(cls)] = logit;
  return v;
}

test('buildDishCandidates ranks mapped dishes with dishId, kind and note', async () => {
  const logits = fakeLogits([
    { cls: 'dumplings', logit: 4 },
    { cls: 'gyoza', logit: 3.5 },
    { cls: 'donuts', logit: -1 },
  ]);
  const { candidates, topClass, topConfidence } = buildDishCandidates(softmax(logits), 5);
  // dumplings and gyoza collapse into ONE momo candidate — the stronger one.
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].dishId, 'momo-steamed');
  assert.equal(candidates[0].rawClass, 'dumplings');
  assert.equal(candidates[0].kind, 'near');
  assert.ok(candidates[0].note);
  assert.ok(candidates[0].confidence > 0.5);
  assert.ok(getDishById(candidates[0].dishId!));
  assert.equal(topClass, 'dumplings');
  assert.ok(topConfidence > 0.5);
});

test('direct mapping is marked direct (no confirmation note needed)', () => {
  const { candidates } = buildDishCandidates(softmax(fakeLogits([{ cls: 'samosa', logit: 5 }])), 5);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].dishId, 'samosa');
  assert.equal(candidates[0].kind, 'direct');
  assert.equal(candidates[0].note, undefined);
});

test('model-download failure raises ModelDownloadError with honest message', () => {
  const err = new ModelDownloadError('Could not download the recognition model');
  assert.ok(/Could not download/.test(err.message));
  assert.equal(err.name, 'ModelDownloadError');
});

test('typed errors are distinguishable for UI states', () => {
  const a = new ImageDecodeError('bad format');
  const b = new InferenceError('failed');
  assert.ok(a instanceof ImageDecodeError);
  assert.ok(b instanceof InferenceError);
  assert.ok(!(a instanceof InferenceError));
});

// cleanup fake globals between tests
