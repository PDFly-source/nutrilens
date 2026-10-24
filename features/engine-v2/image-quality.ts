/**
 * Image quality assessment (v2).
 *
 * Pure functions operate on grayscale pixel arrays so they are unit-testable
 * in Node without a canvas; the browser wrapper converts ImageData once.
 *
 * Sharpness: normalized Laplacian variance. Low variance under a blur kernel
 * reliably separates sharp label photos from blurred ones.
 */

import { ImageQualityReport } from './types';

/**
 * Compute Laplacian variance of a grayscale image.
 * pixels: Uint8Array of luma values, width*height, row-major.
 */
export function laplacianVariance(
  pixels: Uint8Array,
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) return 0;
  const w = width;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * w + x;
      const lap =
        4 * pixels[i] -
        pixels[i - 1] -
        pixels[i + 1] -
        pixels[i - w] -
        pixels[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Mean brightness 0..255. */
export function meanBrightness(pixels: Uint8Array): number {
  if (pixels.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < pixels.length; i++) s += pixels[i];
  return s / pixels.length;
}

/** Share of pixels near white (glare proxy). */
export function glareRatio(pixels: Uint8Array): number {
  if (pixels.length === 0) return 0;
  let hot = 0;
  for (let i = 0; i < pixels.length; i++) if (pixels[i] >= 246) hot++;
  return hot / pixels.length;
}

/**
 * Convert a raw Laplacian variance into a 0..100 sharpness score.
 * Empirically, label photos with variance > ~400 read well; < ~60 is
 * usually too blurred for OCR. Clamp and scale.
 */
export function sharpnessScoreFromVariance(variance: number): number {
  // sqrt scaling: variance is heavy-tailed.
  const score = Math.sqrt(Math.max(0, variance)) / 2; // var 400 -> 10 ->... see clamp
  return Math.round(Math.min(100, Math.max(0, (score / 10) * 100 * 0.4 + (variance >= 400 ? 60 : 0))));
}

/**
 * Full quality report from a grayscale luma array.
 */
export function assessQuality(
  pixels: Uint8Array,
  width: number,
  height: number
): ImageQualityReport {
  const variance = laplacianVariance(pixels, width, height);
  const brightness = meanBrightness(pixels);
  const glare = glareRatio(pixels);

  // Normalize sharpness to 0..100 (variance 0..2500 clamped).
  const sharpnessScore = Math.round(
    Math.min(100, (Math.sqrt(variance) / 5) * 10)
  ); // sqrt(2500)=50 -> 100

  const brightnessScore = Math.round(
    Math.min(100, Math.max(0, 100 - Math.abs(brightness - 128) / 1.28))
  );

  let verdict: ImageQualityReport['verdict'] = 'poor';
  let advice: string | null = null;
  if (sharpnessScore >= 55 && brightnessScore >= 35 && glare < 0.3) {
    verdict = 'good';
  } else if (sharpnessScore >= 30 && brightnessScore >= 20 && glare < 0.45) {
    verdict = 'usable';
    advice =
      sharpnessScore < 55
        ? 'Photo looks slightly blurred — hold the camera steady and closer to the label for better results.'
        : brightness < 70
          ? 'Photo looks dark — more light will improve text reading.'
          : 'Lighting looks uneven — avoid direct glare on the label.';
  } else {
    advice =
      'This photo is too blurred or poorly lit to read reliably. Retake it: hold still, keep the label in frame and in good light.';
  }

  return { sharpnessScore, brightnessScore, glareRatio: glare, verdict, advice };
}

/**
 * Browser helper: downscale an image/canvas to a small grayscale array and
 * assess quality. Pure DOM wrapper, no Node dependency.
 */
export async function assessImageQualityBrowser(
  source: HTMLCanvasElement | HTMLImageElement | Blob
): Promise<ImageQualityReport> {
  const W = 160;
  const canvas = document.createElement('canvas');
  let img: HTMLImageElement | HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    img = source;
  } else if (source instanceof HTMLImageElement) {
    img = source;
  } else {
    const url = URL.createObjectURL(source as Blob);
    const i = new Image();
    await new Promise((res, rej) => {
      i.onload = res;
      i.onerror = rej;
      i.src = url;
    });
    img = i;
    URL.revokeObjectURL(url);
  }
  const sw =
    (img instanceof HTMLImageElement ? img.naturalWidth || img.width : img.width) || 300;
  const sh =
    (img instanceof HTMLImageElement ? img.naturalHeight || img.height : img.height) || 300;
  const scale = W / Math.max(sw, sh);
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    // Cannot assess without a canvas context — assume usable and let OCR decide.
    return {
      sharpnessScore: 50,
      brightnessScore: 50,
      glareRatio: 0,
      verdict: 'usable',
      advice: null,
    };
  }
  ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    gray[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return assessQuality(gray, canvas.width, canvas.height);
}
