/**
 * Evidence-based merge helpers for multi-photo scan sessions.
 *
 * Rules (Phase 4 of the scanner fix):
 *  - Merge only fields supported by actual evidence.
 *  - Never overwrite a previously detected value with an empty/unknown one.
 *  - Conflicting readings from different photos are flagged for manual
 *    review rather than silently resolved.
 */

import { NutritionData } from '@/types/food';

export const NUTRITION_NUMERIC_FIELDS = [
  'calories',
  'totalFat',
  'saturatedFat',
  'transFat',
  'cholesterol',
  'sodium',
  'totalCarbs',
  'dietaryFiber',
  'totalSugars',
  'addedSugars',
  'protein',
  'salt',
  'energyKj',
  'servingsPerContainer',
  'vitaminD',
  'calcium',
  'iron',
  'potassium',
] as const;

export interface NutritionMergeResult {
  merged: NutritionData;
  conflicts: string[];
}

/**
 * Merge an incoming nutrition extraction into an existing one.
 * Existing non-null values win; incoming values fill only unknown fields;
 * conflicting non-null values are reported and the existing value is kept
 * (the user resolves conflicts on the review screen).
 */
export function mergeNutritionData(
  existing: NutritionData,
  incoming: NutritionData
): NutritionMergeResult {
  const merged: NutritionData = { ...existing };
  const conflicts: string[] = [];

  for (const field of NUTRITION_NUMERIC_FIELDS) {
    const existingValue = existing[field];
    const incomingValue = incoming[field];
    if (incomingValue === null || incomingValue === undefined) continue; // no evidence
    if (existingValue === null || existingValue === undefined) {
      (merged as any)[field] = incomingValue;
    } else if (existingValue !== incomingValue) {
      conflicts.push(field);
    }
  }

  // Serving size (string)
  if (incoming.servingSize) {
    if (!existing.servingSize) {
      merged.servingSize = incoming.servingSize;
    } else if (incoming.servingSize.trim().toLowerCase() !== existing.servingSize.trim().toLowerCase()) {
      conflicts.push('servingSize');
    }
  }

  // Basis
  if (incoming.basis && !existing.basis) {
    merged.basis = incoming.basis;
  }

  return { merged, conflicts };
}

/**
 * Human-readable labels for flagged conflicting fields.
 */
export function describeConflicts(conflicts: string[]): string[] {
  const labels: Record<string, string> = {
    calories: 'Calories',
    totalFat: 'Total fat',
    saturatedFat: 'Saturated fat',
    transFat: 'Trans fat',
    cholesterol: 'Cholesterol',
    sodium: 'Sodium',
    totalCarbs: 'Total carbohydrates',
    dietaryFiber: 'Dietary fiber',
    totalSugars: 'Total sugars',
    addedSugars: 'Added sugars',
    protein: 'Protein',
    salt: 'Salt',
    energyKj: 'Energy (kJ)',
    servingsPerContainer: 'Servings per container',
    servingSize: 'Serving size',
    vitaminD: 'Vitamin D',
    calcium: 'Calcium',
    iron: 'Iron',
    potassium: 'Potassium',
  };
  return conflicts.map((c) => labels[c] || c);
}

/**
 * Merge scalar review fields: existing non-empty values win, incoming fills
 * only blank ones. Used when an additional photo is analyzed.
 */
export function mergeReviewFields<T extends string | null>(
  existing: T,
  incoming: T
): T {
  if (existing && String(existing).trim().length > 0) return existing;
  return incoming;
}
