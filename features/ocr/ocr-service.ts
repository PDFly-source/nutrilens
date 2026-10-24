/**
 * In-Browser Local OCR Service via Tesseract.js
 *
 * Runs 100% locally in the browser with WebAssembly / Web Workers.
 * No image bytes or scan telemetry ever leave the user's device.
 *
 * The Tesseract worker (wasm core + eng.traineddata language data) is fetched
 * once from the public CDN and then REUSED across scans. The first
 * initialization may take several seconds on slow connections; callers must
 * allow generous time for it (the analyzer uses a 90s ceiling, not 7s).
 */

import { createWorker, createScheduler, PSM } from 'tesseract.js';

export interface OcrProgressCallback {
  (status: string, progress: number): void;
}

export interface OcrRunResult {
  text: string;
  confidence: number;
}

let scheduler: any = null;
let schedulerInitPromise: Promise<any> | null = null;
let warmProgress: OcrProgressCallback | null = null;

// Worker factory (swappable in unit tests to simulate engine failures).
let workerFactory: typeof createWorker = createWorker;

/** Test-only seam: inject a fake worker factory (undefined restores real). */
export function __setWorkerFactoryForTests(factory?: typeof createWorker): void {
  workerFactory = typeof factory === 'function' ? factory : createWorker;
  scheduler = null;
  schedulerInitPromise = null;
}

/**
 * Initialize (or reuse) a persistent Tesseract worker pool.
 * Safe to call concurrently; initialization happens once.
 */
export async function initOcrEngine(
  onProgress?: OcrProgressCallback
): Promise<void> {
  if (onProgress) warmProgress = onProgress;

  if (scheduler) {
    // Reuse the already-initialized engine.
    if (onProgress) onProgress('Local OCR engine ready', 1);
    return;
  }

  if (!schedulerInitPromise) {
    schedulerInitPromise = (async () => {
      const log = (m: any) => {
        const status = String(m?.status || 'loading');
        const progress = typeof m?.progress === 'number' ? m.progress : 0;
        if (warmProgress) {
          warmProgress(
            `Local OCR engine: ${status.replace(/_/g, ' ')}...`,
            Math.max(0.02, Math.min(0.98, progress || 0.5))
          );
        }
      };

      const worker = await workerFactory('eng', 1, { logger: log, errorHandler: (e: unknown) => {
        console.warn('[NutriLens OCR] engine warning:', e);
      }});
      scheduler = worker; // single persistent worker; scheduler reserved for future scaling
      return worker;
    })();
  }

  try {
    await schedulerInitPromise;
  } catch (err) {
    // Reset so a later scan can retry initialization instead of failing forever.
    schedulerInitPromise = null;
    scheduler = null;
    throw err;
  } finally {
    warmProgress = null;
  }
}

/** Preload the OCR engine during idle time so the first scan is fast. */
export function warmUpOcrEngine(): void {
  if (typeof window === 'undefined' || scheduler || schedulerInitPromise) return;
  try {
    initOcrEngine().catch(() => {
      // Silent: warm-up is best-effort; scans surface real errors.
    });
  } catch {
    // ignore
  }
}

/**
 * Run OCR on an image source (canvas, data URL, blob or file).
 * Uses the persistent worker; the engine is initialized on demand.
 */
export async function runLocalOcr(
  imageSource: string | HTMLCanvasElement | Blob | File,
  onProgress?: OcrProgressCallback
): Promise<OcrRunResult> {
  try {
    if (onProgress) onProgress('Initializing local OCR engine...', 0.05);
    await initOcrEngine(onProgress);
    if (!scheduler) throw new Error('OCR engine failed to initialize');

    if (onProgress) onProgress('Reading text from image...', 0.45);

    // Automatic page segmentation works best for dense package photos.
    const ret = await scheduler.recognize(imageSource, {}, {
      text: true,
    });

    if (onProgress) onProgress('Extracting label data...', 0.9);

    const text = ret?.data?.text || '';
    const confidence = typeof ret?.data?.confidence === 'number' ? ret.data.confidence : 0;

    if (onProgress) onProgress('Done', 1);

    return { text, confidence };
  } catch (err: any) {
    console.warn('Local OCR encountered an issue:', err);
    throw new Error(
      err?.message?.includes('timed out')
        ? err.message
        : `Local OCR recognition could not complete (${err?.message || 'unknown error'}).`
    );
  }
}

/**
 * Terminate the persistent worker (used on cancellation or fatal errors).
 * The next scan will re-initialize automatically.
 */
export async function cancelActiveOcrJob(): Promise<void> {
  const current = scheduler;
  scheduler = null;
  schedulerInitPromise = null;
  if (current) {
    try {
      await current.terminate();
    } catch (_) {
      // ignore
    }
  }
}

export async function detectBarcodeFromImage(
  source: HTMLCanvasElement | ImageBitmap | HTMLImageElement
): Promise<{ rawValue: string; format?: string } | null> {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      });
      const barcodes = await barcodeDetector.detect(source);
      if (barcodes && barcodes.length > 0) {
        return { rawValue: barcodes[0].rawValue, format: barcodes[0].format };
      }
    } catch {
      // Native BarcodeDetector not available or format unsupported
    }
  }
  return null;
}

// Keep PSM referenced for future tuning of page segmentation modes.
void PSM;
