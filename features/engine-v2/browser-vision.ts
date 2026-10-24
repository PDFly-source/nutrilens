/**
 * Browser-side cooked-food recognition (v2.2) — NO API keys, NO cloud.
 *
 * A MobileNetV2 image classifier fine-tuned on Food-101 (see
 * docs/food101-model.md) runs fully in the user's browser through
 * onnxruntime-web (WebAssembly). The ONNX weights are self-hosted next to
 * the app and cached, so after the first visit recognition also works
 * offline.
 *
 * Honest scope:
 *  - The model outputs Food-101 class scores. Those scores are model
 *    confidence, NOT measurement of calories or portion.
 *  - It cannot list ingredients, estimate portion weight, or reveal hidden
 *    oil/salt. We never fabricate those: visibleIngredients is always empty
 *    and portionEstimateG is always null from this provider.
 *  - Food-101 has no classes for most Indian staples (dal, rajma, idli,
 *    dosa, curry). Those photos will produce low-confidence foreign
 *    guesses; the UI must handle "no confident match" by asking the user.
 *
 * All heavy work is lazy: the onnxruntime-web bundle, the WASM runtime and
 * the 9.4 MB model are only fetched when the user actually classifies a
 * cooked-food photo (or explicitly pre-downloads from Settings).
 */

import type { CookedVisionResult, DishCandidate } from './vision-mapping';
import { FOOD_101_CLASSES, mapFood101Class, humanizeFood101 } from './food101';

export const MODEL_URL_PATH = '/models/food101-mobilenetv2.onnx';
export const MODEL_CACHE = 'nutrilens-model-v1';
export const MODEL_CACHE_KEY = 'food101-mobilenetv2.onnx';
export const MODEL_BYTES_APPROX = 9.4 * 1024 * 1024;

export type VisionStatus =
  | { state: 'idle' }
  | { state: 'downloading'; received: number; total: number | null }
  | { state: 'preparing' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

let status: VisionStatus = { state: 'idle' };
let sessionPromise: Promise<VisionSession> | null = null;
const listeners = new Set<(s: VisionStatus) => void>();

function setStatus(s: VisionStatus): void {
  status = s;
  for (const l of listeners) {
    try {
      l(s);
    } catch {
      /* listener errors are not fatal */
    }
  }
}

export function getVisionStatus(): VisionStatus {
  return status;
}

/** Subscribe to model lifecycle changes (download progress etc.). */
export function watchVisionStatus(cb: (s: VisionStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export class ModelDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelDownloadError';
  }
}
export class ImageDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageDecodeError';
  }
}
export class InferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InferenceError';
  }
}

interface VisionSession {
  run(input: Float32Array): Promise<Float32Array>;
}

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/** Fetch with progress + Cache API fallback for offline reuse. */
async function fetchModelBytes(onStatus: (s: VisionStatus) => void): Promise<ArrayBuffer> {
  const url = `${basePath()}${MODEL_URL_PATH}`;
  // 1. Offline path: reuse a previously downloaded copy.
  if ('caches' in globalThis) {
    try {
      const cache = await caches.open(MODEL_CACHE);
      const hit = await cache.match(MODEL_CACHE_KEY);
      if (hit) return await hit.arrayBuffer();
    } catch {
      /* cache unavailable — fall through to network */
    }
  }
  // 2. Network with progress.
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = res.body ? Number(res.headers.get('content-length')) : null;
    if (!res.body || !total) {
      onStatus({ state: 'downloading', received: 0, total: null });
      const buf = await res.arrayBuffer();
      onStatus({ state: 'downloading', received: buf.byteLength, total: buf.byteLength });
      return buf;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onStatus({ state: 'downloading', received, total });
    }
    const out = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    // 3. Cache for offline use (best effort).
    if ('caches' in globalThis) {
      try {
        const cache = await caches.open(MODEL_CACHE);
        await cache.put(MODEL_CACHE_KEY, new Response(out, { headers: { 'content-type': 'application/octet-stream' } }));
      } catch {
        /* non-fatal */
      }
    }
    return out.buffer;
  } catch (err) {
    throw new ModelDownloadError(
      `Could not download the recognition model (~9.4 MB). You appear to be offline or the network dropped. ${
        err instanceof Error ? err.message : ''
      }`
    );
  }
}

/** Lazy singleton: fetch runtime + model once, reuse for every photo. */
export function loadVisionModel(): Promise<VisionSession> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async (): Promise<VisionSession> => {
    try {
      setStatus({ state: 'downloading', received: 0, total: null });
      const bytes = await fetchModelBytes((s) => {
        setStatus(s);
      });
      setStatus({ state: 'preparing' });
      // Dynamic import keeps the ORT glue OUT of the main bundle.
      const ort = await import('onnxruntime-web');
      ort.env.wasm.numThreads = 1; // no cross-origin isolation on GitHub Pages
      ort.env.wasm.wasmPaths = `${basePath()}/ort/`;
      const sess = await ort.InferenceSession.create(bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      setStatus({ state: 'ready' });
      const inputName = sess.inputNames[0];
      const outputName = sess.outputNames[0];
      return {
        run: async (input: Float32Array) => {
          const feeds = { [inputName]: new ort.Tensor('float32', input, [1, 3, 224, 224]) };
          const out = await sess.run(feeds);
          return out[outputName].data as Float32Array;
        },
      };
    } catch (err) {
      setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
      sessionPromise = null; // allow retry
      throw err;
    }
  })();
  return sessionPromise;
}

/**
 * Pure math: softmax over logits (max-subtracted for stability). Exported for
 * tests.
 */
export function softmax(logits: ArrayLike<number>): number[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  const exps: number[] = [];
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max);
    exps.push(e);
    sum += e;
  }
  return exps.map((e) => e / sum);
}

/**
 * Image -> [1,3,224,224] float tensor, matching the model's training
 * preprocessing (torchvision): Resize(256 longest side), CenterCrop(224),
 * ImageNet mean/std normalization. Runs on a canvas so nothing blocks the
 * main thread for long; the crop keeps memory bounded.
 */
export async function preprocessImage(source: Blob | ImageBitmap): Promise<Float32Array> {
  let bitmap: ImageBitmap;
  try {
    bitmap = source instanceof Blob ? await createImageBitmap(source) : source;
  } catch {
    throw new ImageDecodeError(
      'Could not decode the image. Supported formats: JPG, PNG, WebP, GIF and BMP photos from camera or gallery.'
    );
  }
  const { width: w, height: h } = bitmap;
  const scale = 256 / Math.max(w, h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new InferenceError('Canvas unavailable on this device.');
  // Draw the 256-side image off-screen, then center-crop 224 from it.
  const tmp = document.createElement('canvas');
  tmp.width = nw;
  tmp.height = nh;
  const tctx = tmp.getContext('2d');
  if (!tctx) throw new InferenceError('Canvas unavailable on this device.');
  tctx.drawImage(bitmap, 0, 0, nw, nh);
  const left = Math.floor((nw - 224) / 2);
  const top = Math.floor((nh - 224) / 2);
  ctx.drawImage(tmp, left, top, 224, 224, 0, 0, 224, 224);
  if (bitmap !== source) bitmap.close();
  return imageDataToTensor(ctx.getImageData(0, 0, 224, 224));
}

/** Pure function (testable): RGBA pixel data -> normalized CHW float tensor. */
export function imageDataToTensor(data: { data: Uint8ClampedArray }): Float32Array {
  const MEAN = [0.485, 0.456, 0.406];
  const STD = [0.229, 0.224, 0.225];
  const n = 224 * 224;
  const out = new Float32Array(3 * n);
  const px = data.data;
  for (let i = 0; i < n; i++) {
    out[i] = (px[i * 4] / 255 - MEAN[0]) / STD[0];
    out[n + i] = (px[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    out[2 * n + i] = (px[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }
  return out;
}

export interface BrowserClassifyOptions {
  /** Return raw (unmapped) top classes too, so the UI can be honest about them. */
  topK?: number;
}

/**
 * Pure mapping (testable without a browser): softmax probabilities ->
 * ranked NutriLens dish candidates through the curated Food-101 mapping.
 * Different classes that map to the SAME dish (dumplings + gyoza -> momo)
 * collapse into the strongest one; nothing is ever invented.
 */
export function buildDishCandidates(
  probs: ArrayLike<number>,
  topK = 5
): { candidates: DishCandidate[]; topClass: string; topConfidence: number } {
  const n = probs.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => probs[b] - probs[a]);
  const top = order.slice(0, Math.min(Math.max(topK, 1), 8));
  const candidates: DishCandidate[] = [];
  for (const idx of top) {
    const cls = FOOD_101_CLASSES[idx];
    const mapping = mapFood101Class(cls);
    if (!mapping) continue;
    // Collapse classes that resolve to the same dish (dumplings + gyoza).
    const dup = candidates.find((c) => c.dishId === mapping.dishId);
    if (dup) continue;
    candidates.push({
      name: mapping.observedName,
      dishId: mapping.dishId,
      confidence: probs[idx],
      kind: mapping.kind,
      note: mapping.note,
      rawClass: cls,
    });
  }
  return {
    candidates,
    topClass: FOOD_101_CLASSES[top[0]],
    topConfidence: probs[top[0]],
  };
}

/**
 * Classify a cooked-food photo with the on-device model and map Food-101
 * predictions into the same ranked-candidate contract the cloud adapter
 * used (vision-mapping), reusing its sanitization + ambiguity rules.
 */
export async function browserClassifyCooked(
  image: Blob,
  opts: BrowserClassifyOptions = {}
): Promise<CookedVisionResult> {
  const sess = await loadVisionModel();
  let logits: Float32Array;
  try {
    const tensor = await preprocessImage(image);
    logits = await sess.run(tensor);
  } catch (err) {
    if (err instanceof ImageDecodeError) throw err;
    throw new InferenceError(
      `On-device recognition failed on this photo. ${err instanceof Error ? err.message : ''}`
    );
  }
  const probs = softmax(logits);
  const { candidates, topClass, topConfidence } = buildDishCandidates(probs, opts.topK ?? 5);
  const note = candidates.length
    ? null
    : topConfidence > 0.25
      ? `The on-device model saw "${humanizeFood101(topClass)}" — we do not have that dish in our database yet. Pick the closest dish or enter it manually.`
      : 'The on-device model could not confidently recognize a cooked dish in this photo. If this is cooked food, pick the dish below; if it is a packaged product, use the packaged scan.';
  return {
    candidates,
    visibleIngredients: [], // the model cannot see through a dish — never claim ingredients
    portionEstimateG: null, // and it cannot weigh a portion either
    note,
  };
}

/**
 * Debug/test seam: inject a fake session so failure paths are unit-testable
 * without a real browser runtime.
 */
export function __setSessionForTests(p: Promise<VisionSession> | null): void {
  sessionPromise = p;
}
