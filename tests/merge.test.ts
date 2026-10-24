/**
 * Regression tests: multi-photo evidence merge + cross-photo conflicts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeNutritionData, describeConflicts, mergeReviewFields } from '../features/ocr/merge';
import { NutritionData } from '../types/food';

function emptyNutrition(): NutritionData {
  return {
    servingSize: null,
    servingsPerContainer: null,
    calories: null,
    totalFat: null,
    saturatedFat: null,
    transFat: null,
    cholesterol: null,
    sodium: null,
    totalCarbs: null,
    dietaryFiber: null,
    totalSugars: null,
    addedSugars: null,
    protein: null,
  };
}

test('incoming evidence fills only unknown fields', () => {
  const existing = { ...emptyNutrition(), calories: 406, protein: 9.1 };
  const incoming = { ...emptyNutrition(), calories: 999, protein: null, sodium: 910, totalFat: 14.8 };

  const { merged, conflicts } = mergeNutritionData(existing, incoming);

  assert.equal(merged.calories, 406, 'existing evidence is never overwritten');
  assert.equal(merged.protein, 9.1);
  assert.equal(merged.sodium, 910, 'incoming fills a previously unknown field');
  assert.equal(merged.totalFat, 14.8);
  assert.deepEqual(conflicts, ['calories'], 'different reading flagged as a conflict');
});

test('empty results from an added photo never erase extracted data', () => {
  const existing = { ...emptyNutrition(), calories: 406, sodium: 910 };
  const incoming = emptyNutrition(); // back photo failed OCR / had nothing

  const { merged, conflicts } = mergeNutritionData(existing, incoming);

  assert.equal(merged.calories, 406, 'front photo result preserved');
  assert.equal(merged.sodium, 910);
  assert.deepEqual(conflicts, []);
});

test('conflict labels are human-readable', () => {
  const labels = describeConflicts(['calories', 'sodium', 'servingSize']);
  assert.deepEqual(labels, ['Calories', 'Sodium', 'Serving size']);
});

test('scalar fields: existing non-empty wins, blank gets filled', () => {
  assert.equal(mergeReviewFields<string>('Maggi 2-Minute Noodles', 'Some New Name'), 'Maggi 2-Minute Noodles');
  assert.equal(mergeReviewFields<string>('', 'Detected Name'), 'Detected Name');
  assert.equal(mergeReviewFields<string | null>(null, 'Haldiram'), 'Haldiram');
});

test('front photo + back photo combined covers brand AND nutrition', () => {
  const front = { ...emptyNutrition() }; // front has no nutrition
  const back = { ...emptyNutrition(), calories: 406, sodium: 910, servingSize: '30 g' };

  const { merged } = mergeNutritionData(front, back);

  assert.equal(merged.calories, 406);
  assert.equal(merged.sodium, 910);
  assert.equal(merged.servingSize, '30 g');
});

test('conflicting readings across photos are flagged, first value kept', () => {
  const photo1 = { ...emptyNutrition(), sodium: 910 };
  const photo2 = { ...emptyNutrition(), sodium: 1200 };

  const { merged, conflicts } = mergeNutritionData(photo1, photo2);

  assert.equal(merged.sodium, 910, 'first detected value kept for review');
  assert.ok(conflicts.includes('sodium'), 'conflict surfaced instead of silent pick');
});
