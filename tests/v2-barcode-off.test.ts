/**
 * v2 regression: Open Food Facts response parsing (barcode candidate source).
 * Uses the documented OFF v2 API JSON shape. No network access needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOffResponse,
  offUrlForBarcode,
  offNutritionAsEvidence,
} from '../features/engine-v2/barcode-off';

const OFF_PRODUCT_JSON = {
  status: 1,
  product: {
    product_name: '2-Minute Masala Noodles',
    brands: 'Maggi, Nestlé',
    quantity: '70 g',
    serving_size: '30 g',
    ingredients_text: 'Wheat flour, palm oil, salt',
    allergens: 'gluten',
    image_front_url: 'https://images.openfoodfacts.org/xxx/front.jpg',
    nutriments: {
      'energy-kcal_100g': 406,
      'fat_100g': 14.8,
      'saturated-fat_100g': 6.9,
      'carbohydrates_100g': 60.2,
      'sugars_100g': 4.1,
      'proteins_100g': 9.1,
      'salt_100g': 2.3,
      'fiber_100g': 3.4,
      // no sodium_100g on purpose — sodium must come from salt conversion upstream
    },
  },
};

test('successful product response parses into a candidate record', () => {
  const r = parseOffResponse(OFF_PRODUCT_JSON);
  assert.equal(r.found, true);
  assert.equal(r.product!.name, '2-Minute Masala Noodles');
  assert.equal(r.product!.brand, 'Maggi', 'first brand kept');
  assert.equal(r.product!.quantity, '70 g');
  assert.equal(r.product!.nutriments['energy-kcal_100g'], 406);
});

test('status 0 (not found) is a soft miss, not an error', () => {
  const r = parseOffResponse({ status: 0 });
  assert.equal(r.found, false);
  assert.equal(r.product, null);
  assert.equal(r.error, null);
});

test('null/invalid payloads never throw and never report found', () => {
  assert.equal(parseOffResponse(null).found, false);
  assert.equal(parseOffResponse({}).found, false);
  assert.equal(parseOffResponse({ status: 1 }).found, false, 'product object required');
});

test('nutriments become database_derived evidence with honest confidence', () => {
  const r = parseOffResponse(OFF_PRODUCT_JSON);
  const ev = offNutritionAsEvidence(r.product!);
  assert.equal(ev['calories'].value, 406);
  assert.equal(ev['calories'].provenance, 'database_derived');
  assert.equal(ev['calories'].sourceLabel, 'Open Food Facts');
  assert.ok(ev['calories'].extractionConfidence < 1, 'database is a candidate, not proof');
  assert.equal(ev['calories'].validation, 'extracted');
  // absent nutrient stays absent — never 0
  assert.equal(ev['sodium'], undefined, 'sodium absent from this product JSON');
});

test('barcodes are URL-encoded into the documented OFF endpoint', () => {
  const url = offUrlForBarcode('8901058000012');
  assert.match(url, /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8901058000012\.json/);
  assert.match(url, /fields=/);
});
