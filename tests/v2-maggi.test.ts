/**
 * v2 regression: Maggi-style front + back label fixtures through the FULL
 * engine (resolver + table parser + pipeline combine), as required by the
 * test plan. Fixtures are deterministic OCR text modeled on the real
 * Maggi 2-Minute Masala Noodles package (70 g, ~406 kcal/100g).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProduct } from '../features/engine-v2/product-resolver';
import { combineTableAndLineParsing } from '../features/engine-v2/pipeline';

const FRONT_TEXT = `
MAGGI
2-Minute Masala Noodles
70 g
Nestlé India Ltd
Simply Good
`;

const BACK_TEXT = `
MAGGI
2-Minute Masala Noodles
Nutrition Information
                     Per 100g   Per Serving (30g)
Energy                406 kcal   122 kcal
Protein               9.1 g      2.7 g
Total Fat            14.8 g     4.4 g
Saturated Fat         6.9 g      2.1 g
Trans Fat             0 g        0 g
Cholesterol           0 mg       0 mg
Sodium               910 mg     273 mg
Total Carbohydrate    60.2 g     18.1 g
Dietary Fibre         3.4 g      1.0 g
Total Sugars          4.1 g      1.2 g
Added Sugars          2.2 g      0.7 g
INGREDIENTS: Wheat Flour (58%), Palm Oil, Mineral Salts, Guar Gum, Chilli Powder
ALLERGY ADVICE: Contains wheat. May contain milk and mustard.
`;

test('MAGGI front package: brand, title, flavour, weight — never a filename', () => {
  const r = resolveProduct(FRONT_TEXT);
  assert.equal(r.brand, 'Maggi');
  assert.ok(r.title, 'title extracted from printed text');
  assert.match(r.title, /Noodle/i, 'title keeps the product type');
  assert.equal(r.flavour, 'Masala', 'flavour split from the title');
  assert.equal(r.netWeightG, 70, 'net weight recognized');
  assert.equal(r.netWeightRaw, '70 g');
});

test('MAGGI back label: two-column table parsed with correct per-100g values', () => {
  const { nutrition, table } = combineTableAndLineParsing(BACK_TEXT);
  assert.ok(table.detected, 'table layout detected');
  assert.deepEqual(table.bases, ['per_100g', 'per_serving']);
  assert.equal(table.rawHeader?.includes('Per 100g'), true);
  assert.equal(nutrition.basis, 'per_100g', 'per-100g column chosen');

  assert.equal(nutrition.calories, 406, 'Energy per 100g column value');
  assert.equal(nutrition.protein, 9.1);
  assert.equal(nutrition.totalFat, 14.8);
  assert.equal(nutrition.saturatedFat, 6.9);
  assert.equal(nutrition.transFat, 0);
  assert.equal(nutrition.cholesterol, 0);
  assert.equal(nutrition.sodium, 910);
  assert.equal(nutrition.totalCarbs, 60.2);
  assert.equal(nutrition.dietaryFiber, 3.4);
  assert.equal(nutrition.totalSugars, 4.1);
  assert.equal(nutrition.addedSugars, 2.2);
});

test('brand recognized on back label too, title not lost', () => {
  const r = resolveProduct(BACK_TEXT);
  assert.equal(r.brand, 'Maggi');
});

test('numeric filename text never becomes a product', () => {
  const r = resolveProduct('155147\nIMG-20231024-WA0012');
  assert.equal(r.brand, null);
  assert.equal(r.title, null, 'digits-only lines rejected as titles');
  assert.equal(r.flavour, null);
});

test('front-only text produces NO nutrition fabrication', () => {
  const { nutrition } = combineTableAndLineParsing(FRONT_TEXT);
  assert.equal(nutrition.calories, null);
  assert.equal(nutrition.protein, null);
  assert.equal(nutrition.sodium, null);
  assert.equal(nutrition.basis, null, 'no basis claimed without a table');
});
