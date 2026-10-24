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

  // Serving Size - Never default to "1 package / serving".
  // Scan ALL matches per pattern and take the first non-garbage candidate so a
  // stray "(per 100g)*" echo earlier on the label cannot consume the slot.
  let servingSize: string | null = null;
  const servingSizePatterns = [
    /serving\s*size\s*[:\s]?\s*([^\n\r]+)/gi,
    /serv\s*size\s*[:\s]?\s*([^\n\r]+)/gi,
    /per\s*serving\s*[:\s]?\s*([^\n\r]+)/gi,
  ];
  for (const pattern of servingSizePatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const candidate = (m[1] || '').trim().slice(0, 40);
      if (candidate && !isLikelyGarbageText(candidate)) {
        servingSize = candidate;
        break;
      }
    }
    if (servingSize) break;
  }
  if (!servingSize && /per\s*100\s*g/i.test(text)) {
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

  // Added Sugars (label-first format is the most common)
  const addedSugars = extractNumberOrNull(text, [
    /added\s*sugars?\s*[:\s]?\s*([0-9.,]+|nil|zero)\s*g?/i,
    /(?:includes\s*)?([0-9.,]+|nil|zero)\s*g?\s*added\s*sugars?/i,
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
  } else if (!/ingredients?\s*[:\-\u2013\u2014\n]/i.test(text)) {
    // HONESTY GATE: without an "Ingredients" header, accept ONLY a clearly
    // list-shaped text (>= 2 list separators, simple label characters).
    // A plain sentence or unrelated OCR text is never fabricated into a
    // fake ingredient list.
    const isListShaped =
      (text.match(/[,;]/g) || []).length >= 2 &&
      /^[A-Za-z0-9\s.,%()\u2013\u2014']+$/.test(text.trim());
    if (!isListShaped) {
      return { items: [], cleanRawList: '', isGarbageRejected: true };
    }
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

  // v2.4.1: incidental background text on a COOKED-FOOD photo must NOT make
  // the image a "front package". The front of a package needs actual
  // packaging evidence: a known brand, a product-type word, a plausible
  // multi-word printed title, or marketing claims. Without any of that,
  // be honest: the image type is unknown and the UI asks the user.
  if (!hasNutrition && !hasIngredients) {
    const hasBrandEvidence = BRAND_LEXICON.some((entry) =>
      entry.aliases.some((alias) => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lower);
      })
    );
    const hasTypeWord = PRODUCT_TYPE_WORDS.some((word) =>
      new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(lower)
    );
    const hasPlausibleTitle = (lower.match(/[^\n]+/g) || []).some((line) => {
      const t = line.trim();
      return t.length >= 5 && t.length <= 48 && isPlausibleProductTitle(t);
    });
    if (hasBrandEvidence || hasTypeWord || hasPlausibleTitle) return 'front_package';
  }

  return 'unknown' as any;
}

/* ============================================================
 * Brand & Product Name Extraction (OCR fallback)
 * ============================================================ */

import { BRAND_LEXICON, PRODUCT_TYPE_WORDS } from '@/data/brand-lexicon';

export interface BrandAndName {
  brand: string | null;
  productName: string | null;
}

/**
 * Lines that belong to regulatory/informational sections of the package and
 * should never be treated as the product title.
 */
const NON_TITLE_SECTION_PATTERNS: RegExp[] = [
  /^nutrition( facts| information|al info)?\b/i,
  /^ingredient(s)?\b/i,
  /^contains\b|^may contain\b|^allergy advice\b|^best before\b|^use by\b/i,
  /^net (wt|weight|qty|quantity)\b|^gross weight\b|^mrp\b|^m\.r\.p\b|^batch\b|^mfg\b|^mfd\b|^exp\b|^pincode\b/i,
  /^address\b|^marketed by\b|^manufactured( by| for)?\b|^packed( by| for)?\b/i,
  /^keep( away| refrigerated)?\b|^store\b|^warning\b|^directions\b|^serving size\b|^servings?\b/i,
  /^fssai\b|^lic(ense|ence) no\b|^www\.|^https?:|^customer care\b|^toll free\b/i,
  /^scan\b|^qr code\b|^flip\b|^back\b|^nutrition per\b|^energy\b|^protein\b|^carbohydrate\b/i,
  /^total fat\b|^saturated\b|^trans fat\b|^sugar\b|^dietary fib|^sodium\b|^salt\b|^cholesterol\b/i,
  /^\d+\s*(g|kg|ml|l|pcs|pieces)\b\.?$/i,
  /^\*+$/,
];

/**
 * Words that are common English pronouns/articles/contractions. OCR noise on
 * cooked-food photos frequently yields exactly these ("She") — a real product
 * title is never one of them.
 */
const TITLE_STOPWORDS = new Set([
  'she', 'he', 'her', 'his', 'him', 'they', 'them', 'the', 'a', 'an', 'and',
  'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'its', 'for',
  'you', 'your', 'we', 'our', 'my', 'this', 'that', 'with', 'from', 'not',
  'no', 'yes', 'ok', 'okay', 'wow', 'yum', 'del', 'the',
]);

/** True when a word matches the offline brand lexicon (case-insensitive). */
function isLexiconBrand(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z0-9&'\- ]/g, '').trim();
  return BRAND_LEXICON.some((e) => e.aliases.some((a) => a.toLowerCase() === w));
}

/**
 * Final plausibility gate for an OCR-derived PRODUCT TITLE (v2.4.1).
 *
 * Validates the JOINED title, not only individual lines: cooked-food photos
 * produce multi-line OCR junk ("A Naha ai BR RA a ge") that passes per-line
 * checks. Rules:
 *  - single word: must be a lexicon brand, a product-type word, or a
 *    substantial (>=5 chars) non-stopword — "She" and "Poha" alone never
 *    become product names from weak evidence.
 *  - multi word: at least half the letter-bearing tokens must be real-looking
 *    words (>=3 letters, contains a vowel) — joined junk fails this.
 * Legitimate short brand names stay valid through the lexicon rule.
 */
export function isPlausibleProductTitle(fragment: string): boolean {
  const trimmed = (fragment || '').trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const words = tokens.filter((t) => /[A-Za-z]/.test(t));
  if (words.length === 0) return false;

  if (words.length === 1) {
    const raw = words[0];
    const bare = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (!bare) return false;
    if (TITLE_STOPWORDS.has(bare)) return false;
    if (isLexiconBrand(raw) || isLexiconBrand(bare)) return true;
    if (PRODUCT_TYPE_WORDS.includes(bare)) return true;
    // A lone generic word is only a plausible title when substantial;
    // 3-5 letter non-lexicon words ("She", "Salt", "plate") are honest no.
    return bare.length >= 6 && !/[\d]/.test(raw);
  }

  // Multi-word titles: require real-looking word content.
  // Isolated 1-letter tokens are classic OCR noise ("bet 3 SEEN o").
  if (words.some((w) => w.replace(/[^A-Za-z]/g, '').length === 1)) return false;
  const strong = words.filter((w) => {
    const bare = w.replace(/[^A-Za-z']/g, '');
    if (bare.length < 3) return false;
    if (!/[aeiouy]/i.test(bare)) return false;
    // Pure screaming caps 2-3 letter clusters ("BR", "RA") are OCR junk.
    if (bare.length <= 3 && bare === bare.toUpperCase() && /^[A-Z]+$/.test(bare)) return false;
    return true;
  });
  if (strong.length < 2 && words.length > 2) return false;
  if (strong.length < 1) return false;
  // And at least one genuinely substantial token.
  if (!words.some((w) => w.replace(/[^A-Za-z]/g, '').length >= 4)) return false;
  return true;
}

/** True when a line could plausibly be part of a printed product title. */
function isCandidateTitleLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 48) return false;
  // Must contain at least two consecutive letters (reject OCR noise & symbols)
  if (!/[A-Za-z]{2}/.test(trimmed)) return false;
  // Mostly digits (like "155147" or "70g") is never a title
  const digits = (trimmed.match(/\d/g) || []).length;
  if (digits / trimmed.replace(/\s/g, '').length > 0.5) return false;
  for (const pattern of NON_TITLE_SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  if (isLikelyGarbageText(trimmed)) return false;
  return true;
}

/** Clean a raw OCR title fragment into a presentable product name. */
function cleanTitleFragment(fragment: string): string {
  return fragment
    .replace(/[|\\\/]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—:,.!•]+|[\s\-–—:,.!•]+$/g, '')
    .trim();
}

/**
 * Extract brand and product name from real OCR text. Evidence-based only:
 * the brand must appear in the OCR text (matched against the offline brand
 * lexicon), and the name must come from a plausible printed title line.
 * Filenames, timestamps, or numeric identifiers are NEVER used here.
 *
 * Returns { null, null } when the text supports no confident identification.
 */
export function extractBrandAndName(rawText: string): BrandAndName {
  const normalized = normalizeOcrText(rawText || '');
  if (!normalized.trim()) return { brand: null, productName: null };

  const lines = normalized.split('\n').map((l) => l.trim());

  // ---- 1. Brand: match the offline lexicon against the whole text. ----
  let brand: string | null = null;
  for (const entry of BRAND_LEXICON) {
    const found = entry.aliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(normalized);
    });
    if (found) {
      brand = entry.display;
      break;
    }
  }

  // ---- 2. Product name: find plausible printed title lines. ----
  const candidateLines: { line: string; index: number }[] = [];
  lines.forEach((line, index) => {
    if (isCandidateTitleLine(line)) candidateLines.push({ line, index });
  });

  if (candidateLines.length === 0) {
    return { brand, productName: null };
  }

  const lowerText = normalized.toLowerCase();

  // Prefer, in order:
  // (a) a line containing the matched brand,
  // (b) a line containing a product-type word,
  // (c) the first candidate lines near the top of the text.
  const brandLine = brand
    ? candidateLines.find(({ line }) =>
        new RegExp(brand!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(line)
      )
    : undefined;

  const typeLine = candidateLines.find(({ line }) => {
    const lower = line.toLowerCase();
    return PRODUCT_TYPE_WORDS.some((word) =>
      new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(lower)
    );
  });

  // Multi-line titles: join the chosen line with the immediately adjacent
  // candidate lines (max 3 lines total, <= 60 chars) when they read as a title.
  function assembleTitle(primary: { line: string; index: number }): string {
    const group = [primary.line];
    for (const cand of candidateLines) {
      if (group.length >= 3) break;
      if (cand.index === primary.index) continue;
      // Only join directly adjacent lines (title lines sit together)
      const isNeighbor = Math.abs(cand.index - primary.index) <= 1;
      if (!isNeighbor) continue;
      const candidateGroup = [...group, cand.line].join(' ').trim();
      if (candidateGroup.replace(/\s/g, '').length <= 60) {
        group.push(cand.line);
      }
    }
    return cleanTitleFragment(group.join(' '));
  }

  let productName: string | null = null;
  if (brandLine) {
    productName = assembleTitle(brandLine);
  } else if (typeLine) {
    productName = assembleTitle(typeLine);
  } else {
    productName = assembleTitle(candidateLines[0]);
  }

  // Strip a leading brand from the name so brand and name stay separate.
  // NOTE: the separator class is built from a template literal — the hyphen
  // MUST be escaped as \\\- so it cannot form a Unicode RANGE like ,-–
  // (which would swallow every digit and letter and delete the whole title).
  if (brand && productName) {
    const brandRegex = new RegExp(
      `^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s:,\\-–—]+`,
      'i'
    );
    productName = cleanTitleFragment(productName.replace(brandRegex, ''));
  }

  // Never return junk: digits-only, tiny fragments, or nutrition echo text.
  if (productName !== null) {
    const letters = (productName.match(/[A-Za-z]/g) || []).length;
    if (
      productName.trim() === '' ||
      letters < 3 ||
      /^[\d\s.]+$/.test(productName) ||
      (brand && productName.trim().toLowerCase() === brand.toLowerCase())
    ) {
      productName = null; // a brand-only line is the brand, not the product name
    }
  }

  // v2.4.1: revalidate the FINAL JOINED title (cooked-food OCR junk like
  // "A Naha ai BR RA a ge" passes per-line checks but not this gate).
  if (productName !== null && !isPlausibleProductTitle(productName)) {
    productName = null;
  }

  return { brand, productName };
}
