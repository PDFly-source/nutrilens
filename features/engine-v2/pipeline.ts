/**
 * Packaged-food pipeline v2: orchestrates quality, routing, table parsing,
 * product resolution, barcode lookup and evidence assembly.
 *
 * Reused by unified-analyzer's local path so Pages users get the same
 * engine as the server-backed flow.
 */

import { NutritionData } from '@/types/food';
import { assessImageQualityBrowser } from './image-quality';
import { ImageQualityReport } from './types';
import { countNutritionKeywordHits, routeMode } from './mode-router';
import {
  NutritionTable,
  parseNutritionTable,
  resolveBasis,
  BasisResolvedNutrition,
} from './nutrition-table';
import { resolveProduct, ResolvedProduct } from './product-resolver';
import { EvidenceField, FieldEvidenceMap } from './types';
import { field, mergeEvidence, unknownField } from './evidence';
import { parseNutritionText, parseIngredientsText, detectImageTypeFromText, detectMarketingClaimsFromText } from '@/features/ocr/parser';

export interface PackagedSignals {
  quality: ImageQualityReport | null;
  barcode: string | null;
  ocrText: string;
}

/**
 * Combine the v2 table parser with the v1 line parser:
 * table-derived values win (they carry basis + column awareness); line
 * parsing fills only fields the table missed.
 */
export function combineTableAndLineParsing(
  ocrText: string
): {
  nutrition: NutritionData;
  table: NutritionTable;
  lineParsed: NutritionData;
} {
  const table = parseNutritionTable(ocrText);
  const lineParsed = parseNutritionText(ocrText);

  if (!table.detected) {
    return { nutrition: lineParsed, table, lineParsed };
  }

  const resolved: BasisResolvedNutrition = resolveBasis(table);
  const nutrition: NutritionData = { ...lineParsed };

  // Table values override line values ONLY for keys where the table actually
  // printed the nutrient (table parsing is layout-aware, line parsing is not).
  const unitToField = (nutrient: string, v: { value: number; unit: string | null; basis: 'per_100g' | 'per_serving' | 'per_package' }) => {
    if (nutrient === 'calories' && (v.unit === 'kj' || v.unit === 'k j')) return { key: 'energyKj', value: v.value };
    if (nutrient === 'energyKj' && (!v.unit || v.unit !== 'kj')) return null;
    return { key: nutrient, value: v.value };
  };

  for (const [nutrient, v] of Object.entries(resolved.values)) {
    const mapped = unitToField(nutrient, v);
    if (!mapped) continue;
    (nutrition as any)[mapped.key] = mapped.value;
    if (resolved.basis) nutrition.basis = resolved.basis;
  }
  return { nutrition, table, lineParsed };
}

/**
 * Build the evidence map for a packaged analysis from the parsed sources.
 * Extraction confidence from OCR is heuristic (based on presence), and
 * source reliability stays a separate dimension (see evidence.overallReliability).
 */
export function buildPackagedEvidence(params: {
  nutrition: NutritionData;
  productName: string;
  brand: string | null;
  ocrConfidence: number;
  offValues?: Record<string, EvidenceField<number>>;
  offName?: string | null;
  offBrand?: string | null;
}): { evidence: FieldEvidenceMap; conflicts: string[] } {
  const ocrField = (key: string, value: number | null, unit: string) =>
    value === null
      ? unknownField('Not detected in photo')
      : field(value, 'visually_observed', params.ocrConfidence, `OCR (${unit})`);

  const incoming: Record<string, EvidenceField> = {
    productName: field(
      params.productName || null,
      'visually_observed',
      params.ocrConfidence,
      'OCR product title'
    ),
    brand: params.brand
      ? field(params.brand, 'visually_observed', params.ocrConfidence, 'OCR / brand lexicon')
      : unknownField('Brand not recognized'),
    calories: ocrField('calories', params.nutrition.calories, 'kcal'),
    protein: ocrField('protein', params.nutrition.protein, 'g'),
    totalFat: ocrField('totalFat', params.nutrition.totalFat, 'g'),
    saturatedFat: ocrField('saturatedFat', params.nutrition.saturatedFat, 'g'),
    transFat: ocrField('transFat', params.nutrition.transFat, 'g'),
    cholesterol: ocrField('cholesterol', params.nutrition.cholesterol, 'mg'),
    sodium: ocrField('sodium', params.nutrition.sodium, 'mg'),
    totalCarbs: ocrField('totalCarbs', params.nutrition.totalCarbs, 'g'),
    dietaryFiber: ocrField('dietaryFiber', params.nutrition.dietaryFiber, 'g'),
    totalSugars: ocrField('totalSugars', params.nutrition.totalSugars, 'g'),
    addedSugars: ocrField('addedSugars', params.nutrition.addedSugars, 'g'),
  };

  if (params.offValues) {
    for (const [k, v] of Object.entries(params.offValues)) {
      incoming[`off:${k}`] = v;
    }
    incoming['productName:off'] = params.offName
      ? field(params.offName, 'database_derived', 0.7, 'Open Food Facts')
      : unknownField('No OFF match');
    incoming['brand:off'] = params.offBrand
      ? field(params.offBrand, 'database_derived', 0.7, 'Open Food Facts')
      : unknownField('No OFF match');
  }

  const { merged, conflicts } = mergeEvidence({}, incoming);
  return { evidence: merged, conflicts };
}

export { routeMode, countNutritionKeywordHits, resolveProduct, parseNutritionTable, resolveBasis, assessImageQualityBrowser };
export type { ResolvedProduct };
