/**
 * v2 regression: image quality assessment on synthetic pixel arrays.
 * Deterministic fixtures: a sharp checkerboard-ish pattern vs a flat blur.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  laplacianVariance,
  meanBrightness,
  glareRatio,
  assessQuality,
} from '../features/engine-v2/image-quality';

function makeImage(w: number, h: number, fn: (x: number, y: number) => number): Uint8Array {
  const a = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = fn(x, y);
  return a;
}

const SHARP = makeImage(64, 64, (x, y) => ((x + y) % 2 === 0 ? 20 : 220)); // high-frequency
const BLURRED = makeImage(64, 64, () => 120); // flat — zero Laplacian variance
const GRADIENT = makeImage(64, 64, (x) => x * 3); // smooth ramp — tiny variance
const DARK = makeImage(64, 64, () => 10);
const GLARE = makeImage(64, 64, (x, y) => (y < 8 ? 250 : 100)); // bright top strip

test('sharp image has far higher Laplacian variance than blurred/flat', () => {
  const vSharp = laplacianVariance(SHARP, 64, 64);
  const vBlur = laplacianVariance(BLURRED, 64, 64);
  const vGrad = laplacianVariance(GRADIENT, 64, 64);
  assert.ok(vSharp > 10000, `sharp variance high (got ${vSharp})`);
  assert.equal(vBlur, 0, 'flat image variance is exactly 0');
  assert.ok(vGrad < vSharp / 100, `smooth gradient has low variance (got ${vGrad})`);
});

test('quality report: sharp good, flat poor, dark poor', () => {
  const good = assessQuality(SHARP, 64, 64);
  assert.equal(good.verdict, 'good');
  assert.equal(good.advice, null);

  const flat = assessQuality(BLURRED, 64, 64);
  assert.equal(flat.verdict, 'poor');
  assert.match(flat.advice || '', /blurred/i, 'poor quality gives retake advice');

  const dark = assessQuality(DARK, 64, 64);
  assert.equal(dark.verdict, 'poor');
  assert.match(dark.advice || '', /dark|light/i);
});

test('glare detection flags near-white regions', () => {
  assert.ok(glareRatio(GLARE) > 0.1, 'bright strip detected');
  assert.equal(glareRatio(BLURRED), 0);
  assert.ok(meanBrightness(GLARE) > 100);
});

test('tiny images are handled without crashing', () => {
  assert.equal(laplacianVariance(new Uint8Array(4), 2, 2), 0);
  const r = assessQuality(new Uint8Array(4), 2, 2);
  assert.equal(r.verdict, 'poor');
});
