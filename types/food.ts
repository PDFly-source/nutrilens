export type ScanMode = 'barcode' | 'nutrition' | 'ingredients' | 'product';

export type ImageType =
  | 'front_package'
  | 'back_package'
  | 'nutrition_label'
  | 'ingredients_label'
  | 'barcode'
  | 'full_package'
  | 'multi_panel'
  | 'unusable';

export type NutritionValueStatus =
  | 'detected'
  | 'verified'
  | 'manual'
  | 'unknown'
  | 'unreadable'
  | 'conflict';

export interface NutritionFieldMeta {
  value: number | null;
  status: NutritionValueStatus;
  confidence: number;
  sourceLabel?: string;
  unit: string;
}

export interface NutritionData {
  servingSize: string | null;
  servingsPerContainer: number | null;
  calories: number | null; // kcal
  totalFat: number | null; // g
  saturatedFat: number | null; // g
  transFat: number | null; // g
  cholesterol: number | null; // mg
  sodium: number | null; // mg
  totalCarbs: number | null; // g
  dietaryFiber: number | null; // g
  totalSugars: number | null; // g
  addedSugars: number | null; // g
  protein: number | null; // g
  vitaminD?: number | null; // mcg
  calcium?: number | null; // mg
  iron?: number | null; // mg
  potassium?: number | null; // mg
  salt?: number | null; // g (common on UK/EU/Indian labels)
  energyKj?: number | null; // kJ
  basis?: 'per_serving' | 'per_100g' | 'per_package' | null;
}

export type IngredientCategory =
  | 'whole-food'
  | 'sweetener'
  | 'preservative'
  | 'emulsifier'
  | 'color'
  | 'flavor'
  | 'stabilizer'
  | 'acidity-regulator'
  | 'additive';

export type ConcernLevel = 'low' | 'moderate' | 'attention';

export interface IngredientItem {
  id: string;
  name: string;
  normalizedName: string;
  category: IngredientCategory;
  role: string;
  description: string;
  concernLevel: ConcernLevel;
  rationale: string;
  allergenDetected?: string;
  isUltraProcessedIndicator?: boolean;
  confidence?: number;
}

export interface ScoreBreakdownItem {
  factor: string;
  points: number;
  rationale: string;
  type: 'positive' | 'attention';
}

export interface RadarMetric {
  value: number;
  max: number;
  label: string;
  level: 'low' | 'moderate' | 'high';
}

export interface MarketingClaimEvaluation {
  claim: string;
  status: 'verified' | 'unsupported' | 'caution';
  explanation: string;
}

export interface SwapCriterion {
  label: string;
  threshold: string;
  reason: string;
}

export interface SessionPreferences {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  nutFree: boolean;
  lowSugar: boolean;
  lowerSodium: boolean;
  higherProtein: boolean;
  higherFiber: boolean;
  noArtificialColors: boolean;
  customAvoid: string[];
}

export interface PreferenceCheckResult {
  preference: string;
  matched: boolean;
  conflicts: string[];
  rationale?: string;
}

export interface ScanImageItem {
  id: string;
  dataUrl: string;
  file?: File;
  name: string;
  label: string;
  imageType?: ImageType;
  width?: number;
  height?: number;
  fileSize?: number;
}

export interface ProductAnalysis {
  id: string;
  timestamp: string;
  scanMode: ScanMode;
  imageType?: ImageType;
  productName: string;
  brand?: string | null;
  productVariant?: string | null;
  packageSize?: string | null;
  barcode?: string;
  nutrition: NutritionData;
  rawIngredientsText: string;
  ingredients: IngredientItem[];
  allergens: string[];
  scores: {
    overall: number;
    nutrition: number;
    ingredients: number;
    processing: number;
    breakdown: ScoreBreakdownItem[];
    isScoreAvailable?: boolean;
    unavailableReason?: string;
  };
  processingLevel: {
    level: 1 | 2 | 3 | 4;
    label: string;
    novaEstimate: string;
    description: string;
    indicators: string[];
  };
  radar: {
    addedSugar: RadarMetric;
    sodium: RadarMetric;
    saturatedFat: RadarMetric;
    processingIndicators: RadarMetric;
    additives: RadarMetric;
  };
  marketingClaims: MarketingClaimEvaluation[];
  swapCriteria: SwapCriterion[];
  imagePreviewUrl?: string;
  images?: ScanImageItem[];
  nutritionConfidence?: 'high' | 'medium' | 'low' | 'none';
  detectionNotes?: string;
  hasVerifiedNutritionData?: boolean;
  hasVerifiedIngredientsData?: boolean;
}
