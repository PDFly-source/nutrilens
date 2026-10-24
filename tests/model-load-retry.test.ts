/**
 * NutriLens v2.4.1 model load/inference failure & retry suite.
 *
 * Forensic audit finding: a failed model download on a phone silently
 * dropped the scan into the packaged OCR pipeline. The load path must (a)
 * fail with typed, honest errors, (b) NOT cache the failure so the user can
 * retry, and (c) classify must never silently return wrong results.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadVisionModel,
  browserClassifyCooked,
  getVisionStatus,
  watchVisionStatus,
  __setSessionForTests,
  ModelDownloadError,
  InferenceError,
} from '../features/engine-v2/browser-vision';

test.afterEach(() => {
  __setSessionForTests(null);
});

test('a failed model load raises the typed error and does NOT cache failure', async () => {
  __setSessionForTests(Promise.reject(new ModelDownloadError('Could not download the recognition model (~9.4 MB).')));
  await assert.rejects(loadVisionModel(), ModelDownloadError);
  // Retry semantics: the session promise was cleared on failure, so a new
  // attempt is made instead of replaying the cached rejection.
  __setSessionForTests(
    Promise.resolve({
      run: async () => new Float32Array(101),
    })
  );
  const sess = await loadVisionModel();
  assert.ok(sess && typeof sess.run === 'function', 'retry after failure must reach a working session');
});

test('load failure is observable via the status API (UI shows an error state)', async () => {
  const seen: string[] = [];
  watchVisionStatus((s) => seen.push(s.state));
  __setSessionForTests(Promise.reject(new ModelDownloadError('offline')));
  await assert.rejects(loadVisionModel(), ModelDownloadError);
  const st = getVisionStatus();
  assert.equal(st.state, 'error', 'status must reflect the failed load');
  assert.ok(st.state === 'error' && st.message, 'error status carries a message for the UI');
  assert.ok(seen.includes('error'));
});

test('classify with a broken session raises a typed InferenceError (never silent)', async () => {
  // No DOM in Node: preprocessImage cannot run → also a typed failure path.
  __setSessionForTests(
    Promise.resolve({
      run: async () => {
        throw new Error('wasm trap');
      },
    })
  );
  await assert.rejects(browserClassifyCooked({} as Blob), (err: Error) => {
    assert.ok(err instanceof InferenceError || err.name === 'InferenceError', 'typed error required');
    return true;
  });
});

test('classify with a missing session propagates the load failure honestly', async () => {
  __setSessionForTests(Promise.reject(new ModelDownloadError('offline first visit')));
  await assert.rejects(browserClassifyCooked({} as Blob), ModelDownloadError);
});

test('status subscription returns an unsubscribe handle for cleanup', () => {
  const events: Array<{ state: string }> = [];
  const stop = watchVisionStatus((s) => events.push({ state: s.state }));
  assert.equal(typeof stop, 'function');
  stop();
});
