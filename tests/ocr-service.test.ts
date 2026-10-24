/**
 * Regression tests: OCR engine failure handling.
 * Simulates worker/language-data loading failures and verifies the service
 * reports errors honestly and recovers on the next attempt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runLocalOcr,
  initOcrEngine,
  cancelActiveOcrJob,
  __setWorkerFactoryForTests,
} from '../features/ocr/ocr-service';

test('worker load failure is reported as a clear error', async () => {
  __setWorkerFactoryForTests((async () => {
    throw new Error('failed to fetch language data');
  }) as any);

  await assert.rejects(
    runLocalOcr('data:image/png;base64,x'),
    /could not complete|failed/i,
    'a failed worker download must surface a clear error'
  );
  // Reset seam.
  __setWorkerFactoryForTests(undefined);
});

test('engine recovers after a failure (retry is possible)', async () => {
  let calls = 0;
  __setWorkerFactoryForTests((async () => {
    calls += 1;
    if (calls === 1) throw new Error('network down');
    return {
      recognize: async () => ({ data: { text: 'Energy 100 kcal', confidence: 80 } }),
      terminate: async () => {},
    };
  }) as any);

  // First attempt fails...
  await assert.rejects(() => initOcrEngine());
  // ...engine state reset, second attempt succeeds.
  await initOcrEngine();
  const res = await runLocalOcr('data:image/png;base64,x');
  assert.match(res.text, /Energy/);
  assert.equal(res.confidence, 80);

  await cancelActiveOcrJob();
  __setWorkerFactoryForTests(undefined);
});

test('persistent engine is reused without re-initializing', async () => {
  let inits = 0;
  __setWorkerFactoryForTests((async () => {
    inits += 1;
    return {
      recognize: async () => ({ data: { text: 'hello', confidence: 70 } }),
      terminate: async () => {},
    };
  }) as any);

  await initOcrEngine();
  await runLocalOcr('data:image/png;base64,x');
  await runLocalOcr('data:image/png;base64,x');
  assert.equal(inits, 1, 'worker created once, reused across scans');

  await cancelActiveOcrJob();
  __setWorkerFactoryForTests(undefined);
});
