/**
 * Regression tests: nutrition field parsing from realistic OCR label text.
 * Mirrors the reported bug — a Maggi-style packet whose label text must map
 * to the correct nutrition fields, and text that supports no value must
 * stay null (never fabricated, never zeroed).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNutritionText, extractBrandAndName } from '../features/ocr/parser';
import { NutritionData } from '../types/food';

const MAGGI_BACK_LABEL_OCR = `
MAGGI
2-Minute Masala Noodles
NET WT. 70g
Nutrition Information (per 100g)*
Serving Size: 30 g
Servings Per Container: 2.3
Energy 406 kcal
Protein 9.1 g
Total Fat 14.8 g
Saturated Fat 6.9 g
Trans Fat 0 g
Cholesterol 0 mg
Sodium 910 mg
Total Carbohydrate 60.2 g
Dietary Fiber 3.4 g
Total Sugars 4.1 g
Added Sugars 2.2 g
INGREDIENTS: Wheat Flour (58%), Palm Oil, Salt, Mineral Salts, Guar Gum, Onions, Chilli Powder, Wheat Gluten
ALLERGY ADVICE: Contains wheat. May contain milk and mustard.
`;

test('nutrition values map to the correct fields', () => {
  const n = parseNutritionText(MAGGI_BACK_LABEL_OCR);
  assert.equal(n.calories, 406, 'Energy 406 kcal -> calories');
  assert.equal(n.protein, 9.1, 'Protein 9.1 g -> protein');
  assert.equal(n.totalFat, 14.8, 'Total Fat 14.8 g -> totalFat');
  assert.equal(n.saturatedFat, 6.9, 'Saturated Fat 6.9 g -> saturatedFat');
  assert.equal(n.transFat, 0, 'explicit 0 stays 0 (printed on the label)');
  assert.equal(n.cholesterol, 0, 'explicit 0 mg stays 0');
  assert.equal(n.sodium, 910, 'Sodium 910 mg -> sodium');
  assert.equal(n.totalCarbs, 60.2, 'Total Carbohydrate 60.2 g -> totalCarbs');
  assert.equal(n.dietaryFiber, 3.4, 'Dietary Fiber 3.4 g -> dietaryFiber');
  assert.equal(n.totalSugars, 4.1, 'Total Sugars 4.1 g -> totalSugars');
  assert.equal(n.addedSugars, 2.2, 'Added Sugars 2.2 g -> addedSugars');
});

test('serving basis and serving size are preserved', () => {
  const n = parseNutritionText(MAGGI_BACK_LABEL_OCR);
  assert.ok(n.servingSize, 'serving size detected from the label');
  assert.match(String(n.servingSize), /30/i);
  assert.equal(n.basis, 'per_100g', 'per 100g basis detected');
});

test('brand and product name are extracted from front-of-package OCR text', () => {
  const frontText = `
MAGGI
2-MINUTE MASALA NOODLES
Every bit as tasty
Simply good
`;
  const { brand, productName } = extractBrandAndName(frontText);
  assert.equal(brand, 'Maggi', 'brand recognized from OCR evidence');
  assert.ok(productName && productName.length > 0, 'product name extracted from title line');
  assert.match(productName!.toLowerCase(), /noodle|masala|2.?minute/, 'name reflects printed title');
  assert.ok(!/maggi\s/i.test(productName + ' '), 'brand is not duplicated inside the name');
});

test('a numeric image filename is never used as the product name', () => {
  // The bug report: gallery photo "155147" became the product name.
  // extractBrandAndName only ever receives OCR text, but guard anyway:
  const fromDigits = extractBrandAndName('155147');
  assert.equal(fromDigits.brand, null);
  assert.equal(fromDigits.productName, null, 'pure digits are not a product name');
});

test('empty or unreadable OCR text keeps all nutrition fields null', () => {
  const n = parseNutritionText('');
  const allNull = Object.entries(n).every(
    ([k, v]) => v === null || v === undefined || k === 'basis'
  );
  assert.ok(allNull, 'no fabricated values for unreadable text');
  assert.equal(n.calories, null);
  assert.equal(n.protein, null);
});

test('unreadable value is null, not zero — zero only when printed', () => {
  // "not detected" must never become 0.
  const n = parseNutritionText('Nutrition Information\nEnergy 100 kcal\nSodium: not present');
  assert.equal(n.calories, 100);
  assert.equal(n.sodium, null, 'unparseable sodium stays unknown, never 0');
  const withZero = parseNutritionText('Sodium 0 mg');
  assert.equal(withZero.sodium, 0, 'explicit "Sodium 0 mg" is a real zero');
});

test('salt is converted to sodium when sodium is not printed', () => {
  const n = parseNutritionText('Nutrition per 100g\nSalt 2.5 g\nEnergy 200 kcal');
  assert.equal(n.salt, 2.5);
  assert.equal(n.sodium, Math.round(2.5 * 393.4), 'sodium derived from salt');
});

test('front-package text with no nutrition table yields no nutrition values', () => {
  const front = 'MAGGI\n2-Minute Noodles\nTasty and healthy snack\nBest shared with friends';
  const n = parseNutritionText(front);
  assert.equal(n.calories, null);
  assert.equal(n.protein, null);
  assert.equal(n.totalFat, null);
});
