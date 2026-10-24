/**
 * v2 regression: cooked-food estimation with explicit uncertainty.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDishById, findDishes, DISH_DATABASE } from '../features/engine-v2/cooked/dishes';
import { estimateNutrition, estimatePortion, midpointMacros } from '../features/engine-v2/cooked/estimator';

const samosa = getDishById('samosa')!;
const momo = getDishById('momo-steamed')!;
const chowmein = getDishById('chowmein')!;

test('dish database covers the required dishes', () => {
  assert.ok(samosa && momo && chowmein, 'samosa, momo and chowmein must exist');
  assert.ok(DISH_DATABASE.some((d) => d.id === 'instant-noodles-cooked'));
  assert.ok(DISH_DATABASE.some((d) => d.category === 'rice'));
  assert.ok(DISH_DATABASE.every((d) => d.nutrition.source.length > 0), 'every dish cites a source');
});

test('dish search finds momo/samosa/chowmein by common names', () => {
  assert.ok(findDishes('momo').some((d) => d.id === 'momo-steamed'));
  assert.ok(findDishes('samosa').some((d) => d.id === 'samosa'));
  assert.ok(findDishes('chowmein').some((d) => d.id === 'chowmein'));
  assert.equal(findDishes('xyzzynothing').length, 0);
});

test('samosa by pieces: portion midpoint and explicit uncertainty', () => {
  const est = estimateNutrition({ dish: samosa, userPieces: 2 });
  const expectedMid = Math.round(((samosa.pieceWeightMinG! + samosa.pieceWeightMaxG!) * 2) / 2 / 1);
  assert.equal(est.portion.grams, expectedMid);
  assert.equal(est.portion.method, 'user_pieces');
  assert.match(est.portion.uncertainty, /±\d+ g/);
  // Ranges from the per-100g min..max — never a single fake-precise number.
  assert.ok(est.calories.min < est.calories.max, 'calorie range must be a range');
  assert.ok(est.calories.unit === 'kcal');
  const gramsMid = est.portion.grams;
  assert.equal(est.calories.min, Math.round(((samosa.nutrition.kcalPer100gMin * gramsMid) / 100) * 10) / 10);
});

test('explicit weight wins over pieces and assumptions', () => {
  const est = estimateNutrition({ dish: momo, userWeightG: 200, userPieces: 99 });
  assert.equal(est.portion.method, 'user_weight');
  assert.equal(est.portion.grams, 200);
  assert.match(est.assumptions.join(' '), /you provided it/);
});

test('standard-serving fallback states its uncertainty honestly', () => {
  const est = estimateNutrition({ dish: chowmein });
  assert.equal(est.portion.method, 'standard_serving');
  assert.match(est.portion.uncertainty, /assumed a typical/i);
  assert.ok(est.assumptions.length >= 3);
});

test('unknowns are explicit: oil, salt, allergens never claimed known', () => {
  const est = estimateNutrition({ dish: samosa, userWeightG: 100 });
  const joined = est.unknowns.join(' ').toLowerCase();
  assert.match(joined, /oil/);
  assert.match(joined, /salt/);
  assert.match(joined, /allergen/);
  assert.match(joined, /cannot be measured from a photo/);
});

test('recalculation is deterministic: same inputs → same outputs', () => {
  const a = estimateNutrition({ dish: momo, userPieces: 6 });
  const b = estimateNutrition({ dish: momo, userPieces: 6 });
  assert.deepEqual(a, b, 'no randomness in estimates');
});

test('changing portion changes the estimate (recalculation works)', () => {
  const a = estimateNutrition({ dish: samosa, userPieces: 1 });
  const b = estimateNutrition({ dish: samosa, userPieces: 4 });
  assert.ok(b.calories.min > a.calories.min);
  assert.ok(b.portion.grams > a.portion.grams);
});

test('midpoint macros map to NutritionData fields, null-safe', () => {
  const est = estimateNutrition({ dish: chowmein, userWeightG: 250 });
  const mid = midpointMacros(est);
  assert.ok(mid.calories !== null && mid.calories > 0);
  assert.ok(mid.protein !== null && mid.protein > 0);
  assert.equal(typeof mid.sodium, 'number');
  // Fields with no data stay null — never zero.
  const noFiber = { ...est, fiber: null };
  assert.equal(midpointMacros(noFiber).dietaryFiber, null);
});
