/**
 * v2 regression: mode routing (packaged / cooked / ambiguous).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeMode, countNutritionKeywordHits } from '../features/engine-v2/mode-router';

const baseSignals = {
  barcodeDetected: false,
  ocrTextChars: 0,
  nutritionKeywordHits: 0,
  ingredientsMarkerFound: false,
  userChoice: null,
  visionClass: null,
};

test('no evidence at all → ambiguous, never a forced classification', () => {
  const d = routeMode({ ...baseSignals });
  assert.equal(d.route, 'ambiguous');
  assert.match(d.reason, /unclear|choose/i);
});

test('barcode → packaged', () => {
  const d = routeMode({ ...baseSignals, barcodeDetected: true });
  assert.equal(d.route, 'packaged');
});

test('label text with nutrition keywords → packaged', () => {
  const d = routeMode({
    ...baseSignals,
    ocrTextChars: 400,
    nutritionKeywordHits: countNutritionKeywordHits(
      'Nutrition Information per 100g Energy 406 kcal Protein 9.1 g'
    ),
  });
  assert.equal(d.route, 'packaged');
});

test('ingredients marker alone → packaged', () => {
  const d = routeMode({ ...baseSignals, ingredientsMarkerFound: true, ocrTextChars: 120 });
  assert.equal(d.route, 'packaged');
});

test('some text but weak label evidence → packaged-lean with honest note', () => {
  const d = routeMode({ ...baseSignals, ocrTextChars: 90, nutritionKeywordHits: 0 });
  assert.equal(d.route, 'packaged');
  assert.match(d.reason, /switch to Cooked-food mode/i, 'user is offered the cooked route');
});

test('user choice wins over signals', () => {
  const d = routeMode({ ...baseSignals, barcodeDetected: true, userChoice: 'cooked' });
  assert.equal(d.route, 'cooked');
  const d2 = routeMode({ ...baseSignals, userChoice: 'packaged' });
  assert.equal(d2.route, 'packaged');
});

test('vision classification respected when configured', () => {
  const d = routeMode({ ...baseSignals, visionClass: 'cooked' });
  assert.equal(d.route, 'cooked');
});

test('nutrition keyword counting', () => {
  const hits = countNutritionKeywordHits('energy 100 kcal, protein 2 g, per 100g');
  assert.ok(hits >= 3);
  assert.equal(countNutritionKeywordHits('random shop poster'), 0);
});
