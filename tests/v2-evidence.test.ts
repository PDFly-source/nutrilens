/**
 * v2 regression: evidence store — provenance, conflicts, unknown handling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeEvidence,
  mergeField,
  applyUserEdit,
  field,
  unknownField,
  overallReliability,
} from '../features/engine-v2/evidence';

const ocr = (v: number | null) =>
  v === null ? unknownField('Not detected') : field(v, 'visually_observed', 0.8, 'OCR');
const db = (v: number) => field(v, 'database_derived', 0.7, 'Open Food Facts');
const user = (v: number) => field(v, 'user_provided', 1, 'edited by you');

test('unknown stays unknown — never zero', () => {
  const { merged } = mergeEvidence({}, { calories: ocr(null) });
  assert.equal(merged.calories.value, null);
  assert.equal(merged.calories.validation, 'unavailable');
  assert.equal(merged.calories.provenance, 'unknown');
});

test('empty incoming evidence never erases real evidence', () => {
  const { merged, conflicts } = mergeEvidence({}, { calories: ocr(406) });
  const again = mergeEvidence(merged, { calories: ocr(null) });
  assert.equal(again.merged.calories.value, 406);
  assert.deepEqual(again.conflicts, []);
});

test('equal values from two sources verify each other', () => {
  const { merged } = mergeEvidence({}, { calories: ocr(406) });
  const r = mergeEvidence(merged, { calories: db(406) });
  assert.equal(r.merged.calories.value, 406);
  assert.equal(r.merged.calories.validation, 'verified');
});

test('OCR value + conflicting database value → conflict flag, no silent overwrite', () => {
  const { merged } = mergeEvidence({}, { calories: ocr(406) });
  const r = mergeEvidence(merged, { calories: db(355) });
  assert.equal(r.merged.calories.value, 406, 'higher-priority source kept');
  assert.equal(r.merged.calories.validation, 'conflict');
  assert.deepEqual(r.conflicts, ['calories']);
});

test('user edits always win and mark verified', () => {
  const { merged } = mergeEvidence({}, { calories: ocr(406) });
  const edited = applyUserEdit(merged, 'calories', 350);
  const r = mergeEvidence(edited, { calories: db(999) });
  assert.equal(r.merged.calories.value, 350);
  assert.equal(r.merged.calories.provenance, 'user_provided');
  assert.equal(r.merged.calories.validation, 'verified');
  assert.deepEqual(r.conflicts, [], 'user evidence does not produce conflicts');
});

test('mergeField handles fresh keys and non-numeric strings', () => {
  const r = mergeField(undefined, field('Maggi', 'visually_observed', 0.9, 'OCR'));
  assert.equal(r.merged.value, 'Maggi');
  assert.equal(r.conflict, false);
});

test('extraction confidence is separate from source reliability', () => {
  // High OCR confidence on a database-weak source must not inflate either.
  const ocrHigh = field(100, 'visually_observed', 0.95, 'OCR');
  const dbHigh = field(100, 'database_derived', 0.95, 'Open Food Facts');
  const rel = (f: typeof ocrHigh) => overallReliability(f);
  assert.equal(rel(ocrHigh).extraction, 0.95);
  assert.equal(rel(ocrHigh).source, 0.8);
  assert.equal(rel(dbHigh).source, 0.7, 'database reliability does not equal observation');
});
