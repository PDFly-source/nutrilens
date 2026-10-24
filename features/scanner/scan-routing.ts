/**
 * Scan-mode routing decisions (v2.4.1) — pure, testable functions.
 *
 * Root cause this module fixes (forensic audit, Oct 2026): auto-mode scans of
 * COOKED food whose vision evidence was weak — or whose model failed to
 * load — silently fell into the packaged-food OCR pipeline, where garbage
 * OCR ("She") opened the packaged review form with a "Front Package
 * Detected" banner. Missing model evidence was being treated as proof the
 * photo was a package.
 *
 * The rules here are deliberately conservative:
 *  - Cooked route only when the tested confidence policy accepts the vision
 *    candidates.
 *  - Packaged route (auto mode) only when the OCR result carries REAL
 *    packaging evidence (brand / validated title / nutrition / ingredients /
 *    barcode, see unified-analyzer.hasPackagingEvidence).
 *  - Anything else is 'ambiguous': the user chooses. Never guess.
 */

import type { DishCandidate } from '@/features/engine-v2/vision-mapping';
import { classifyConfidence } from '@/features/engine-v2/confidence-policy';
import { getDishById, findDishes } from '@/features/engine-v2/cooked/dishes';

export interface VisionDecisionInput {
  /** Raw candidates from the on-device model (already mapped to dishes). */
  candidates: DishCandidate[];
}

/**
 * Map model candidates to known dishes (same rule ScanHub used inline) and
 * decide whether the vision evidence supports the cooked-food flow.
 */
export function decideVisionRoute(
  input: VisionDecisionInput
): { route: 'cooked'; candidates: DishCandidate[] } | { route: 'vision-unknown' } {
  const matched = input.candidates.filter(
    (c) => (c.dishId ? getDishById(c.dishId) : findDishes(c.name).length > 0)
  );
  const policy = classifyConfidence(matched);
  if (matched.length > 0 && policy.decision !== 'unknown') {
    return { route: 'cooked', candidates: matched };
  }
  return { route: 'vision-unknown' };
}

export interface PackagedDecisionInput {
  /** unified-analyzer result for the photo(s). */
  hasPackagingEvidence: boolean;
  /** OCR-derived image type ('unknown' means no packaging structure). */
  imageType: string;
  /** Explicit user route mode: 'auto' asks questions, forced modes trust the user. */
  routeMode: 'auto' | 'packaged' | 'cooked';
}

/**
 * Decide whether an OCR-passed scan may open the packaged review form.
 * In AUTO mode that requires real packaging evidence. When the user forced
 * 'packaged' we honor their choice — they explicitly said it is a package.
 */
export function decidePackagedRoute(
  input: PackagedDecisionInput
): { route: 'packaged' } | { route: 'ambiguous' } {
  if (input.routeMode !== 'auto') return { route: 'packaged' };
  if (input.hasPackagingEvidence && input.imageType !== 'unknown') {
    return { route: 'packaged' };
  }
  // No packaging evidence: could be cooked food with incidental text, a
  // blurry photo, or junk OCR. Never present the packaged form as fact.
  return { route: 'ambiguous' };
}
