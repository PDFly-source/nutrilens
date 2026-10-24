/**
 * REAL-WORLD PIPELINE VALIDATION (not unit tests).
 *
 * Runs the actual tesseract.js OCR engine over rendered label images and
 * feeds the recognized text through the real v2 parser, then checks routing,
 * values and honesty behaviour. Also exercises the live Open Food Facts API.
 *
 * Run: npx tsx scripts/real-world-validation.mjs
 *
 * HONEST SCOPE: fixtures are synthetic rendered labels (not photos of real
 * packages) and no phone camera is involved. This validates the OCR+parse
 * pipeline end-to-end, not real-world recognition accuracy.
 */
import { createWorker } from 'tesseract.js';
import { readFileSync } from 'node:fs';
import { parseNutritionTable, resolveBasis } from '../features/engine-v2/nutrition-table.ts';
import { resolveProduct } from '../features/engine-v2/product-resolver.ts';
import { combineTableAndLineParsing } from '../features/engine-v2/pipeline.ts';
import { routeMode, countNutritionKeywordHits } from '../features/engine-v2/mode-router.ts';
import { assessQuality } from '../features/engine-v2/image-quality.ts';

let failures = 0;
function approx(actual, expected, tol = 0.15) {
  return actual !== null && actual !== undefined && Math.abs(actual - expected) <= tol;
}

function check(name, cond, detail = '') {
  const ok = Boolean(cond);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function ocr(path) {
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(path);
  await worker.terminate();
  return data.text || '';
}

console.log('=== 1. Real OCR on rendered Maggi front package ===');
const frontText = await ocr('fixtures/maggi-front.png');
const front = resolveProduct(frontText);
check('brand recognized from real OCR text', front.brand === 'Maggi', `brand="${front.brand}"`);
check('product title extracted (no filename)', /noodle/i.test(front.title || ''), `title="${front.title}"`);
check('flavour split', (front.flavour || '').toLowerCase() === 'masala', `flavour="${front.flavour}"`);
check('net weight 70 g from OCR', front.netWeightG === 70, `weight=${front.netWeightG}`);

console.log('\n=== 2. Real OCR on rendered Maggi two-column back label ===');
const backText = await ocr('fixtures/maggi-back.png');
const { nutrition, table } = combineTableAndLineParsing(backText);
check('nutrition table layout detected', table.detected, `bases=${JSON.stringify(table.bases)}`);
check('basis = per_100g column', nutrition.basis === 'per_100g');
// OCR frequently misreads decimal points at label scale ("4.1 g" -> "4.19").
// Checks use a 0.15 tolerance — exact-match claims would be dishonest here.
check('calories 406 kcal (per-100g column)', approx(nutrition.calories, 406), `got ${nutrition.calories}`);
check('protein 9.1 g', approx(nutrition.protein, 9.1), `got ${nutrition.protein}`);
check('total carbs 60.2 g', approx(nutrition.totalCarbs, 60.2), `got ${nutrition.totalCarbs}`);
check('sodium 910 mg preserved in mg', approx(nutrition.sodium, 910, 1), `got ${nutrition.sodium}`);
check('added sugars ~2.2 g', approx(nutrition.addedSugars, 2.2), `got ${nutrition.addedSugars}`);
check('fibre ~3.4 g', approx(nutrition.dietaryFiber, 3.4), `got ${nutrition.dietaryFiber}`);
check('sugars ~4.1 g', approx(nutrition.totalSugars, 4.1), `got ${nutrition.totalSugars}`);
check(
  'per-serving column NOT confused into per-100g (406 != 122)',
  nutrition.calories !== 122
);

console.log('\n=== 3. Blurry label: quality gate + honest failure ===');
const blurryText = await ocr('fixtures/blurry-label.png');
const blurryQuality = (() => {
  // grayscale assessment of the fixture is computed in python; here we check
  // the OCR-level behaviour: blurred labels must not produce a confident table.
  const t = parseNutritionTable(blurryText);
  return t;
})();
check('blurred label does NOT yield a confident two-column table', blurryQuality.detected === false,
  `detected=${blurryQuality.detected}`);

console.log('\n=== 4. No-text food photo → AMBIGUOUS routing (never a guess) ===');
const noText = await ocr('fixtures/no-text-food.png');
const hasSignal = (noText.match(/[A-Za-z]{2,}/g) || []).join(' ').length;
const decision = routeMode({
  barcodeDetected: false,
  ocrTextChars: hasSignal,
  nutritionKeywordHits: countNutritionKeywordHits(noText),
  ingredientsMarkerFound: false,
  userChoice: null,
  visionClass: null,
});
check('food-like image with no text routes to ambiguous', decision.route === 'ambiguous',
  `route=${decision.route}, chars=${hasSignal}`);

console.log('\n=== 5. LIVE Open Food Facts API (real network call) ===');
try {
  const res = await fetch('https://world.openfoodfacts.org/api/v2/product/3017620422003.json?fields=product_name,brands,nutriments');
  check('OFF API reachable', res.ok, `HTTP ${res.status}`);
  const json = await res.json();
  check('OFF returns a real product for a real barcode',
    json?.status === 1 && Boolean(json?.product?.product_name),
    `product="${json?.product?.product_name}"`);
  const kcal = json?.product?.nutriments?.['energy-kcal_100g'];
  check('OFF nutriments carry per-100g energy', typeof kcal === 'number', `kcal/100g=${kcal}`);
} catch (err) {
  check('OFF API reachable', false, String(err));
}

console.log('\n=== 6. LIVE OFF lookup with a REAL Maggi India barcode ===');
try {
  const res = await fetch('https://world.openfoodfacts.org/api/v2/product/8901058000306.json?fields=product_name,brands,nutriments');
  const json = await res.json();
  const kcal = json?.product?.nutriments?.['energy-kcal_100g'];
  check('real Maggi masala noodles found on OFF', json?.status === 1, `name="${json?.product?.product_name}"`);
  check('real per-100g energy available', typeof kcal === 'number', `kcal/100g=${kcal}`);
} catch (err) {
  check('real Maggi lookup', false, String(err));
}

console.log(`\n=== RESULT: ${failures === 0 ? 'ALL PIPELINE CHECKS PASSED' : failures + ' CHECKS FAILED'} ===`);
process.exit(failures === 0 ? 0 : 1);
