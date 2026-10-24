/**
 * In-Browser Local OCR Service via Tesseract.js
 * 
 * Runs 100% locally in the browser with WebAssembly / Web Workers.
 * No image bytes or scan telemetry ever leave the user's device.
 */

import { createWorker } from 'tesseract.js';

export interface OcrProgressCallback {
  (status: string, progress: number): void;
}

export interface OcrRunResult {
  text: string;
  confidence: number;
}

let activeWorker: any = null;

export async function runLocalOcr(
  imageSource: string | HTMLCanvasElement | Blob | File,
  onProgress?: OcrProgressCallback
): Promise<OcrRunResult> {
  try {
    if (onProgress) onProgress('Initializing local OCR engine...', 0.1);

    // Initialize or reuse Tesseract worker
    const worker = await createWorker('eng');
    activeWorker = worker;

    if (onProgress) onProgress('Analyzing image text...', 0.4);

    const ret = await worker.recognize(imageSource);

    if (onProgress) onProgress('Extracting label data...', 0.9);

    const text = ret.data.text || '';
    const confidence = ret.data.confidence || 0;

    await worker.terminate();
    activeWorker = null;

    if (onProgress) onProgress('Done', 1.0);

    return {
      text,
      confidence,
    };
  } catch (err: any) {
    if (activeWorker) {
      try {
        await activeWorker.terminate();
      } catch (_) {}
      activeWorker = null;
    }
    console.warn('Local OCR encountered an issue, defaulting to manual review:', err);
    throw new Error(err?.message || 'Local OCR recognition could not complete.');
  }
}

export function cancelActiveOcrJob(): void {
  if (activeWorker) {
    try {
      activeWorker.terminate();
    } catch (_) {}
    activeWorker = null;
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
