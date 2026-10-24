/**
 * v2.1 regression: vision-model response mapping and ambiguity policy.
 * These are the ONLY places where raw model output becomes app data — every
 * field is sanitized, ranked and honesty-checked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCookedVision, isAmbiguous } from '../features/engine-v2/vision-mapping';

test('ranked candidates are sanitized, de-duplicated and ordered by confidence', () => {
  const r = mapCookedVision({
    candidates: [
      { name: 'Pakora', confidence: 0.3 },
      { name: 'samosa', confidence: 0.8 },
      { name: 'Samosa', confidence: 0.75 },
      { name: 'chowmein', confidence: 0.55 },
      { name: 'fifth-extra', confidence: 0.2 },
    ],
    visibleIngredients: ['fried pastry shell', '  ', 42],
    portionEstimateG: 180,
    note: 'Two pieces visible on a plate.',
  });
  assert.equal(r.candidates.length, 4, 'max 4 candidates kept');
  assert.equal(r.candidates[0].name, 'samosa');
  assert.ok(r.candidates[0].confidence >= r.candidates[1].confidence);
  assert.deepEqual(
    r.candidates.map((c) => c.name),
    ['samosa', 'chowmein', 'pakora', 'fifth-extra'],
    'duplicate name dropped, rest ranked'
  );
  assert.deepEqual(r.visibleIngredients, ['fried pastry shell'], 'junk filtered');
  assert.equal(r.portionEstimateG, 180);
  assert.ok(r.note?.includes('plate'));
});

test('garbage/absent payloads produce empty results, never fabrications', () => {
  assert.deepEqual(mapCookedVision(null).candidates, []);
  assert.deepEqual(mapCookedVision({}).candidates, []);
  assert.deepEqual(mapCookedVision('not json').candidates, []);
  const junk = mapCookedVision({ candidates: [{ name: '12345', confidence: 2 }] });
  assert.equal(junk.candidates.length, 0, 'numeric junk name rejected');
  const over = mapCookedVision({ portionEstimateG: 99999 });
  assert.equal(over.portionEstimateG, null, 'impossible portion rejected');
  const conf = mapCookedVision({ candidates: [{ name: 'rice', confidence: 7 }] });
  assert.equal(conf.candidates[0].confidence, 1, 'confidence clamped to 0..1');
});

test('ambiguity policy: top candidate must be confident AND clearly ahead', () => {
  assert.equal(isAmbiguous([]), true, 'no candidates → ambiguous');
  assert.equal(isAmbiguous([{ name: 'a', confidence: 0.4 }]), true, 'weak top → ambiguous');
  assert.equal(
    isAmbiguous([
      { name: 'a', confidence: 0.9 },
      { name: 'b', confidence: 0.85 },
    ]),
    true,
    'near-tie → ambiguous, user must confirm'
  );
  assert.equal(
    isAmbiguous([
      { name: 'a', confidence: 0.9 },
      { name: 'b', confidence: 0.4 },
    ]),
    false,
    'clear winner → auto-apply allowed'
  );
  assert.equal(isAmbiguous([{ name: 'a', confidence: 0.7 }]), false);
});
