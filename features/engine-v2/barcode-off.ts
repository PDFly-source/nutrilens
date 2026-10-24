/**
 * Barcode → Open Food Facts lookup (v2).
 *
 * Open Food Facts is an open database with a documented public API
 * (https://world.openfoodfacts.org). Client-side fetch is allowed by their
 * terms for reasonable use; we send only the barcode digits, never images.
 *
 * A match is a CANDIDATE source, never proof: values from the database are
 * tagged database_derived and shown alongside (not instead of) OCR/user
 * evidence unless the user accepts them.
 */

import { EvidenceField } from './types';

export interface OFFProduct {
  name: string | null;
  brand: string | null;
  quantity: string | null;
  servingSize: string | null;
  /** Nutriments per 100g, as exported by OFF (keys differ per product). */
  nutriments: Record<string, number>;
  ingredientsText: string | null;
  allergens: string | null;
  imageUrl: string | null;
}

export interface OFFLookupResult {
  found: boolean;
  product: OFFProduct | null;
  error: string | null;
}

export function offUrlForBarcode(barcode: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,quantity,serving_size,nutriments,ingredients_text,allergens,image_front_url`;
}

export function parseOffResponse(json: any): OFFLookupResult {
  if (!json || json.status !== 1 || !json.product) {
    return { found: false, product: null, error: null };
  }
  const p = json.product;
  return {
    found: true,
    error: null,
    product: {
      name: p.product_name || null,
      brand: p.brands ? String(p.brands).split(',')[0].trim() : null,
      quantity: p.quantity || null,
      servingSize: p.serving_size || null,
      nutriments: p.nutriments || {},
      ingredientsText: p.ingredients_text || null,
      allergens: p.allergens || null,
      imageUrl: p.image_front_url || null,
    },
  };
}

/**
 * Lookup a barcode. Uses OFF's timeout-friendly public endpoint.
 * Throws only on network failure; callers treat "not found" as a soft miss.
 */
export async function lookupBarcode(
  barcode: string,
  fetchImpl: typeof fetch = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined as any)
): Promise<OFFLookupResult> {
  try {
    const res = await fetchImpl(offUrlForBarcode(barcode), {
      headers: { 'User-Agent': 'NutriLens/2.0 (open-source food scanner)' },
    });
    if (!res.ok) {
      return { found: false, product: null, error: `OFF HTTP ${res.status}` };
    }
    return parseOffResponse(await res.json());
  } catch (err: any) {
    return { found: false, product: null, error: err?.message || 'network error' };
  }
}

/**
 * Extract per-100g nutriments from an OFF product into our NutritionData-ish
 * map with provenance. Returns empty object when nothing usable exists.
 */
export function offNutritionAsEvidence(product: OFFProduct): Record<string, EvidenceField<number>> {
  const n = product.nutriments || {};
  const map: Record<string, EvidenceField<number>> = {};
  const put = (key: string, value: number | undefined, label: string) => {
    if (typeof value === 'number' && !isNaN(value)) {
      map[key] = {
        value,
        provenance: 'database_derived',
        validation: 'extracted',
        extractionConfidence: 0.7, // database reliability ≠ extraction quality
        sourceLabel: label,
      };
    }
  };
  put('calories', n['energy-kcal_100g'], 'Open Food Facts');
  put('energyKj', n['energy-kj_100g'], 'Open Food Facts');
  put('totalFat', n['fat_100g'], 'Open Food Facts');
  put('saturatedFat', n['saturated-fat_100g'], 'Open Food Facts');
  put('transFat', n['trans-fat_100g'], 'Open Food Facts');
  put('cholesterol', n['cholesterol_100g'], 'Open Food Facts');
  put('sodium', n['sodium_100g'], 'Open Food Facts');
  put('salt', n['salt_100g'], 'Open Food Facts');
  put('totalCarbs', n['carbohydrates_100g'], 'Open Food Facts');
  put('dietaryFiber', n['fiber_100g'], 'Open Food Facts');
  put('totalSugars', n['sugars_100g'], 'Open Food Facts');
  put('addedSugars', n['added-sugars_100g'], 'Open Food Facts');
  put('protein', n['proteins_100g'], 'Open Food Facts');
  return map;
}
