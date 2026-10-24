/**
 * NutriLens Food Intelligence Engine v2 — core types.
 *
 * Every value carries PROVENANCE (where it came from) and a validation
 * status. Confidence of extraction is kept separate from the reliability
 * of the underlying data source.
 */

/** Where a piece of information came from. */
export type Provenance =
  | 'visually_observed' // seen in the image (OCR text, visible ingredients)
  | 'user_provided' // typed or corrected by the user
  | 'database_derived' // from a product/nutrition database (e.g. Open Food Facts, dish table)
  | 'ai_estimated' // model estimate (vision model or portion math)
  | 'unknown'; // no evidence at all — never rendered as 0

/** Validation state of a field. */
export type FieldValidation =
  | 'verified' // confirmed by the user or two consistent sources
  | 'extracted' // machine-extracted, awaiting review
  | 'conflict' // sources disagree — needs user decision
  | 'unavailable'; // unknown / not detected

/** A single evidence-backed field. */
export interface EvidenceField<T = number | string | null> {
  value: T;
  provenance: Provenance;
  validation: FieldValidation;
  /** 0..1 — how confident we are in the EXTRACTION itself. */
  extractionConfidence: number;
  /** Human-readable source, e.g. "OCR back label", "Open Food Facts", "User". */
  sourceLabel: string;
}

/** Per-field evidence map for a packaged-food analysis. */
export type FieldEvidenceMap = Record<string, EvidenceField>;

export type ScanRoute = 'packaged' | 'cooked' | 'ambiguous';

/** Signals collected from the images before deep analysis. */
export interface ModeRouterSignals {
  barcodeDetected: boolean;
  /** Recognized text density (chars of non-garbage OCR text per image). */
  ocrTextChars: number;
  /** Nutrition-table keyword hits in OCR text (energy, protein, per 100g...). */
  nutritionKeywordHits: number;
  /** Ingredient-section marker found. */
  ingredientsMarkerFound: boolean;
  /** Explicit user choice, if any. */
  userChoice: ScanRoute | null;
  /** Vision model classification (when configured), else null. */
  visionClass: 'packaged' | 'cooked' | null;
}

export interface ModeDecision {
  route: ScanRoute;
  reason: string; // human-readable, shown in the UI
  signals: ModeRouterSignals;
}

export interface ImageQualityReport {
  sharpnessScore: number; // 0..100 (Laplacian variance normalized)
  brightnessScore: number; // 0..100
  glareRatio: number; // 0..1 share of near-white pixels
  verdict: 'good' | 'usable' | 'poor';
  advice: string | null;
}

/* ===================== Cooked food ===================== */

export type NutritionSourceKind =
  | 'IFCT 2017 approximations'
  | 'USDA FDC approximations'
  | 'Open Food Facts'
  | 'user_provided'
  | 'vision_estimate';

export interface DishNutritionRange {
  /** kcal per 100 g */
  kcalPer100gMin: number;
  kcalPer100gMax: number;
  /** g per 100 g */
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  sodiumMgPer100gMin?: number;
  sodiumMgPer100gMax?: number;
  /** Reference used for these approximate values. */
  source: string;
}

export interface DishDefinition {
  id: string;
  name: string;
  aliases: string[];
  category: 'dumpling' | 'fried_snack' | 'noodles' | 'rice' | 'curry' | 'baked' | 'snack' | 'beverage' | 'bread' | 'mixed';
  /** Typical piece weights in grams (min..max) when sold/counted per piece. */
  pieceWeightMinG?: number;
  pieceWeightMaxG?: number;
  typicalServeMinG: number;
  typicalServeMaxG: number;
  cookingMethod: 'steamed' | 'fried' | 'deep_fried' | 'boiled' | 'baked' | 'roasted' | 'mixed' | 'unknown';
  /** Ingredients commonly visible / expected — candidates, never asserted. */
  typicalVisible: string[];
  typicalHidden: string[];
  nutrition: DishNutritionRange;
}

export interface PortionEstimate {
  /** Estimated grams of food in the photo/user input. */
  grams: number;
  method: 'user_weight' | 'user_pieces' | 'standard_serving' | 'vision_estimate';
  uncertainty: string; // e.g. "±40 g (standard serving assumption)"
}

export interface MacroEstimate {
  /** Low and high ends of the plausible range for this portion. */
  min: number;
  max: number;
  unit: string;
}

export interface CookedFoodReport {
  dishId: string | null;
  dishName: string; // user-confirmed or best-guess name
  alternatives: string[]; // other plausible dishes when ambiguous
  classificationProvenance: 'user_provided' | 'vision_estimate' | 'unknown';
  classificationConfidence: number; // 0..1
  portion: PortionEstimate;
  calories: MacroEstimate; // kcal
  protein: MacroEstimate; // g
  carbs: MacroEstimate; // g
  fat: MacroEstimate; // g
  fiber?: MacroEstimate; // g
  sodium?: MacroEstimate; // mg
  visibleIngredients: string[]; // visually observed / selected by user
  inferredIngredients: string[]; // typical for the dish, NOT observed
  cookingMethod: string | null;
  /** Explicit assumption list shown to the user. */
  assumptions: string[];
  /** Honest statement of what cannot be known from a photo. */
  unknowns: string[];
  nutritionSource: string;
}

/** Extended analysis kind for ProductAnalysis (backwards compatible). */
export type AnalysisKind = 'packaged' | 'cooked';
