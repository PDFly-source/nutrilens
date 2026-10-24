/**
 * Cooked-food estimator (v2).
 *
 * Computes plausible nutrition RANGES for a cooked dish portion using the
 * curated per-100g table. Everything is explicit about method and
 * uncertainty, and recalculation is pure: same inputs → same outputs
 * (unit-testable, no randomness).
 */

import { DishDefinition, MacroEstimate, PortionEstimate } from '../types';

export interface EstimatorInput {
  dish: DishDefinition;
  /** When the user knows the weight of the portion. */
  userWeightG?: number | null;
  /** When the dish is counted in pieces (momo, samosa, paratha). */
  userPieces?: number | null;
  /** Standard serving fallback when neither weight nor pieces given. */
}

export interface CookedEstimate {
  portion: PortionEstimate;
  calories: MacroEstimate;
  protein: MacroEstimate;
  carbs: MacroEstimate;
  fat: MacroEstimate;
  fiber: MacroEstimate | null;
  sodium: MacroEstimate | null;
  assumptions: string[];
  unknowns: string[];
}

function range(portionG: number, per100g: number, unit: string, spreadPct = 0): MacroEstimate {
  const base = (per100g * portionG) / 100;
  const spread = (base * spreadPct) / 100;
  return {
    min: Math.round((base - spread) * 10) / 10,
    max: Math.round((base + spread) * 10) / 10,
    unit,
  };
}

/**
 * Estimate portion grams from user inputs, with explicit method + uncertainty.
 */
export function estimatePortion(input: EstimatorInput): PortionEstimate {
  const { dish, userWeightG, userPieces } = input;
  if (userWeightG && userWeightG > 0) {
    return {
      grams: Math.round(userWeightG),
      method: 'user_weight',
      uncertainty: 'Weight provided by you — most reliable basis.',
    };
  }
  if (userPieces && userPieces > 0 && dish.pieceWeightMinG && dish.pieceWeightMaxG) {
    const min = dish.pieceWeightMinG * userPieces;
    const max = dish.pieceWeightMaxG * userPieces;
    return {
      grams: Math.round((min + max) / 2),
      method: 'user_pieces',
      uncertainty: `±${Math.round((max - min) / 2)} g (piece sizes vary: ${dish.pieceWeightMinG}–${dish.pieceWeightMaxG} g each)`,
    };
  }
  const mid = Math.round((dish.typicalServeMinG + dish.typicalServeMaxG) / 2);
  return {
    grams: mid,
    method: 'standard_serving',
    uncertainty: `±${Math.round((dish.typicalServeMaxG - dish.typicalServeMinG) / 2)} g (assumed a typical ${dish.typicalServeMinG}–${dish.typicalServeMaxG} g serving — adjust below for accuracy)`,
  };
}

/**
 * Full estimate. Calorie ranges use the table's min..max kcal per 100g,
 * so the range reflects preparation variability, not fake precision.
 */
export function estimateNutrition(input: EstimatorInput): CookedEstimate {
  const { dish } = input;
  const portion = estimatePortion(input);
  const g = portion.grams;

  const calories: MacroEstimate = {
    min: Math.round(((dish.nutrition.kcalPer100gMin * g) / 100) * 10) / 10,
    max: Math.round(((dish.nutrition.kcalPer100gMax * g) / 100) * 10) / 10,
    unit: 'kcal',
  };

  const assumptions: string[] = [
    `Dish identified as ${dish.name}${portion.method === 'standard_serving' ? ' — please confirm' : ''}.`,
    portion.method === 'user_weight'
      ? `Portion weight ${g} g (you provided it).`
      : portion.method === 'user_pieces'
        ? `Portion estimated from ${input.userPieces} piece(s) ≈ ${g} g.`
        : `Portion assumed at a typical serving of ${g} g (uncertain: ${portion.uncertainty}).`,
    `Nutrition values are approximate ${dish.nutrition.source}; home preparations vary.`,
  ];

  const unknowns: string[] = [
    'Hidden ingredients (exact oil, salt and sugar added during cooking) cannot be measured from a photo.',
    'Actual allergens depend on the kitchen — confirm if this matters for you.',
    `Cooking method assumed ${dish.cookingMethod.replace('_', ' ')}; a different method changes fat significantly.`,
    ...dish.typicalHidden.map((h) => `Unknown: ${h}.`),
  ];

  return {
    portion,
    calories,
    protein: range(g, dish.nutrition.proteinPer100g, 'g', 25),
    carbs: range(g, dish.nutrition.carbsPer100g, 'g', 25),
    fat: range(g, dish.nutrition.fatPer100g, 'g', 35),
    fiber: dish.nutrition.fiberPer100g ? range(g, dish.nutrition.fiberPer100g, 'g', 25) : null,
    sodium:
      dish.nutrition.sodiumMgPer100gMin != null && dish.nutrition.sodiumMgPer100gMax != null
        ? {
            min: Math.round((dish.nutrition.sodiumMgPer100gMin * g) / 100),
            max: Math.round((dish.nutrition.sodiumMgPer100gMax * g) / 100),
            unit: 'mg',
          }
        : null,
    assumptions,
    unknowns,
  };
}

/**
 * Mid-point per-basis macros for the report's NutritionData mapping.
 * Returns null for anything without data — never 0.
 */
export function midpointMacros(estimate: CookedEstimate): {
  calories: number | null;
  protein: number | null;
  totalCarbs: number | null;
  totalFat: number | null;
  dietaryFiber: number | null;
  sodium: number | null;
} {
  const mid = (m: MacroEstimate | null) => (m ? Math.round(((m.min + m.max) / 2) * 10) / 10 : null);
  return {
    calories: mid(estimate.calories),
    protein: mid(estimate.protein),
    totalCarbs: mid(estimate.carbs),
    totalFat: mid(estimate.fat),
    dietaryFiber: estimate.fiber ? mid(estimate.fiber) : null,
    sodium: estimate.sodium ? mid(estimate.sodium) : null,
  };
}
