/**
 * v2.4.2 regression tests: typed engine-init errors, self-test stages,
 * and error classification. Node test env cannot run real WASM, so the
 * self-test's failure modes are asserted through the retry seam.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineInitError, __setSessionForTests, getVisionStatus, loadVisionModel } from '../features/engine-v2/browser-vision';
import { runRecognitionSelfTest } from '../features/engine-v2/recognition-diagnostics';
import { APP_VERSION, COMMIT_SHA } from '../lib/build-info';

test('EngineInitError carries the failing init stage (import vs session)', () => {
  const e = new EngineInitError('session', 'WASM failed');
  assert.equal(e.stage, 'session');
  assert.equal(e.name, 'EngineInitError');
  assert.match(e.message, /WASM failed/);
});

test('loadVisionModel retries after a failed load (failure is not cached)', async () => {
  __setSessionForTests(Promise.reject(new EngineInitError('import', 'import failed once')));
  await assert.rejects(loadVisionModel(), (err: unknown) => err instanceof EngineInitError);
  assert.equal(getVisionStatus().state, 'error');
  // The next call must attempt a FRESH load, not replay the cached failure.
  __setSessionForTests(Promise.resolve({ run: async () => new Float32Array(101) }));
  const sess = await loadVisionModel();
  assert.ok(sess, 'retry after failure succeeds');
  assert.equal(getVisionStatus().state, 'ready');
  __setSessionForTests(null);
});

test('self-test report always identifies build version + commit', async () => {
  const report = await runRecognitionSelfTest();
  assert.equal(report.appVersion, APP_VERSION);
  assert.equal(report.commitSha, COMMIT_SHA);
  assert.ok(Array.isArray(report.stages), 'stages array present');
  // In Node the model download stage fails fast (no network fetch of the
  // Pages URL in this env is guaranteed) — either way the report must record
  // the FIRST failing stage honestly and stop there.
  if (!report.success) {
    assert.ok(report.failureStage, 'failure stage identified');
    const failed = report.stages.find((s) => !s.ok);
    assert.ok(failed, 'a failed stage entry exists with detail');
    assert.ok(failed!.detail === undefined || failed!.detail.length <= 300, 'sanitized error');
  }
});

test('self-test stages are ordered engine-first, never skipping a stage on success', async () => {
  const report = await runRecognitionSelfTest();
  const order = ['model_download', 'model_integrity', 'ort_import', 'wasm_session', 'test_inference', 'image_preprocess'];
  const ran = report.stages.map((s) => s.stage);
  // stages stop at first failure; everything before it must be in order
  assert.deepEqual(ran, order.slice(0, ran.length));
});
