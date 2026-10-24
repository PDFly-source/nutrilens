/**
 * Indian-food class registry (v2.3.0).
 *
 * A versioned, honest inventory of the dishes NutriLens understands — not a
 * claim about what the bundled model can recognize. Each class states:
 *   - how it can be identified today ('model-direct' | 'model-near' | 'manual'),
 *   - whether a verified nutrition record exists ('supported' | 'experimental'),
 *   - or whether it is only dataset-ready for the future Indian-food model.
 *
 * Status semantics:
 *   'supported'    — nutrition record + identification path exist.
 *   'experimental' — rough nutrition record only; extra uncertainty shown.
 *   'dataset-ready' — recognized concept, NO verified nutrition record and no
 *                     model class; the app offers manual entry and never
 *                     estimates from thin air. Targeted for the planned model.
 *
 * This module is the vocabulary the planned training pipeline
 * (training/indian-food/) must learn and evaluate against.
 */

export const INDIAN_FOOD_REGISTRY_VERSION = '2.3.0';

export type FoodCategory =
  | 'rice'
  | 'bread'
  | 'breakfast'
  | 'lentils'
  | 'curry'
  | 'snack'
  | 'noodles'
  | 'dumpling'
  | 'sweet'
  | 'beverage'
  | 'regional';

export type ClassStatus = 'supported' | 'experimental' | 'dataset-ready';

export type IdentificationPath = 'model-direct' | 'model-near' | 'manual';

export interface IndianFoodClass {
  /** Canonical name shown in the UI. */
  name: string;
  /** Lowercase aliases users may type (search + vision matching). */
  aliases: string[];
  category: FoodCategory;
  /** Region/cuisine, only where verified by the nutrition source. */
  region?: string;
  status: ClassStatus;
  /** How the app can identify it today. */
  identification: IdentificationPath;
  /** Linked dish-database record with the nutrition table (when supported). */
  dishId?: string;
  /** Dishes this class is commonly confused with — disclosed, not hidden. */
  knownConfusions: string[];
  /** Human-readable provenance of the nutrition/recipe knowledge. */
  provenance: string;
}

export const FOOD_CATEGORIES: { id: FoodCategory; label: string }[] = [
  { id: 'rice', label: 'Rice & rice-based meals' },
  { id: 'bread', label: 'Indian breads' },
  { id: 'breakfast', label: 'Breakfast dishes' },
  { id: 'lentils', label: 'Lentils & pulses' },
  { id: 'curry', label: 'Curries & gravies' },
  { id: 'snack', label: 'Snacks & fried foods' },
  { id: 'noodles', label: 'Noodles & Indo-Chinese' },
  { id: 'dumpling', label: 'Dumplings & momo' },
  { id: 'sweet', label: 'Sweets & desserts' },
  { id: 'beverage', label: 'Beverages' },
  { id: 'regional', label: 'Assamese & regional' },
];

export const INDIAN_FOOD_REGISTRY: IndianFoodClass[] = [
  // --- Rice & rice-based meals -------------------------------------------
  {
    name: 'Steamed Rice',
    aliases: ['rice', 'chawal', 'bhat', 'white rice'],
    category: 'rice',
    status: 'supported',
    identification: 'model-near',
    dishId: 'plain-rice',
    knownConfusions: ['veg biryani', 'fried rice', 'curd rice'],
    provenance: 'IFCT 2017 cooked milled rice; near-mapped from Food-101 "fried_rice".',
  },
  {
    name: 'Veg Biryani',
    aliases: ['biryani', 'veg biryani', 'pulao', 'pulao', 'tehri'],
    category: 'rice',
    status: 'supported',
    identification: 'manual',
    dishId: 'veg-biryani',
    knownConfusions: ['steamed rice', 'fried rice', 'pulao'],
    provenance: 'IFCT 2017 rice preparations, recipe-based range (oil/spices add variance).',
  },
  // --- Indian breads ------------------------------------------------------
  {
    name: 'Chapati / Roti',
    aliases: ['roti', 'chapati', 'phulka'],
    category: 'bread',
    status: 'supported',
    identification: 'manual',
    dishId: 'chapati',
    knownConfusions: ['paratha', 'naan'],
    provenance: 'IFCT 2017 unleavened wheat flatbread (roasted).',
  },
  {
    name: 'Poori',
    aliases: ['poori', 'puri', 'fried bread'],
    category: 'bread',
    status: 'supported',
    identification: 'manual',
    dishId: 'poori',
    knownConfusions: ['luchi', 'bhatura', 'roti'],
    provenance: 'IFCT 2017 deep-fried wheat flatbread range.',
  },
  {
    name: 'Aloo Paratha',
    aliases: ['paratha', 'aloo paratha', 'stuffed paratha'],
    category: 'bread',
    status: 'supported',
    identification: 'manual',
    dishId: 'aloo-paratha',
    knownConfusions: ['plain paratha', 'chapati'],
    provenance: 'IFCT 2017 stuffed flatbread; recipe-based range.',
  },
  // --- Breakfast ----------------------------------------------------------
  {
    name: 'Idli',
    aliases: ['idli', 'idly', 'steamed rice cake'],
    category: 'breakfast',
    status: 'supported',
    identification: 'manual',
    dishId: 'idli',
    knownConfusions: ['dhokla', 'appa'],
    provenance: 'IFCT 2017 fermented rice-blackgram steamed cake.',
  },
  {
    name: 'Plain Dosa',
    aliases: ['dosa', 'plain dosa', 'sada dosa'],
    category: 'breakfast',
    status: 'supported',
    identification: 'manual',
    dishId: 'plain-dosa',
    knownConfusions: ['uttapam', 'cheela', 'masala dosa'],
    provenance: 'IFCT 2017 fermented rice dosa, plain (no potato filling).',
  },
  {
    name: 'Poha',
    aliases: ['poha', 'chiura', 'flattened rice'],
    category: 'breakfast',
    status: 'supported',
    identification: 'manual',
    dishId: 'poha',
    knownConfusions: ['upma'],
    provenance: 'Recipe-based estimate on IFCT 2017 raw-poha composition.',
  },
  {
    name: 'Upma',
    aliases: ['upma', 'uppuma', 'rava upma'],
    category: 'breakfast',
    status: 'supported',
    identification: 'manual',
    dishId: 'upma',
    knownConfusions: ['poha', 'khichdi'],
    provenance: 'Recipe-based estimate on IFCT 2017 semolina composition.',
  },
  // --- Lentils ------------------------------------------------------------
  {
    name: 'Dal Fry / Dal Tadka',
    aliases: ['dal', 'dal fry', 'dal tadka', 'toor dal'],
    category: 'lentils',
    status: 'supported',
    identification: 'manual',
    dishId: 'dal-fry',
    knownConfusions: ['sambar', 'chole'],
    provenance: 'IFCT 2017 cooked lentil preparations range.',
  },
  {
    name: 'Rajma (Kidney Bean Curry)',
    aliases: ['rajma', 'rajma masala', 'kidney beans'],
    category: 'lentils',
    status: 'supported',
    identification: 'manual',
    dishId: 'rajma-curry',
    knownConfusions: ['chole', 'dal'],
    provenance: 'IFCT 2017 legume curry preparation range.',
  },
  {
    name: 'Chole (Chana Masala)',
    aliases: ['chole', 'chana masala', 'chickpea curry'],
    category: 'lentils',
    status: 'supported',
    identification: 'manual',
    dishId: 'chole-curry',
    knownConfusions: ['rajma', 'chana dal'],
    provenance: 'IFCT 2017 legume curry preparation range.',
  },
  // --- Curries ------------------------------------------------------------
  {
    name: 'Paneer Butter Masala',
    aliases: ['paneer', 'paneer butter masala', 'paneer curry', 'mutter paneer'],
    category: 'curry',
    status: 'supported',
    identification: 'manual',
    dishId: 'paneer-butter-masala',
    knownConfusions: ['shahi paneer', 'palak paneer'],
    provenance: 'Recipe-based range: IFCT 2017 paneer + tomato-cashew gravy.',
  },
  {
    name: 'Pav Bhaji',
    aliases: ['pav bhaji', 'bhaji'],
    category: 'curry',
    status: 'supported',
    identification: 'manual',
    dishId: 'pav-bhaji',
    knownConfusions: ['mashed vegetables'],
    provenance: 'IFCT 2017 street-food preparation approximation.',
  },
  // --- Snacks & fried -----------------------------------------------------
  {
    name: 'Samosa',
    aliases: ['samosa', 'singara'],
    category: 'snack',
    status: 'supported',
    identification: 'model-direct',
    dishId: 'samosa',
    knownConfusions: ['spring rolls', 'kachori', 'pakora'],
    provenance: 'IFCT 2017 deep-fried savoury snack range; Food-101 class "samosa".',
  },
  {
    name: 'Pakora / Pakoda',
    aliases: ['pakora', 'pakoda', 'bhajiya', 'fritters'],
    category: 'snack',
    status: 'supported',
    identification: 'manual',
    dishId: 'pakora',
    knownConfusions: ['samosa', 'bhaji', 'tempura'],
    provenance: 'Recipe-based range: IFCT 2017 gram-flour fritter.',
  },
  {
    name: 'Dhokla',
    aliases: ['dhokla', 'khaman'],
    category: 'snack',
    status: 'supported',
    identification: 'manual',
    dishId: 'dhokla',
    knownConfusions: ['idli', 'khaman dhokla'],
    provenance: 'IFCT 2017 fermented steamed snack approximation.',
  },
  // --- Noodles ------------------------------------------------------------
  {
    name: 'Chowmein',
    aliases: ['chowmein', 'chow mein', 'hakka noodles'],
    category: 'noodles',
    status: 'supported',
    identification: 'model-direct',
    dishId: 'chowmein',
    knownConfusions: ['hakka noodles', 'pad thai', 'lo mein'],
    provenance: 'IFCT 2017 fried noodle preparation range; Food-101 class "chow_mein".',
  },
  {
    name: 'Prepared Instant Noodles',
    aliases: ['maggi', 'instant noodles', 'masala noodles'],
    category: 'noodles',
    status: 'supported',
    identification: 'model-near',
    dishId: 'instant-noodles-cooked',
    knownConfusions: ['ramen', 'chowmein', 'schezwan noodles'],
    provenance: 'IFCT 2017 boiled-noodle approximation; near-mapped from Food-101 "ramen"/"pho".',
  },
  // --- Dumplings ----------------------------------------------------------
  {
    name: 'Steamed Momo',
    aliases: ['momo', 'momos', 'momo dumplings'],
    category: 'dumpling',
    status: 'supported',
    identification: 'model-near',
    dishId: 'momo-steamed',
    knownConfusions: ['gyoza', 'dumplings', 'modak'],
    provenance: 'IFCT 2017 steamed dumpling approximation; near-mapped from Food-101 "dumplings"/"gyoza".',
  },
  {
    name: 'Fried Momo',
    aliases: ['fried momo', 'kothey'],
    category: 'dumpling',
    status: 'supported',
    identification: 'manual',
    dishId: 'momo-fried',
    knownConfusions: ['steamed momo', 'gyoza'],
    provenance: 'Steamed-momo range + deep-fry adjustment.',
  },
  // --- Assamese & regional ------------------------------------------------
  {
    name: 'Pitha',
    aliases: ['pitha', 'til pitha', 'narikol pitha', 'ghila pitha', 'sunga pitha'],
    category: 'regional',
    region: 'Assam / Eastern India',
    status: 'dataset-ready',
    identification: 'manual',
    knownConfusions: ['modak', 'momo', 'steamed rice cake'],
    provenance:
      'No verified per-100g composition record for Assamese pitha varieties in IFCT 2017 — no nutrition estimate is provided. Dataset-ready class for the planned Indian-food model.',
  },
  {
    name: 'Jolpan',
    aliases: ['jolpan', 'komal Saul', 'xandoh', 'chira-doi-gur'],
    category: 'regional',
    region: 'Assam',
    status: 'dataset-ready',
    identification: 'manual',
    knownConfusions: ['poha', 'breakfast cereal'],
    provenance:
      'Composite Assamese breakfast; component-wise records exist but no single verified composite — estimate would require user confirmation of components. Dataset-ready.',
  },
  {
    name: 'Tenga',
    aliases: ['tenga', 'masor tenga', 'sour fish curry', 'tengi'],
    category: 'regional',
    region: 'Assam',
    status: 'dataset-ready',
    identification: 'manual',
    knownConfusions: ['fish curry', 'sour curry'],
    provenance:
      'No verified composition record; fish-based sour curries vary widely in fish, oil and thekera/lemon basis. Dataset-ready; nutrition only via manual entry.',
  },
  {
    name: 'Khar',
    aliases: ['khar', 'khar curry', 'raw papaya khar'],
    category: 'regional',
    region: 'Assam',
    status: 'dataset-ready',
    identification: 'manual',
    knownConfusions: ['dal', 'vegetable curry'],
    provenance:
      'Filtered-alkali preparation; no verified composition record (alkaline ash content is itself variable). Dataset-ready.',
  },
  // --- Sweets & beverages (registry entries; no bundled model class) ------
  {
    name: 'Indian Sweets (Mithai)',
    aliases: ['mithai', 'ladoo', 'barfi', 'jalebi', 'gulab jamun', 'rasgulla'],
    category: 'sweet',
    status: 'dataset-ready',
    identification: 'manual',
    knownConfusions: ['cake', 'donuts (Food-101 false friend)'],
    provenance:
      'Sugar and fat content varies 2x between varieties — a single record would mislead. Dataset-ready; manual entry only.',
  },
  {
    name: 'Chai',
    aliases: ['chai', 'masala chai', 'milk tea', 'tea'],
    category: 'beverage',
    status: 'dataset-ready',
    identification: 'manual',
    knownConfusions: ['coffee', 'milk'],
    provenance:
      'Sugar and milk quantity dominate and are invisible in photos; no verified standard record. Dataset-ready.',
  },
];

export function getRegistryClassesByCategory(cat: FoodCategory): IndianFoodClass[] {
  return INDIAN_FOOD_REGISTRY.filter((c) => c.category === cat);
}

export function getRegistryClassByName(name: string): IndianFoodClass | null {
  const q = (name || '').trim().toLowerCase();
  if (!q) return null;
  return (
    INDIAN_FOOD_REGISTRY.find(
      (c) => c.name.toLowerCase() === q || c.aliases.some((a) => a === q)
    ) || null
  );
}
