/**
 * v2 regression: nutrition-table column/basis/units parsing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNutritionTable,
  resolveBasis,
  detectHeaderBases,
  parseCell,
  matchNutrientRow,
} from '../features/engine-v2/nutrition-table';

test('header detection: per 100g + per serving columns', () => {
  assert.deepEqual(detectHeaderBases('Nutrition Information   Per 100g   Per Serving (30g)'), [
    'per_100g',
    'per_serving',
  ]);
  assert.deepEqual(detectHeaderBases('  Per 100 g  Per pack'), ['per_100g', 'per_package']);
  assert.equal(detectHeaderBases('Energy 406 kcal'), null, 'nutrient row is not a header');
});

test('cell parsing preserves units and handles decimal commas', () => {
  assert.deepEqual(parseCell('406 kcal'), { value: 406, unit: 'kcal' });
  assert.deepEqual(parseCell('9,1 g'), { value: 9.1, unit: 'g' });
  assert.deepEqual(parseCell('910mg'), { value: 910, unit: 'mg' });
  assert.deepEqual(parseCell('Nil'), { value: 0, unit: null });
  assert.equal(parseCell('—'), null);
});

test('nutrient row labels match the right field', () => {
  assert.equal(matchNutrientRow('Energy'), 'calories');
  assert.equal(matchNutrientRow('Total Carbohydrate'), 'totalCarbs');
  assert.equal(matchNutrientRow('Dietary Fibre'), 'dietaryFiber');
  assert.equal(matchNutrientRow('Added Sugars'), 'addedSugars');
  assert.equal(matchNutrientRow('Total Sugars'), 'totalSugars');
  assert.equal(matchNutrientRow('Salt'), 'salt');
  assert.equal(matchNutrientRow('Saturated Fat'), 'saturatedFat');
  assert.equal(matchNutrientRow('Nonsense'), null);
});

test('two-column Indian table: per-100g preferred over per-serving', () => {
  const text = `
Nutrition Information
                      Per 100g    Per Serving (70g)
Energy                406 kcal    284 kcal
Protein                9.1 g       6.4 g
Total Fat            14.8 g      10.4 g
`;
  const table = parseNutritionTable(text);
  assert.ok(table.detected);
  const resolved = resolveBasis(table);
  assert.equal(resolved.basis, 'per_100g');
  assert.equal(resolved.values['calories'].value, 406);
  assert.equal(resolved.values['protein'].value, 9.1);
  assert.equal(resolved.values['totalFat'].value, 14.8);
  assert.equal(resolved.values['calories'].unit, 'kcal');
});

test('serving-only table resolves to per_serving basis, honestly labelled', () => {
  const text = `
Nutrition per serving (1 pack = 70 g)
Energy    284 kcal
Protein    6.4 g
`;
  const table = parseNutritionTable(text);
  const resolved = resolveBasis(table);
  assert.equal(resolved.basis, 'per_serving');
  assert.equal(resolved.values['calories'].value, 284);
});

test('kj energy in the table maps to energyKj, not calories', () => {
  const text = `
                    Per 100g
Energy              1703 kJ
Protein             9.1 g
`;
  const table = parseNutritionTable(text);
  const resolved = resolveBasis(table);
  assert.ok(resolved.values['energyKj']);
  assert.equal(resolved.values['energyKj'].value, 1703);
  assert.equal(resolved.values['energyKj'].unit, 'kj');
});

test('text without a nutrition table is reported as not detected', () => {
  const table = parseNutritionTable('MAGGI\n2-Minute Noodles\nEvery bit as tasty');
  assert.equal(table.detected, false);
  assert.deepEqual(resolveBasis(table).values, {});
  assert.equal(resolveBasis(table).basis, null);
});
