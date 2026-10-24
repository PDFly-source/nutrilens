/**
 * Vision provider adapter (v2).
 *
 * Cloud vision inference runs on a SERVER that holds the API key. The client
 * only talks to a configured endpoint URL. When no endpoint is configured
 * (the default on GitHub Pages), `isVisionConfigured()` returns false and
 * every UI surface reports local-mode honestly — no cloud inference is
 * claimed or silently attempted.
 *
 * The reference server implementation is app/api/analyze-image (Gemini),
 * deployable on any Node host (Vercel/Cloud Run/self-host).
 */

export interface VisionAnalysisRequest {
  images: { dataUrl: string; mimeType?: string }[];
  mode: 'packaged' | 'cooked';
}

export interface VisionPackagedResult {
  productName?: string | null;
  brand?: string | null;
  nutrition?: Record<string, number | null>;
  ingredientsText?: string | null;
  imageType?: string | null;
  confidence?: number;
}

export type { CookedVisionResult, DishCandidate } from './vision-mapping';

import type { CookedVisionResult } from './vision-mapping';

export function isVisionConfigured(): boolean {
  if (typeof process === 'undefined') return false;
  return Boolean(process.env.NEXT_PUBLIC_VISION_API_URL);
}

export function visionEndpoint(): string | null {
  const url = process.env.NEXT_PUBLIC_VISION_API_URL;
  if (!url) return null;
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Analyze packaged-food images with the configured vision endpoint.
 * Returns null when not configured; throws on network/server failure so
 * callers can fall back to local OCR with honest messaging.
 */
export async function visionAnalyzePackaged(req: VisionAnalysisRequest): Promise<VisionPackagedResult | null> {
  const endpoint = visionEndpoint();
  if (!endpoint) return null;
  const res = await fetch(`${endpoint}/api/analyze-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Vision endpoint returned HTTP ${res.status}`);
  }
  return (await res.json()) as VisionPackagedResult;
}

/**
 * Analyze a cooked-food photo with the configured vision endpoint.
 * Returns null when not configured.
 */
export async function visionAnalyzeCooked(
  req: VisionAnalysisRequest
): Promise<CookedVisionResult | null> {
  const endpoint = visionEndpoint();
  if (!endpoint) return null;
  const res = await fetch(`${endpoint}/api/analyze-cooked`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Vision endpoint returned HTTP ${res.status}`);
  }
  return (await res.json()) as CookedVisionResult;
}

/** Honest capability description for UI badges. */
export function capabilitySummary(): { cloudVision: boolean; barcodeDatabase: boolean } {
  return {
    // v2.2: cooked-dish recognition now runs ON-DEVICE (onnxruntime-web +
    // self-hosted Food-101 model), so no cloud endpoint is required. This
    // flag now reports the OPTIONAL cloud adapter only.
    cloudVision: isVisionConfigured(),
    // Open Food Facts lookup works directly from the browser on Pages.
    barcodeDatabase: true,
  };
}
