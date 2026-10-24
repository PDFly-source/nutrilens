/**
 * Mode router (v2): decides packaged / cooked / ambiguous from real signals.
 * Never forces a classification it does not have evidence for.
 */

import { ModeDecision, ModeRouterSignals, ScanRoute } from './types';

const NUTRITION_KEYWORDS = [
  'nutrition',
  'energy',
  'kcal',
  'protein',
  'carbohydrate',
  'per 100g',
  'per 100 g',
  'per serving',
  'servings per',
  'total fat',
  'sodium',
  'sugars',
];

export function countNutritionKeywordHits(ocrText: string): number {
  const lower = (ocrText || '').toLowerCase();
  return NUTRITION_KEYWORDS.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
}

export function routeMode(signals: ModeRouterSignals): ModeDecision {
  // 1. Explicit user choice always wins — it is user-provided evidence.
  if (signals.userChoice === 'cooked' || signals.userChoice === 'packaged') {
    return {
      route: signals.userChoice,
      reason:
        signals.userChoice === 'cooked'
          ? 'Cooked-food mode selected by you.'
          : 'Packaged-food mode selected by you.',
      signals,
    };
  }

  // 2. Vision model classification (only when a provider is configured).
  if (signals.visionClass) {
    return {
      route: signals.visionClass,
      reason: `Image classified as ${signals.visionClass} food by the configured vision model.`,
      signals,
    };
  }

  // 3. Barcode → packaged food.
  if (signals.barcodeDetected) {
    return {
      route: 'packaged',
      reason: 'A product barcode was detected — analysing as packaged food.',
      signals,
    };
  }

  // 4. Printed label text → packaged food.
  const hasLabelEvidence =
    (signals.ocrTextChars >= 60 && signals.nutritionKeywordHits >= 2) ||
    signals.ingredientsMarkerFound;
  if (hasLabelEvidence) {
    return {
      route: 'packaged',
      reason: 'Package text (nutrition table / ingredients) was recognized — analysing as packaged food.',
      signals,
    };
  }

  // 5. Some text but weak label evidence → still packaged-lean, but flag it.
  if (signals.ocrTextChars >= 60) {
    return {
      route: 'packaged',
      reason:
        'Some printed text was recognized. If this is a cooked dish, switch to Cooked-food mode below.',
      signals,
    };
  }

  // 6. Nothing conclusive → ambiguous. Ask the user; never guess.
  return {
    route: 'ambiguous',
    reason:
      'No barcode or readable package text was found, so the image type is unclear. Choose a mode or retake the photo.',
    signals,
  };
}
