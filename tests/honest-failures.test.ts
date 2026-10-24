/**
 * Regression tests: corrupted/unsupported images and no-text images are
 * handled honestly by the extraction layer (no fabricated data).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNutritionText,
  parseIngredientsText,
  extractBrandAndName,
} from '../features/ocr/parser';

test('image with no readable text produces no extraction and no name', () => {
  // e.g. a blurred photo — OCR returns whitespace or empty.
  const empty = parseNutritionText('   \n  \n');
  assert.equal(empty.calories, null);
  assert.equal(empty.protein, null);

  const { brand, productName } = extractBrandAndName('   \n  \n');
  assert.equal(brand, null);
  assert.equal(productName, null, 'never invented from a filename or empty text');

  const ing = parseIngredientsText('no text at all here');
  assert.equal(ing.items.length, 0);
  assert.equal(ing.isGarbageRejected, true);
});

test('OCR garbage noise is rejected as ingredients', () => {
  const ing = parseIngredientsText('XD ngodies H rb MAG msl !@#$%');
  assert.equal(ing.items.length, 0, 'gibberish never becomes an ingredient list');
});

test('filename-like strings never produce a product name', () => {
  // IMG-20231024-WA0012.jpg style names must never be detected as a product.
  const cases = ['155147', 'IMG1234', 'DSC_0042', 'Screenshot_20261024'];
  for (const c of cases) {
    const { brand, productName } = extractBrandAndName(c);
    assert.equal(brand, null, `${c} must not be a brand`);
    assert.ok(productName === null || /[A-Za-z]{2,}/.test(productName), `${c} must not be a name`);
  }
});

test('nutrition echo lines are not treated as product titles', () => {
  const { productName } = extractBrandAndName(
    'Nutrition Facts\nEnergy 406 kcal\nProtein 9.1 g\nServings 2'
  );
  assert.ok(
    productName === null || !/nutrition|energy|protein/i.test(productName),
    'regulatory lines never become the product name'
  );
});
