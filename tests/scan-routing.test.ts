/**
 * NutriLens v2.4.1 routing regression suite.
 *
 * Locked to the forensic-audit failures (Oct 2026): a cooked-food photo
 * (momo) whose vision evidence was weak, or whose model failed to download,
 * silently entered the packaged OCR pipeline, where garbage OCR ("She",
 * "A Naha ai BR RA a ge") opened the packaged form with a "Front Package
 * Detected" banner and empty nutrition fields.
 *
 * These tests reproduce that chain through the SHIPPED parser/resolver/
 * routing modules and assert the honest outcomes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { decideVisionRoute, decidePackagedRoute } from '../features/scanner/scan-routing';
import { resolveProduct } from '../features/engine-v2/product-resolver';
import { detectImageTypeFromText, extractBrandAndName, isPlausibleProductTitle } from '../features/ocr/parser';
import type { DishCandidate } from '../features/engine-v2/vision-mapping';

// The actual tesseract.js output from the momo photo (captured 2026-10-24
// during the forensic audit — the chain that produced the reported bug).
const MOMO_GARBAGE_OCR =
  "A Naha ai BR RA a ge\nEN Bi # RL TG SE\n! ) A 2 = Ne wR : 0,\n& V4 A) 4 at VAL\n" +
  "RE Wr ox py\n1 NER E 4\nbet 3 SEEN o\n5 edd ls\n\u201c5d a BN, wl ro LTRS gs\nYo a & a\n" +
  "OA & \u2014 iv Vf me NN\nVe 2's AR\naf ) a Ce\ng : = + a : \\ r S\nVo A : [A Te\n" +
  "To 4 5 A \u20a7 : a\nKY Re A # (a A \u00a2 & A ) i a\nANI, a a Uri iis";

const candidate = (name: string, confidence: number, dishId?: string): DishCandidate => ({
  name,
  confidence,
  dishId,
  kind: dishId ? 'near' : undefined,
});

// ------------------------------------------------------------- vision routing

test('strong cooked-food evidence routes to the cooked flow', () => {
  const d = decideVisionRoute({
    candidates: [{ name: 'samosa', confidence: 0.62, dishId: 'samosa', kind: 'direct' }],
  });
  assert.equal(d.route, 'cooked');
  if (d.route === 'cooked') assert.equal(d.candidates[0].dishId, 'samosa');
});

test('weak UNMAPPED evidence (nothing in the dish DB) is vision-unknown, never guessed', () => {
  const d = decideVisionRoute({
    candidates: [{ name: 'some unknown dish', confidence: 0.4 }],
  });
  assert.equal(d.route, 'vision-unknown');
});

test('weak NEAR evidence (momo via dumplings ~0.11) routes cooked WITH confirmation', () => {
  // The tested v2.3 policy always sends near-mappings to the confirm screen
  // (NEAR_CONFIRM_ONLY) — the user sees the low score and confirms or picks
  // another dish. It never lands in the packaged pipeline.
  const d = decideVisionRoute({
    candidates: [{ name: 'dumplings', confidence: 0.11, dishId: 'momo-steamed', kind: 'near' }],
  });
  assert.equal(d.route, 'cooked');
});

test('no candidates at all is vision-unknown', () => {
  assert.equal(decideVisionRoute({ candidates: [] }).route, 'vision-unknown');
});

test('mid-confidence evidence the tested policy accepts still routes cooked', () => {
  // From the v2.4 real-image eval: fried_rice 0.95 near — policy accepts.
  const d = decideVisionRoute({
    candidates: [{ name: 'fried rice', confidence: 0.91, dishId: 'plain-rice', kind: 'near' }],
  });
  assert.equal(d.route, 'cooked');
});

// ----------------------------------------------------------- packaged routing

test('auto + real packaging evidence opens the packaged form', () => {
  const d = decidePackagedRoute({ hasPackagingEvidence: true, imageType: 'front_package', routeMode: 'auto' });
  assert.equal(d.route, 'packaged');
});

test('auto + NO packaging evidence is ambiguous, never the packaged form', () => {
  const d = decidePackagedRoute({ hasPackagingEvidence: false, imageType: 'unknown', routeMode: 'auto' });
  assert.equal(d.route, 'ambiguous');
});

test('auto + evidence but unknown image type stays ambiguous (honest)', () => {
  const d = decidePackagedRoute({ hasPackagingEvidence: true, imageType: 'unknown', routeMode: 'auto' });
  assert.equal(d.route, 'ambiguous');
});

test('forced packaged mode honors the explicit user choice even without evidence', () => {
  const d = decidePackagedRoute({ hasPackagingEvidence: false, imageType: 'unknown', routeMode: 'packaged' });
  assert.equal(d.route, 'packaged');
});

// --------------------------------------- the reproduced end-to-end momo chain

test('momo garbage OCR chain: no title, no image type, ambiguous routing', () => {
  // 1. Title extraction rejects the junk (the old code returned
  //    "A Naha ai BR RA a ge" as the product name).
  const resolved = resolveProduct(MOMO_GARBAGE_OCR);
  assert.equal(resolved.title, null, 'garbage OCR must not become a product title');
  assert.equal(resolved.brand, null);
  // 2. Image typing is honest: no brand/type-word/plausible-title evidence
  //    means NOT a front package (old code: 'front_package').
  const imageType = detectImageTypeFromText(MOMO_GARBAGE_OCR);
  assert.equal(imageType, 'unknown', 'incidental text must not imply a package front');
  // 3. Routing: ambiguous — the user chooses; no "Front Package Detected".
  const decision = decidePackagedRoute({
    hasPackagingEvidence: false, // unified-analyzer computes this as false here
    imageType,
    routeMode: 'auto',
  });
  assert.equal(decision.route, 'ambiguous');
});

test('"She" never becomes a product name (the reported bug)', () => {
  assert.equal(extractBrandAndName('She\n').productName, null);
  assert.equal(isPlausibleProductTitle('She'), false);
});

test('multi-line joined junk is rejected after title assembly', () => {
  assert.equal(isPlausibleProductTitle('A Naha ai BR RA a ge'), false);
  // And via the shipped extractor that JOINs adjacent candidate lines:
  const lines = ['bet 3 SEEN o', '5 edd ls', 'LTRS gs'];
  const joined = lines.join('\n');
  assert.equal(extractBrandAndName(joined).productName, null);
});

// ---------------------------------------------- legitimate names still work

test('legitimate short brand names are NOT rejected for being short', () => {
  assert.equal(isPlausibleProductTitle('Maggi'), true, 'lexicon brand');
  assert.equal(extractBrandAndName('MAGGI\n2-Minute Masala Noodles\n70 g').productName,
    '2-Minute Masala Noodles');
});

test('real multi-word Indian product titles survive validation', () => {
  assert.equal(isPlausibleProductTitle("Haldiram's Aloo Bhujia"), true);
  assert.equal(isPlausibleProductTitle('Milk Bikis'), true);
  assert.equal(isPlausibleProductTitle('2-Minute Masala Noodles'), true);
});

test('short generic words do not become product names from weak evidence', () => {
  // Not stopwords, but 3-5 letter words with no brand/type evidence — honest no.
  assert.equal(isPlausibleProductTitle('plate'), false);
  assert.equal(isPlausibleProductTitle('Salt'), false);
  assert.equal(extractBrandAndName('plate\n').productName, null);
});

test('product-type words DO count as plausible evidence (by design)', () => {
  // 'poha' is a PRODUCT_TYPE_WORD — packaged poha mixes exist, so a lone
  // "Poha" on a package front is legitimate evidence, unlike junk.
  assert.equal(isPlausibleProductTitle('Poha'), true);
});

test('nutrition panels still classify as nutrition_label, real fronts as front_package', () => {
  assert.equal(
    detectImageTypeFromText('Nutrition Information\nper 100g: Energy 406 kcal\nProtein 9.2 g'),
    'nutrition_label'
  );
  assert.equal(detectImageTypeFromText('MAGGI\n2-Minute Masala Noodles\n70 g'), 'front_package');
  // ingredients panel
  assert.equal(
    detectImageTypeFromText('Ingredients: Wheat Flour, Palm Oil, Salt\nMay contain traces of milk'),
    'ingredients_label'
  );
});

test('front/back merge behaviour stays intact: full label is multi_panel', () => {
  assert.equal(
    detectImageTypeFromText('MAGGI\nIngredients: Wheat Flour, Palm Oil\nNutrition Facts\nper 100g\nEnergy 406 kcal'),
    'multi_panel'
  );
});

test('resolveProduct still extracts title + flavour from a real front label', () => {
  const r = resolveProduct('MAGGI\n2-Minute Masala Noodles\n70 g');
  assert.equal(r.brand, 'Maggi');
  assert.equal(r.flavour, 'Masala');
  assert.ok(r.netWeightG === 70 || r.netWeightG === null); // weight parsing is separate
  assert.equal(r.title, '2-Minute Noodles');
});
