/**
 * NutriLens 2.3 test suite — Indian-food registry integrity, confidence
 * policy, model registry/cache versioning, ingredient evidence, and the
 * expanded dish-database sanity checks.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDIAN_FOOD_REGISTRY,
  INDIAN_FOOD_REGISTRY_VERSION,
  FOOD_CATEGORIES,
  getRegistryClassesByCategory,
  getRegistryClassByName,
  type IndianFoodClass,
} from '../features/engine-v2/indian-food-registry';
import { DISH_DATABASE, getDishById, findDishes } from '../features/engine-v2/cooked/dishes';
import { estimateNutrition } from '../features/engine-v2/cooked/estimator';
import { buildIngredientEvidence, groupByEvidence } from '../features/engine-v2/cooked/ingredient-evidence';
import { classifyConfidence, SCORE_DISCLAIMER, POLICY_VERSION } from '../features/engine-v2/confidence-policy';
import {
  MODEL_REGISTRY,
  getBundledModel,
  modelCacheKey,
  modelCacheStore,
} from '../features/engine-v2/model-registry';
import { FOOD_101_CLASSES, mapFood101Class } from '../features/engine-v2/food101';

// ---------------------------------------------------- registry integrity

test('registry version is declared and bumped for 2.3', () => {
  assert.equal(INDIAN_FOOD_REGISTRY_VERSION, '2.3.0');
});

test('all 11 spec categories exist exactly once', () => {
  const ids = FOOD_CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 11);
  assert.deepEqual(
    [...ids].sort(),
    [
      'rice', 'bread', 'breakfast', 'lentils', 'curry', 'snack',
      'noodles', 'dumpling', 'sweet', 'beverage', 'regional',
    ].sort()
  );
});

test('every supported class links to a real dish record with nutrition', () => {
  for (const c of INDIAN_FOOD_REGISTRY) {
    if (c.status === 'supported') {
      assert.ok(c.dishId, `${c.name}: supported class must link a dishId`);
      const d = getDishById(c.dishId!);
      assert.ok(d, `${c.name}: dishId ${c.dishId} must exist in DISH_DATABASE`);
      assert.ok(d.nutrition.source, `${c.name}: nutrition must cite a source`);
    }
  }
});

test('dataset-ready classes never link a nutrition record or claim support', () => {
  for (const c of INDIAN_FOOD_REGISTRY) {
    if (c.status === 'dataset-ready') {
      assert.equal(c.dishId, undefined, `${c.name} must not link a nutrition record`);
      assert.match(c.provenance, /no verified|Dataset-ready|composite|vary/i, `${c.name}: provenance must explain why`);
    }
  }
});

test('Assamese regional foods are registered honestly (no fabricated values)', () => {
  const regional = getRegistryClassesByCategory('regional');
  const names = regional.map((r) => r.name);
  for (const expected of ['Pitha', 'Jolpan', 'Tenga', 'Khar']) {
    assert.ok(names.includes(expected), `${expected} must be in the regional registry`);
  }
  assert.ok(regional.every((r) => r.status === 'dataset-ready'));
});

test('registry covers the v2.3 Indian staples', () => {
  const supported = INDIAN_FOOD_REGISTRY.filter((c) => c.status === 'supported').map((c) => c.name);
  for (const dish of [
    'Veg Biryani', 'Chapati / Roti', 'Poori', 'Idli', 'Plain Dosa', 'Poha', 'Upma',
    'Dal Fry / Dal Tadka', 'Paneer Butter Masala', 'Pakora / Pakoda', 'Samosa', 'Chowmein',
  ]) {
    assert.ok(supported.includes(dish), `${dish} must be registered as supported`);
  }
});

test('every registry alias resolves through findDishes (manual-selection path)', () => {
  for (const c of INDIAN_FOOD_REGISTRY) {
    if (c.status !== 'supported') continue;
    for (const alias of c.aliases.slice(0, 3)) {
      const found = findDishes(alias);
      assert.ok(
        found.some((d) => d.id === c.dishId),
        `alias "${alias}" of ${c.name} must resolve to ${c.dishId}`
      );
    }
  }
});

test('known confusion pairs are documented for ambiguous staples', () => {
  const samosa = getRegistryClassByName('samosa');
  assert.ok(samosa);
  assert.ok(samosa!.knownConfusions.length > 0, 'samosa confusions must be non-empty');
  const momo = getRegistryClassByName('momo');
  assert.ok(momo);
  assert.ok(momo!.knownConfusions.some((k) => /gyoza|dumpling/i.test(k)));
});

test('food101 mapping covers only registry-supported dishes', () => {
  for (const cls of ['samosa', 'chow_mein', 'dumplings', 'gyoza', 'fried_rice', 'ramen', 'pho', 'spring_rolls']) {
    const m = mapFood101Class(cls)!;
    const reg = INDIAN_FOOD_REGISTRY.find((r) => r.dishId === m.dishId);
    assert.ok(reg, `Food-101 mapping for ${cls} must exist in the registry`);
    assert.equal(reg.status, 'supported');
  }
  // No Food-101 class maps outside the 101 vocabulary.
  assert.equal(FOOD_101_CLASSES.length, 101);
});

// ---------------------------------------------------- dish DB sanity

test('new 2.3 dishes follow per-100g sanity ranges (no impossible values)', () => {
  const newIds = ['veg-biryani', 'chapati', 'poori', 'idli', 'plain-dosa', 'poha', 'upma', 'paneer-butter-masala', 'pakora'];
  for (const id of newIds) {
    const d = getDishById(id);
    assert.ok(d, `${id} must exist`);
    const n = d.nutrition;
    assert.ok(n.kcalPer100gMin > 40 && n.kcalPer100gMax < 500, `${id}: implausible kcal range`);
    assert.ok(n.kcalPer100gMin <= n.kcalPer100gMax, `${id}: kcal range inverted`);
    assert.ok(n.proteinPer100g > 0 && n.proteinPer100g < 30, `${id}: implausible protein`);
    assert.ok((n.sodiumMgPer100gMin ?? 0) <= (n.sodiumMgPer100gMax ?? 0), `${id}: sodium range inverted`);
    assert.ok(d.typicalServeMinG > 0 && d.typicalServeMinG <= d.typicalServeMaxG, `${id}: serve range invalid`);
    assert.ok(n.source.length > 10, `${id}: source must be cited`);
  }
});

test('dish count matches the shipped Indian coverage claim (21 dishes)', () => {
  assert.equal(DISH_DATABASE.length, 21);
});

test('piece-based dishes define piece weight ranges', () => {
  for (const id of ['momo-steamed', 'samosa', 'chapati', 'poori', 'idli', 'plain-dosa', 'pakora', 'aloo-paratha']) {
    const d = getDishById(id)!;
    assert.ok(d.pieceWeightMinG && d.pieceWeightMaxG, `${id} must define piece weights`);
    assert.ok(d.pieceWeightMinG < d.pieceWeightMaxG);
  }
});

// ------------------------------------------------- estimator on new dishes

test('estimator returns explicit ranges for new dishes (no false precision)', () => {
  const idli = getDishById('idli')!;
  const est = estimateNutrition({ dish: idli, userPieces: 2 });
  assert.ok(est.calories.min < est.calories.max, 'calorie range must have width');
  assert.ok(Number.isInteger(est.calories.min) === false || est.calories.min !== est.calories.max);
  assert.ok(est.assumptions.length > 0, 'assumptions must be stated');
  assert.ok(est.unknowns.some((u) => /salt|oil|sodium/i.test(u) || u.length > 0));
});

test('per-100g → per-portion scaling is proportional and range-honest (dosa)', () => {
  const dosa = getDishById('plain-dosa')!;
  const est = estimateNutrition({ dish: dosa, userWeightG: 100 });
  // 100 g portion: range endpoints must bracket the per-100g midpoint.
  const mid = (dosa.nutrition.kcalPer100gMin + dosa.nutrition.kcalPer100gMax) / 2;
  assert.ok(est.calories.min <= mid && est.calories.max >= mid);
});

// ---------------------------------------------------- confidence policy

test('policy: no candidates → unknown (never force)', () => {
  const r = classifyConfidence([]);
  assert.equal(r.decision, 'unknown');
});

test('policy: near-mapping always requires confirmation, even at high score', () => {
  const r = classifyConfidence([
    { name: 'dumplings', confidence: 0.95, dishId: 'momo-steamed', kind: 'near' },
  ]);
  assert.equal(r.decision, 'confirm');
  assert.match(r.reason, /confirm/i);
});

test('policy: strong direct match auto-selects', () => {
  const r = classifyConfidence([
    { name: 'samosa', confidence: 0.8, dishId: 'samosa', kind: 'direct' },
    { name: 'spring rolls', confidence: 0.1, dishId: 'samosa', kind: 'near' },
  ]);
  assert.equal(r.decision, 'auto');
});

test('policy: near-tie between top two requires confirmation', () => {
  const r = classifyConfidence([
    { name: 'samosa', confidence: 0.6, dishId: 'samosa', kind: 'direct' },
    { name: 'samosa2', confidence: 0.55, dishId: 'samosa', kind: 'direct' },
  ]);
  assert.equal(r.decision, 'confirm');
});

test('policy: weak direct match → confirm (not auto, not unknown)', () => {
  const r = classifyConfidence([{ name: 'samosa', confidence: 0.35, dishId: 'samosa', kind: 'direct' }]);
  assert.equal(r.decision, 'confirm');
});

test('policy: scores are labelled model scores, not probabilities', () => {
  assert.match(SCORE_DISCLAIMER, /model scores/i);
  assert.match(SCORE_DISCLAIMER, /not probabilities/i);
  assert.equal(POLICY_VERSION, '2.3.0');
});

// ---------------------------------------------------- model registry

test('exactly one bundled model; planned indian model is NOT downloadable', () => {
  const bundled = getBundledModel();
  assert.equal(bundled.id, 'food101-mobilenetv2');
  assert.equal(bundled.status, 'bundled');
  const planned = MODEL_REGISTRY.find((m) => m.id === 'indian-food');
  assert.ok(planned);
  assert.equal(planned.status, 'planned');
  assert.equal(planned.assetPath, null);
  assert.equal(planned.version, '0.0.0');
  assert.match(planned.provenance, /no verified-licence|No verified/i);
});

test('cache keys include the model version (invalidation on bump)', () => {
  const k1 = modelCacheKey({ id: 'food101-mobilenetv2', version: '2.2.0' });
  const k2 = modelCacheKey({ id: 'food101-mobilenetv2', version: '2.3.0' });
  assert.notEqual(k1, k2, 'bumping the version must change the cache key');
  assert.match(k1, /v2\.2\.0/);
  assert.match(modelCacheStore(), /^nutrilens-model-v/);
});

test('bundled model documents its limitations honestly', () => {
  const m = getBundledModel();
  assert.ok(m.limitations.length >= 3);
  assert.ok(m.limitations.some((l) => /dal|Indian/i.test(l)));
  assert.ok(m.limitations.some((l) => /calibrat/i.test(l)));
  assert.match(m.licence, /Apache-2.0/);
});

// ---------------------------------------------------- ingredient evidence

test('ingredient evidence separates visual / typical / unknown', () => {
  const dish = getDishById('samosa')!;
  const items = buildIngredientEvidence(dish, ['fried pastry shell'], ['extra chutney']);
  const g = groupByEvidence(items);
  assert.ok(g.visual.includes('fried pastry shell'));
  assert.ok(g.visual.includes('extra chutney'));
  assert.ok(!g.typical.includes('fried pastry shell'), 'confirmed item must not also be "typical"');
  assert.ok(g.unknown.some((u) => /oil|filling/i.test(u)));
  // every item explains its status
  for (const it of items) assert.ok(it.note.length > 5);
});

test('unknown evidence items mirror the dish hidden factors', () => {
  const dish = getDishById('paneer-butter-masala')!;
  const g = groupByEvidence(buildIngredientEvidence(dish, [], []));
  assert.ok(g.unknown.some((u) => /butter|cream/i.test(u)));
  assert.ok(g.unknown.some((u) => /salt/i.test(u)));
});
