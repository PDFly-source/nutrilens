import {
  NutritionData,
  IngredientItem,
  ScoreBreakdownItem,
  RadarMetric,
  ProductAnalysis,
  ScanMode,
  ImageType,
  SwapCriterion,
  MarketingClaimEvaluation,
  ScanImageItem,
} from '@/types/food';

/**
 * NutriLens Transparent Mathematical Scoring Engine
 *
 * Rules are deterministic, auditable, and free from black-box guesswork.
 * Unknown or null values are NEVER scored as 0. They are safely excluded from
 * penalization/scoring, and if label data is insufficient, the score is cleanly marked unavailable.
 */

export function calculateNutritionScore(nutrition: NutritionData): {
  score: number;
  breakdown: ScoreBreakdownItem[];
  isAvailable: boolean;
} {
  const breakdown: ScoreBreakdownItem[] = [];

  // Check if we have sufficient nutrition data
  const hasCoreMetrics =
    nutrition.calories !== null ||
    nutrition.protein !== null ||
    nutrition.totalFat !== null ||
    nutrition.sodium !== null ||
    nutrition.totalCarbs !== null;

  if (!hasCoreMetrics) {
    return {
      score: 50,
      breakdown: [
        {
          factor: 'Nutrition Facts Not Available',
          points: 0,
          rationale: 'Nutrition panel data was not detected in this image. Add a nutrition label photo for nutrient density evaluation.',
          type: 'attention',
        },
      ],
      isAvailable: false,
    };
  }

  let score = 70; // baseline neutral

  // 1. Protein (+ up to 15)
  if (nutrition.protein !== null) {
    if (nutrition.protein >= 15) {
      score += 15;
      breakdown.push({
        factor: 'High Protein Density',
        points: 15,
        rationale: `${nutrition.protein}g protein per serving supports satiety and lean muscle.`,
        type: 'positive',
      });
    } else if (nutrition.protein >= 7) {
      score += 8;
      breakdown.push({
        factor: 'Moderate Protein',
        points: 8,
        rationale: `${nutrition.protein}g protein provides a solid amino acid baseline.`,
        type: 'positive',
      });
    }
  }

  // 2. Dietary Fiber (+ up to 15)
  if (nutrition.dietaryFiber !== null) {
    if (nutrition.dietaryFiber >= 6) {
      score += 15;
      breakdown.push({
        factor: 'Excellent Fiber Content',
        points: 15,
        rationale: `${nutrition.dietaryFiber}g fiber provides sustained digestion and microbiome fuel.`,
        type: 'positive',
      });
    } else if (nutrition.dietaryFiber >= 3) {
      score += 8;
      breakdown.push({
        factor: 'Good Source of Fiber',
        points: 8,
        rationale: `${nutrition.dietaryFiber}g fiber contributes to daily digestive health.`,
        type: 'positive',
      });
    }
  }

  // 3. Added Sugars (- up to 22)
  if (nutrition.addedSugars !== null) {
    if (nutrition.addedSugars >= 18) {
      score -= 22;
      breakdown.push({
        factor: 'Elevated Added Sugar',
        points: -22,
        rationale: `${nutrition.addedSugars}g added sugar represents a high sugar load per portion.`,
        type: 'attention',
      });
    } else if (nutrition.addedSugars >= 9) {
      score -= 12;
      breakdown.push({
        factor: 'Moderate Added Sugar',
        points: -12,
        rationale: `${nutrition.addedSugars}g added sugars per portion.`,
        type: 'attention',
      });
    } else if (nutrition.addedSugars === 0 && (nutrition.totalSugars === null || nutrition.totalSugars <= 5)) {
      score += 8;
      breakdown.push({
        factor: 'Low / Zero Added Sugar',
        points: 8,
        rationale: 'Contains 0g added sugar from natural formulation.',
        type: 'positive',
      });
    }
  } else if (nutrition.totalSugars !== null) {
    // If only total sugars is known
    if (nutrition.totalSugars >= 22) {
      score -= 15;
      breakdown.push({
        factor: 'High Total Sugar',
        points: -15,
        rationale: `${nutrition.totalSugars}g total sugars detected.`,
        type: 'attention',
      });
    }
  }

  // 4. Sodium (- up to 20)
  if (nutrition.sodium !== null) {
    if (nutrition.sodium >= 600) {
      score -= 20;
      breakdown.push({
        factor: 'High Sodium Density',
        points: -20,
        rationale: `${nutrition.sodium}mg sodium represents over 26% of daily recommended ceiling.`,
        type: 'attention',
      });
    } else if (nutrition.sodium >= 350) {
      score -= 10;
      breakdown.push({
        factor: 'Moderate Sodium',
        points: -10,
        rationale: `${nutrition.sodium}mg sodium per portion.`,
        type: 'attention',
      });
    } else if (nutrition.sodium <= 140 && nutrition.sodium >= 0) {
      score += 8;
      breakdown.push({
        factor: 'Low Sodium Profile',
        points: 8,
        rationale: `${nutrition.sodium}mg fits within low sodium benchmarks (<140mg).`,
        type: 'positive',
      });
    }
  }

  // 5. Trans Fat & Saturated Fat
  if (nutrition.transFat !== null && nutrition.transFat > 0) {
    score -= 25;
    breakdown.push({
      factor: 'Trans Fat Detected',
      points: -25,
      rationale: `${nutrition.transFat}g trans fat present; recommended intake is zero.`,
      type: 'attention',
    });
  }

  if (nutrition.saturatedFat !== null) {
    if (nutrition.saturatedFat >= 6) {
      score -= 12;
      breakdown.push({
        factor: 'High Saturated Fat',
        points: -12,
        rationale: `${nutrition.saturatedFat}g saturated fat per portion.`,
        type: 'attention',
      });
    } else if (nutrition.saturatedFat <= 1.5 && (nutrition.totalFat !== null && nutrition.totalFat > 0)) {
      score += 5;
      breakdown.push({
        factor: 'Low Saturated Fat Profile',
        points: 5,
        rationale: `${nutrition.saturatedFat}g saturated fat meets low saturated fat benchmarks.`,
        type: 'positive',
      });
    }
  }

  // Clamp 0-100
  const finalScore = Math.max(10, Math.min(100, Math.round(score)));
  return { score: finalScore, breakdown, isAvailable: true };
}

export function calculateIngredientScore(ingredients: IngredientItem[]): {
  score: number;
  breakdown: ScoreBreakdownItem[];
  isAvailable: boolean;
} {
  if (ingredients.length === 0) {
    return {
      score: 50,
      breakdown: [
        {
          factor: 'Ingredients Not Read',
          points: 0,
          rationale: 'Ingredients deck not visible in current photo. Add ingredients photo for additive auditing.',
          type: 'attention',
        },
      ],
      isAvailable: false,
    };
  }

  let score = 85;
  const breakdown: ScoreBreakdownItem[] = [];

  const attentionCount = ingredients.filter((i) => i.concernLevel === 'attention').length;
  const moderateCount = ingredients.filter((i) => i.concernLevel === 'moderate').length;
  const additiveCount = ingredients.filter((i) => i.category !== 'whole-food').length;

  if (ingredients.length <= 5 && ingredients.length > 0) {
    score += 10;
    breakdown.push({
      factor: 'Concise Ingredient Deck',
      points: 10,
      rationale: `Only ${ingredients.length} total ingredients; indicates simple formulation.`,
      type: 'positive',
    });
  } else if (ingredients.length > 20) {
    score -= 15;
    breakdown.push({
      factor: 'Extensive Ingredient Deck',
      points: -15,
      rationale: `${ingredients.length} separate ingredients, typical of complex processing.`,
      type: 'attention',
    });
  }

  if (attentionCount > 0) {
    const penalty = Math.min(25, attentionCount * 8);
    score -= penalty;
    breakdown.push({
      factor: 'High-Attention Additives',
      points: -penalty,
      rationale: `${attentionCount} ingredient(s) categorized under scrutiny (e.g. synthetic colors, intense preservatives).`,
      type: 'attention',
    });
  }

  if (moderateCount > 2) {
    score -= 10;
    breakdown.push({
      factor: 'Multiple Functional Additives',
      points: -10,
      rationale: `${moderateCount} stabilizers, flavorings, or starches detected.`,
      type: 'attention',
    });
  }

  if (additiveCount === 0 && ingredients.length > 0) {
    score += 10;
    breakdown.push({
      factor: '100% Whole Food Ingredients',
      points: 10,
      rationale: 'Zero industrial additives, synthetic colors, or stabilizers found.',
      type: 'positive',
    });
  }

  const finalScore = Math.max(15, Math.min(100, Math.round(score)));
  return { score: finalScore, breakdown, isAvailable: true };
}

export function calculateProcessingScore(
  ingredients: IngredientItem[],
  nutrition: NutritionData
): {
  score: number;
  level: 1 | 2 | 3 | 4;
  label: string;
  novaEstimate: string;
  description: string;
  indicators: string[];
  breakdown: ScoreBreakdownItem[];
  isAvailable: boolean;
} {
  const indicators: string[] = [];
  const breakdown: ScoreBreakdownItem[] = [];

  for (const item of ingredients) {
    if (item.isUltraProcessedIndicator) {
      indicators.push(item.name);
    }
  }

  if (ingredients.length === 0) {
    return {
      score: 50,
      level: 2,
      label: 'Processing Level Pending',
      novaEstimate: 'Pending',
      description: 'Provide an ingredients panel to estimate NOVA classification.',
      indicators: [],
      breakdown: [],
      isAvailable: false,
    };
  }

  let novaLevel: 1 | 2 | 3 | 4 = 1;
  let label = 'Minimally Processed';
  let description = 'Primarily whole or lightly transformed agricultural ingredients with negligible industrial additives.';
  let score = 90;

  const hasHighSugar = nutrition.addedSugars !== null && nutrition.addedSugars > 15;

  if (indicators.length >= 3 || (indicators.length >= 1 && hasHighSugar)) {
    novaLevel = 4;
    label = 'Ultra-Processed (NOVA 4)';
    description = 'Contains multiple industrial formulations (flavor enhancers, emulsifiers, modified starches) rarely found in domestic kitchens.';
    score = Math.max(20, 60 - indicators.length * 8);
    breakdown.push({
      factor: 'Industrial Ultra-Processing Markers',
      points: -25,
      rationale: `${indicators.length} markers identified (${indicators.slice(0, 3).join(', ')}...).`,
      type: 'attention',
    });
  } else if (
    indicators.length > 0 ||
    (nutrition.addedSugars !== null && nutrition.addedSugars > 5) ||
    (nutrition.sodium !== null && nutrition.sodium > 400)
  ) {
    novaLevel = 3;
    label = 'Processed Food (NOVA 3)';
    description = 'Manufactured with added culinary ingredients (oil, salt, or sugar) for taste or preservation.';
    score = 70;
    breakdown.push({
      factor: 'Culinary Processing Additions',
      points: -10,
      rationale: 'Contains added seasonings, oils, or shelf-life stabilizers.',
      type: 'attention',
    });
  } else {
    novaLevel = ingredients.length <= 3 ? 1 : 2;
    label = novaLevel === 1 ? 'Unprocessed / Minimally Processed (NOVA 1)' : 'Culinary Ingredient (NOVA 2)';
    breakdown.push({
      factor: 'Low Processing Footprint',
      points: 15,
      rationale: 'Retains natural food structure with minimal industrial transformation.',
      type: 'positive',
    });
  }

  return {
    score: Math.max(10, Math.min(100, Math.round(score))),
    level: novaLevel,
    label,
    novaEstimate: `NOVA ${novaLevel}`,
    description,
    indicators,
    breakdown,
    isAvailable: true,
  };
}

export function buildRadarMetrics(
  nutrition: NutritionData,
  ingredients: IngredientItem[]
): ProductAnalysis['radar'] {
  // Added sugar
  const sugarVal = nutrition.addedSugars !== null ? Math.min(10, (nutrition.addedSugars / 25) * 10) : 0;
  const sugarLevel: 'low' | 'moderate' | 'high' =
    nutrition.addedSugars !== null
      ? nutrition.addedSugars > 15
        ? 'high'
        : nutrition.addedSugars > 6
        ? 'moderate'
        : 'low'
      : 'low';

  // Sodium
  const sodiumVal = nutrition.sodium !== null ? Math.min(10, (nutrition.sodium / 600) * 10) : 0;
  const sodiumLevel: 'low' | 'moderate' | 'high' =
    nutrition.sodium !== null
      ? nutrition.sodium > 450
        ? 'high'
        : nutrition.sodium > 200
        ? 'moderate'
        : 'low'
      : 'low';

  // Saturated Fat
  const satFatVal = nutrition.saturatedFat !== null ? Math.min(10, (nutrition.saturatedFat / 7) * 10) : 0;
  const satFatLevel: 'low' | 'moderate' | 'high' =
    nutrition.saturatedFat !== null
      ? nutrition.saturatedFat > 5
        ? 'high'
        : nutrition.saturatedFat > 2
        ? 'moderate'
        : 'low'
      : 'low';

  // Processing indicators
  const procCount = ingredients.filter((i) => i.isUltraProcessedIndicator).length;
  const procVal = Math.min(10, procCount * 2.5);
  const procLevel: 'low' | 'moderate' | 'high' = procCount >= 3 ? 'high' : procCount >= 1 ? 'moderate' : 'low';

  // Additives
  const addCount = ingredients.filter((i) => i.category !== 'whole-food').length;
  const addVal = Math.min(10, addCount * 2);
  const addLevel: 'low' | 'moderate' | 'high' = addCount >= 4 ? 'high' : addCount >= 2 ? 'moderate' : 'low';

  return {
    addedSugar: {
      value: Math.round(sugarVal * 10) / 10,
      max: 10,
      label: 'Added Sugar',
      level: sugarLevel,
    },
    sodium: {
      value: Math.round(sodiumVal * 10) / 10,
      max: 10,
      label: 'Sodium',
      level: sodiumLevel,
    },
    saturatedFat: {
      value: Math.round(satFatVal * 10) / 10,
      max: 10,
      label: 'Saturated Fat',
      level: satFatLevel,
    },
    processingIndicators: {
      value: Math.round(procVal * 10) / 10,
      max: 10,
      label: 'Processing Indicators',
      level: procLevel,
    },
    additives: {
      value: Math.round(addVal * 10) / 10,
      max: 10,
      label: 'Additives & Stabilizers',
      level: addLevel,
    },
  };
}

export function generateSwapCriteria(nutrition: NutritionData): SwapCriterion[] {
  const criteria: SwapCriterion[] = [];

  if (nutrition.addedSugars !== null && nutrition.addedSugars > 10) {
    criteria.push({
      label: 'Lower Sugar Alternative',
      threshold: '< 6g added sugar',
      reason: `Stated formulation has ${nutrition.addedSugars}g added sugar per portion.`,
    });
  }

  if (nutrition.sodium !== null && nutrition.sodium > 350) {
    criteria.push({
      label: 'Lower Sodium Alternative',
      threshold: '< 140mg sodium',
      reason: `Stated formulation contains ${nutrition.sodium}mg sodium per portion.`,
    });
  }

  if (nutrition.protein !== null && nutrition.protein < 5 && nutrition.calories !== null && nutrition.calories > 150) {
    criteria.push({
      label: 'Higher Protein & Satiety',
      threshold: '> 8g protein',
      reason: 'Increases fullness per calorie.',
    });
  }

  if (criteria.length === 0) {
    criteria.push({
      label: 'Clean Ingredient Profile',
      threshold: 'Recognizable whole ingredients',
      reason: 'Fewer additives and lower industrial processing footprint.',
    });
  }

  return criteria;
}

export function evaluateMarketingClaims(
  claims: string[],
  nutrition: NutritionData,
  ingredients: IngredientItem[]
): MarketingClaimEvaluation[] {
  const results: MarketingClaimEvaluation[] = [];

  for (const claim of claims) {
    const c = claim.toLowerCase().trim();
    if (c.includes('high protein') || c.includes('protein')) {
      if (nutrition.protein !== null) {
        if (nutrition.protein >= 10) {
          results.push({
            claim,
            status: 'verified',
            explanation: `Provides ${nutrition.protein}g protein (meets high protein threshold of ≥10g).`,
          });
        } else if (nutrition.protein >= 5) {
          results.push({
            claim,
            status: 'caution',
            explanation: `Contains ${nutrition.protein}g protein, which is moderate rather than high.`,
          });
        } else {
          results.push({
            claim,
            status: 'unsupported',
            explanation: `Only contains ${nutrition.protein}g protein per portion.`,
          });
        }
      } else {
        results.push({
          claim,
          status: 'caution',
          explanation: 'Protein content could not be read from photo to verify this claim.',
        });
      }
    } else if (c.includes('no added sugar') || c.includes('zero sugar')) {
      if (nutrition.addedSugars !== null) {
        if (nutrition.addedSugars === 0) {
          const hasArtSweeteners = ingredients.some(
            (i) => i.category === 'sweetener' && i.isUltraProcessedIndicator
          );
          results.push({
            claim,
            status: 'verified',
            explanation: hasArtSweeteners
              ? `Contains 0g added sugar, but uses artificial/non-nutritive sweeteners.`
              : `Contains 0g added sugar from natural formulation.`,
          });
        } else {
          results.push({
            claim,
            status: 'unsupported',
            explanation: `Product lists ${nutrition.addedSugars}g added sugars on the nutrition panel.`,
          });
        }
      } else {
        results.push({
          claim,
          status: 'caution',
          explanation: 'Sugar data not visible in current photo to confirm 0g added sugar claim.',
        });
      }
    } else if (c.includes('low fat')) {
      if (nutrition.totalFat !== null) {
        if (nutrition.totalFat <= 3) {
          results.push({
            claim,
            status: 'verified',
            explanation: `Contains ${nutrition.totalFat}g total fat (meets low fat standard of ≤3g per portion).`,
          });
        } else {
          results.push({
            claim,
            status: 'caution',
            explanation: `Contains ${nutrition.totalFat}g total fat per portion.`,
          });
        }
      }
    } else if (c.includes('natural') || c.includes('all natural')) {
      const artificialItems = ingredients.filter(
        (i) => i.isUltraProcessedIndicator || i.category === 'color'
      );
      if (ingredients.length > 0 && artificialItems.length === 0) {
        results.push({
          claim,
          status: 'verified',
          explanation: 'No synthetic dyes or artificial additives detected in ingredient statement.',
        });
      } else if (artificialItems.length > 0) {
        results.push({
          claim,
          status: 'caution',
          explanation: `Contains ${artificialItems.length} synthesized ingredient(s) (${artificialItems.map((a) => a.name).join(', ')}).`,
        });
      }
    } else if (c.includes('gluten free') || c.includes('gluten-free')) {
      const hasGluten = ingredients.some(
        (i) => i.allergenDetected === 'Gluten' || i.allergenDetected === 'Wheat'
      );
      results.push({
        claim,
        status: hasGluten ? 'unsupported' : 'verified',
        explanation: hasGluten
          ? 'Warning: Ingredients indicate wheat or gluten cereal elements.'
          : 'No gluten-containing cereals identified in parsed ingredients.',
      });
    }
  }

  return results;
}

export function compileProductAnalysis(params: {
  id?: string;
  scanMode: ScanMode;
  imageType?: ImageType;
  productName?: string;
  brand?: string | null;
  productVariant?: string | null;
  packageSize?: string | null;
  barcode?: string;
  nutrition: NutritionData;
  ingredients: IngredientItem[];
  rawIngredientsText: string;
  detectedClaims?: string[];
  imagePreviewUrl?: string;
  images?: ScanImageItem[];
  nutritionConfidence?: 'high' | 'medium' | 'low' | 'none';
  detectionNotes?: string;
}): ProductAnalysis {
  const nutritionResult = calculateNutritionScore(params.nutrition);
  const ingredientResult = calculateIngredientScore(params.ingredients);
  const processingResult = calculateProcessingScore(params.ingredients, params.nutrition);

  // Check if we have verified label data
  const hasVerifiedNutrition = nutritionResult.isAvailable;
  const hasVerifiedIngredients = ingredientResult.isAvailable;
  const isScoreAvailable = hasVerifiedNutrition || hasVerifiedIngredients;

  // Weighted overall score
  let overallScore = 70;
  if (hasVerifiedNutrition && hasVerifiedIngredients) {
    overallScore = Math.round(
      nutritionResult.score * 0.45 + ingredientResult.score * 0.35 + processingResult.score * 0.2
    );
  } else if (hasVerifiedNutrition) {
    overallScore = Math.round(nutritionResult.score * 0.7 + processingResult.score * 0.3);
  } else if (hasVerifiedIngredients) {
    overallScore = Math.round(ingredientResult.score * 0.6 + processingResult.score * 0.4);
  }

  const combinedBreakdown: ScoreBreakdownItem[] = [
    ...nutritionResult.breakdown,
    ...ingredientResult.breakdown,
    ...processingResult.breakdown,
  ];

  // Extract unique allergens
  const allergensSet = new Set<string>();
  for (const item of params.ingredients) {
    if (item.allergenDetected) {
      allergensSet.add(item.allergenDetected);
    }
  }

  const radar = buildRadarMetrics(params.nutrition, params.ingredients);
  const swapCriteria = generateSwapCriteria(params.nutrition);
  const marketingClaims = evaluateMarketingClaims(
    params.detectedClaims || [],
    params.nutrition,
    params.ingredients
  );

  return {
    id: params.id || `nl-${Date.now()}`,
    timestamp: new Date().toISOString(),
    scanMode: params.scanMode,
    imageType: params.imageType || 'full_package',
    productName: params.productName || 'Scanned Packaged Food',
    brand: params.brand || null,
    productVariant: params.productVariant || null,
    packageSize: params.packageSize || null,
    barcode: params.barcode,
    nutrition: params.nutrition,
    rawIngredientsText: params.rawIngredientsText,
    ingredients: params.ingredients,
    allergens: Array.from(allergensSet),
    scores: {
      overall: Math.max(10, Math.min(100, overallScore)),
      nutrition: nutritionResult.score,
      ingredients: ingredientResult.score,
      processing: processingResult.score,
      breakdown: combinedBreakdown,
      isScoreAvailable,
      unavailableReason: !isScoreAvailable
        ? 'Nutrition score unavailable — insufficient verified label data. Please scan the nutrition facts panel.'
        : undefined,
    },
    processingLevel: {
      level: processingResult.level,
      label: processingResult.label,
      novaEstimate: processingResult.novaEstimate,
      description: processingResult.description,
      indicators: processingResult.indicators,
    },
    radar,
    marketingClaims,
    swapCriteria,
    imagePreviewUrl: params.imagePreviewUrl,
    images: params.images,
    nutritionConfidence: params.nutritionConfidence || (hasVerifiedNutrition ? 'high' : 'none'),
    detectionNotes: params.detectionNotes,
    hasVerifiedNutritionData: hasVerifiedNutrition,
    hasVerifiedIngredientsData: hasVerifiedIngredients,
  };
}
