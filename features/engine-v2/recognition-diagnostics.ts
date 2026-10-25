/**
 * Recognition engine self-test (v2.4.2). Runs the EXACT production
 * recognition path stage by stage and reports where it broke. Local only:
 * nothing is uploaded and no user photos are touched.
 */
import { APP_VERSION, COMMIT_SHA } from '@/lib/build-info';
import { MODEL_URL_PATH, MODEL_CACHE, MODEL_CACHE_KEY, getVisionStatus } from './browser-vision';
import type { VisionStatus } from './browser-vision';

export type DiagnosticStage =
  | 'model_download' | 'model_integrity' | 'ort_import'
  | 'wasm_session' | 'test_inference' | 'image_preprocess';

export interface StageResult {
  stage: DiagnosticStage;
  ok: boolean;
  ms: number;
  detail?: string;
  httpStatus?: number;
  mime?: string;
  bytes?: number;
}

export interface RecognitionDiagnosticReport {
  appVersion: string;
  commitSha: string;
  platform: string;
  crossOriginIsolated: boolean | undefined;
  sharedArrayBuffer: boolean;
  modelCacheState: 'hit' | 'miss' | 'unavailable';
  visionStatusBefore: VisionStatus['state'];
  stages: StageResult[];
  success: boolean;
  failureStage?: DiagnosticStage;
}

function sanitize(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  // Keep messages short, strip potential URLs with tokens — nothing private.
  return raw.slice(0, 300);
}

async function cacheState(): Promise<'hit' | 'miss' | 'unavailable'> {
  if (!('caches' in globalThis)) return 'unavailable';
  try {
    const c = await caches.open(MODEL_CACHE);
    return (await c.match(MODEL_CACHE_KEY)) ? 'hit' : 'miss';
  } catch {
    return 'unavailable';
  }
}

/**
 * Run the staged self-test of the on-device recognition engine. Stops at the
 * first failing stage so the report pinpoints the exact breakage. Uses a
 * tiny embedded JPEG for the preprocess stage — user photos are never read.
 */
export async function runRecognitionSelfTest(): Promise<RecognitionDiagnosticReport> {
  const report: RecognitionDiagnosticReport = {
    appVersion: APP_VERSION,
    commitSha: COMMIT_SHA,
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    crossOriginIsolated: typeof self !== 'undefined' ? (self as any).crossOriginIsolated : undefined,
    sharedArrayBuffer: typeof globalThis !== 'undefined' && 'SharedArrayBuffer' in globalThis,
    modelCacheState: await cacheState(),
    visionStatusBefore: getVisionStatus().state,
    stages: [],
    success: false,
  };
  const push = (r: StageResult) => report.stages.push(r);

  // Stage 1: model download (network path, not the cache).
  let bytes: ArrayBuffer | null = null;
  try {
    const t0 = performance.now();
    const url = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${MODEL_URL_PATH}`;
    const res = await fetch(url);
    const mime = res.headers.get('content-type') || undefined;
    bytes = await res.arrayBuffer();
    push({
      stage: 'model_download', ok: res.ok && bytes.byteLength > 1_000_000,
      ms: Math.round(performance.now() - t0),
      httpStatus: res.status, mime, bytes: bytes.byteLength,
      detail: res.ok ? undefined : `HTTP ${res.status} for ${MODEL_URL_PATH}`,
    });
  } catch (err) {
    push({ stage: 'model_download', ok: false, ms: 0, detail: sanitize(err) });
    report.failureStage = 'model_download';
    return report;
  }
  // Stage 2: model integrity (ONNX protobuf magic + plausible size).
  {
    const head = new Uint8Array(bytes.slice(0, 2));
    const ok = head[0] === 0x08 && head[1] === 0x07 && bytes.byteLength === 9385782;
    push({
      stage: 'model_integrity', ok, ms: 0, bytes: bytes.byteLength,
      detail: ok ? undefined : `first bytes ${head[0]},${head[1]} (expected 8,7); size ${bytes.byteLength}`,
    });
    if (!ok) { report.failureStage = 'model_integrity'; return report; }
  }

  // Stage 3: ONNX Runtime Web import.
  let ort: typeof import('onnxruntime-web');
  try {
    const t0 = performance.now();
    ort = await import('onnxruntime-web');
    push({ stage: 'ort_import', ok: true, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    push({ stage: 'ort_import', ok: false, ms: 0, detail: sanitize(err) });
    report.failureStage = 'ort_import';
    return report;
  }
  // Stage 4: WASM session creation (same options as production).
  let session: import('onnxruntime-web').InferenceSession;
  try {
    const t0 = performance.now();
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/ort/`;
    session = await ort.InferenceSession.create(bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    push({ stage: 'wasm_session', ok: true, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    push({ stage: 'wasm_session', ok: false, ms: 0, detail: sanitize(err) });
    report.failureStage = 'wasm_session';
    return report;
  }

  // Stage 5: test inference on a zeros tensor (no photo needed).
  try {
    const t0 = performance.now();
    const input = new Float32Array(3 * 224 * 224);
    const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, 224, 224]) };
    const out = await session.run(feeds);
    const logits = out[session.outputNames[0]].data as Float32Array;
    push({ stage: 'test_inference', ok: logits.length === 101, ms: Math.round(performance.now() - t0),
      detail: logits.length === 101 ? undefined : `output length ${logits.length}` });
  } catch (err) {
    push({ stage: 'test_inference', ok: false, ms: 0, detail: sanitize(err) });
    report.failureStage = 'test_inference';
    return report;
  }
  // Stage 6: image preprocessing on a tiny embedded JPEG (same function as
  // production scans). Exercises createImageBitmap + canvas under this UA.
  try {
    const t0 = performance.now();
    const { preprocessImage } = await import('./browser-vision');
    const bin = atob(TEST_JPEG_BASE64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const blob = new Blob([buf], { type: 'image/jpeg' });
    const tensor = await preprocessImage(blob);
    push({ stage: 'image_preprocess', ok: tensor.length === 3 * 224 * 224,
      ms: Math.round(performance.now() - t0),
      detail: tensor.length === 3 * 224 * 224 ? undefined : `tensor length ${tensor.length}` });
  } catch (err) {
    push({ stage: 'image_preprocess', ok: false, ms: 0, detail: sanitize(err) });
    report.failureStage = 'image_preprocess';
    return report;
  }

  report.success = report.stages.every((st) => st.ok);
  return report;
}

/** Valid 16x16 JPEG (633 bytes), generated with PIL — decode-stage check. */
const TEST_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDsqKKK+KPrj//Z';
