import { NutritionData, IngredientItem, IngredientCategory, ConcernLevel, ImageType } from '@/types/food';
import { findLexiconMatch, MAJOR_ALLERGENS_LIST } from '@/data/ingredients-lexicon';
import { evaluateIngredientTextQuality, isLikelyGarbageText } from '@/features/ocr/garbage-filter';

/**
 * Text Preprocessing & OCR Normalization
 */
export function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[—–]/g, '-')
    // Replace common OCR number confusion inside digit sequences
    .replace(/(\d+)[oO](\d+)/g, '$10$2')
    .trim();
}

/**
 * Extract numerical value with STRICT null fallback.
 * Differentiates explicit 0 from missing data.
 */
function extractNumberOrNull(text: string, regexList: RegExp[]): number | null {
  for (const regex of regexList) {
    const match = text.match(regex);
    if (match && match[1] !== undefined) {
      const token = match[1].trim().toLowerCase();
      // Explicit zero notations
      if (token === '0' || token === '0.0' || token === '0,0' || token === 'nil' || token === 'zero' || token === '<0.1' || token === '< 0.1' || token === '<0.5' || token === '< 0.5') {
        return 0;
      }
      // Normalize comma to period (e.g. 1,5g -> 1.5g)
      const numStr = token.replace(',', '.').replace(/[^0-9.]/g, '');
      const val = parseFloat(numStr);
      if (!isNaN(val)) {
        // Basic sanity check to avoid impossible OCR errors (e.g., 999999g)
        if (val > 100000) return null;
        return val;
      }
    }
  }
  return null;
}

/**
 * Parse Nutrition Facts from OCR / input text
 * NEVER defaults unknown or unread fields to 0!
 */
export function parseNutritionText(rawText: string): NutritionData {
  if (!rawText || !rawText.trim()) {
    return {
      servingSize: null,
      servingsPerContainer: null,
      calories: null,
      totalFat: null,
      saturatedFat: null,
      transFat: null,
      cholesterol: null,
      sodium: null,
      totalCarbs: null,
      dietaryFiber: null,
      totalSugars: null,
      addedSugars: null,
      protein: null,
      salt: null,
      energyKj: null,
      basis: null,
    };
  }

  const text = normalizeOcrText(rawText);

  // Serving Size - Never default to "1 package / serving"
  let servingSize: string | null = null;
  const servingMatch = text.match(/(?:serving\s*size|per\s*serving|serv\s*size|per\s*100\s*g|per\s*100g)\s*[:\s]?\s*([^\n\r]+)/i);
  if (servingMatch && servingMatch[1]) {
    const candidate = servingMatch[1].trim().slice(0, 40);
    if (!isLikelyGarbageText(candidate)) {
      servingSize = candidate;
    }
  } else if (/per\s*100\s*g/i.test(text)) {
    servingSize = '100g';
  }

  // Basis
  let basis: 'per_serving' | 'per_100g' | 'per_package' | null = null;
  if (/per\s*100\s*g/i.test(text)) {
    basis = 'per_100g';
  } else if (/per\s*serving/i.test(text)) {
    basis = 'per_serving';
  } else if (/per\s*pack(?:age)?/i.test(text)) {
    basis = 'per_package';
  }

  // Servings Per Container
  const servingsPerContainer = extractNumberOrNull(text, [
    /servings\s*per\s*container\s*[:\s]?\s*(?:about\s*)?([0-9.,]+)/i,
    /servings\s*per\s*pack(?:age)?\s*[:\s]?\s*(?:about\s*)?([0-9.,]+)/i,
    /servings\s*[:\s]?\s*([0-9.,]+)/i,
  ]);

  // Calories / Energy
  const calories = extractNumberOrNull(text, [
    /calories\s*[:\s]?\s*(\d+)/i,
    /energy\s*[:\s]?\s*(\d+)\s*(?:kcal|calories)/i,
    /energy\s*\(?kcal\)?\s*[:\s]?\s*(\d+)/i,
    /(?:energy|calories)\s*[:\s]?\s*(\d+)/i,
    /(\d+)\s*kcal/i,
  ]);

  // Energy in kJ (frequent on Indian/UK packages)
  const energyKj = extractNumberOrNull(text, [
    /energy\s*[:\s]?\s*(\d+)\s*kj/i,
    /(\d+)\s*kj/i,
  ]);

  // Total Fat
  const totalFat = extractNumberOrNull(text, [
    /total\s*fat\s*[:\s]?\s*([0-9.,]+|nil|zero|< ?0\.[0-9]+)\s*g?/i,
    /fat\s*[:\s]?\s*([0-9.,]+|nil|zero|< ?0\.[0-9]+)\s*g/i,
    /total\s*fat\s*\(g\)\s*[:\s]?\s*([0-9.,]+)/i,
  ]);

  // Saturated Fat
  const saturatedFat = extractNumberOrNull(text, [
    /saturated\s*fat(?:ty\s*acids?)?\s*[:\s]?\s*([0-9.,]+|nil|zero|< ?0\.[0-9]+)\s*g?/i,
    /sat(?:\.|\s*)fat\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /of\s*which\s*saturates\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
  ]);

  // Trans Fat
  const transFat = extractNumberOrNull(text, [
    /trans\s*fat(?:ty\s*acids?)?\s*[:\s]?\s*([0-9.,]+|nil|zero|< ?0\.[0-9]+)\s*g?/i,
    /trans\s*fat\s*\(g\)\s*[:\s]?\s*([0-9.,]+)/i,
  ]);

  // Cholesterol
  const cholesterol = extractNumberOrNull(text, [
    /cholesterol\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*m?g/i,
    /cholesterol\s*\(mg\)\s*[:\s]?\s*([0-9.,]+)/i,
  ]);

  // Sodium (mg)
  let sodium = extractNumberOrNull(text, [
    /sodium\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*mg/i,
    /sodium\s*\(mg\)\s*[:\s]?\s*([0-9.,]+)/i,
  ]);

  // Salt (g) - frequently on Indian and European packages
  const salt = extractNumberOrNull(text, [
    /salt\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g/i,
    /salt\s*\(g\)\s*[:\s]?\s*([0-9.,]+)/i,
    /iodised\s*salt\s*[:\s]?\s*([0-9.,]+)/i,
  ]);

  // If salt is present and sodium is null, calculate sodium: 1g salt ≈ 400mg sodium
  if (sodium === null && salt !== null) {
    sodium = Math.round(salt * 393.4);
  }

  // Total Carbohydrates
  const totalCarbs = extractNumberOrNull(text, [
    /total\s*carbohydrate(?:s)?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /carbohydrate(?:s)?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /carbs?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g/i,
  ]);

  // Dietary Fiber
  const dietaryFiber = extractNumberOrNull(text, [
    /dietary\s*fib(?:er|re)\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /fib(?:er|re)\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
  ]);

  // Total Sugars
  const totalSugars = extractNumberOrNull(text, [
    /total\s*sugars?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /of\s*which\s*sugars?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /sugars?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g/i,
  ]);

  // Added Sugars
  const addedSugars = extractNumberOrNull(text, [
    /(?:includes\s*)?([0-9.,]+|nil|zero)\s*g?\s*added\s*sugars?/i,
    /added\s*sugars?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
  ]);

  // Protein
  const protein = extractNumberOrNull(text, [
    /protein\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /protein\s*\(g\)\s*[:\s]?\s*([0-9.,]+)/i,
  ]);

  return {
    servingSize,
    servingsPerContainer,
    calories,
    totalFat,
    saturatedFat,
    transFat,
    cholesterol,
    sodium,
    totalCarbs,
    dietaryFiber,
    totalSugars,
    addedSugars,
    protein,
    salt,
    energyKj,
    basis,
  };
}

/**
 * Parse Ingredients list with garbage rejection
 */
export function parseIngredientsText(rawText: string): {
  items: IngredientItem[];
  cleanRawList: string;
  isGarbageRejected: boolean;
} {
  const text = normalizeOcrText(rawText);

  // Extract after "Ingredients:" or "INGREDIENTS:"
  let ingredientsSection = text;
  const match = text.match(/ingredients?\s*[:\s]\s*([\s\S]+?)(?=(?:contains|may contain|allergy advice|manufactured|nutrition facts|mfg|exp|batch|$))/i);
  if (match && match[1]) {
    ingredientsSection = match[1].trim();
  }

  // Run Garbage Check
  const quality = evaluateIngredientTextQuality(ingredientsSection);
  if (!quality.isValid) {
    return {
      items: [],
      cleanRawList: '',
      isGarbageRejected: true,
    };
  }

  // Split into components
  const rawList = ingredientsSection
    .replace(/\([^)]*\)/g, (m) => m.replace(/,/g, '§'))
    .split(/[,;\n•·]/)
    .map((s) => s.replace(/§/g, ',').trim())
    .filter((s) => s.length > 1 && !isLikelyGarbageText(s));

  const items: IngredientItem[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const rawName = rawList[i];
    const matchData = findLexiconMatch(rawName);

    // Allergen detection
    let allergen: string | undefined = undefined;
    for (const major of MAJOR_ALLERGENS_LIST) {
      if (rawName.toLowerCase().includes(major.toLowerCase())) {
        allergen = major;
        break;
      }
    }

    if (matchData) {
      items.push({
        id: `ing-${i}-${Date.now()}`,
        name: rawName,
        normalizedName: matchData.canonicalName,
        category: matchData.category,
        role: matchData.role,
        description: matchData.description,
        concernLevel: matchData.concernLevel,
        rationale: matchData.rationale,
        allergenDetected: allergen || (matchData.allergens && matchData.allergens[0]),
        isUltraProcessedIndicator: matchData.isUltraProcessed,
      });
    } else {
      const lower = rawName.toLowerCase();
      let category: IngredientCategory = 'whole-food';
      let concernLevel: ConcernLevel = 'low';
      let role = 'Component';
      let rationale = 'Identified standard food ingredient.';
      let isUp = false;

      if (lower.includes('flavor') || lower.includes('flavour')) {
        category = 'flavor';
        concernLevel = 'moderate';
        role = 'Flavoring Agent';
        rationale = 'Added flavoring agent used for sensory profile enhancement.';
        isUp = true;
      } else if (lower.includes('color') || lower.includes('colour') || lower.includes('caramel') || lower.includes('ins 150')) {
        category = 'color';
        concernLevel = 'moderate';
        role = 'Coloring Agent';
        rationale = 'Cosmetic coloring agent to impart uniform shade.';
        isUp = true;
      } else if (lower.includes('preservative') || lower.includes('benzoate') || lower.includes('sorbate')) {
        category = 'preservative';
        concernLevel = 'moderate';
        role = 'Preservative';
        rationale = 'Extends microbial shelf-life.';
        isUp = true;
      } else if (lower.includes('palm') || lower.includes('hydrogenated')) {
        category = 'additive';
        concernLevel = 'attention';
        role = 'Industrial Lipid Fraction';
        rationale = 'Heavily refined or hydrogenated fat associated with ultra-processing.';
        isUp = true;
      }

      items.push({
        id: `ing-${i}-${Date.now()}`,
        name: rawName,
        normalizedName: rawName,
        category,
        role,
        description: `${role} identified in ingredients statement.`,
        concernLevel,
        rationale,
        allergenDetected: allergen,
        isUltraProcessedIndicator: isUp,
      });
    }
  }

  return {
    items,
    cleanRawList: ingredientsSection,
    isGarbageRejected: false,
  };
}

/**
 * Detect Claims
 */
export function detectMarketingClaimsFromText(text: string): string[] {
  const claimsFound: string[] = [];
  const knownClaims = [
    'No Added Sugar',
    'Sugar Free',
    'Zero Sugar',
    'Low Fat',
    'Fat Free',
    'All Natural',
    '100% Natural',
    'Organic',
    'Gluten Free',
    'High Protein',
    'Good Source of Fiber',
    'No Preservatives',
    'No Artificial Colors',
    'No Artificial Flavors',
    'No MSG Added',
    'Trans Fat Free',
    'Cholesterol Free',
    'Baked Not Fried',
  ];

  for (const claim of knownClaims) {
    const pattern = new RegExp(`\\b${claim.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(text)) {
      claimsFound.push(claim);
    }
  }

  return claimsFound;
}

/**
 * Heuristic Image Type Detection from text
 */
export function detectImageTypeFromText(text: string): ImageType {
  const lower = text.toLowerCase();
  const hasNutrition =
    lower.includes('nutrition facts') ||
    lower.includes('nutrition information') ||
    lower.includes('nutritional info') ||
    lower.includes('per 100g') ||
    lower.includes('per serving') ||
    (lower.includes('calories') && lower.includes('fat'));

  const hasIngredients =
    lower.includes('ingredients:') ||
    lower.includes('ingredients :') ||
    lower.includes('ingrédients') ||
    lower.includes('allergy advice');

  if (hasNutrition && hasIngredients) return 'multi_panel';
  if (hasNutrition) return 'nutrition_label';
  if (hasIngredients) return 'ingredients_label';
  if (lower.length > 20 && !hasNutrition && !hasIngredients) return 'front_package';

  return 'unknown' as any;
}
