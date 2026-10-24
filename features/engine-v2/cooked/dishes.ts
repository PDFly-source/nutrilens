/**
 * Curated cooked-dish table (v2).
 *
 * Values are approximate per-100g reference ranges compiled from public
 * composition references (IFCT 2017 / USDA FDC style values for common
 * preparations). They are RANGES on purpose: home preparations vary widely.
 * Every estimate derived from this table is labelled ai_estimated with the
 * source string attached — the app never presents these as measurements.
 */

import { DishDefinition } from '../types';

export const DISH_DATABASE: DishDefinition[] = [
  {
    id: 'momo-steamed',
    name: 'Steamed Momo (Vegetable)',
    aliases: ['momo', 'momos', 'dumpling', 'dumplings', 'steamed momo'],
    category: 'dumpling',
    pieceWeightMinG: 18,
    pieceWeightMaxG: 30,
    typicalServeMinG: 150,
    typicalServeMaxG: 250,
    cookingMethod: 'steamed',
    typicalVisible: ['wheat wrapper', 'vegetable filling visible at edges'],
    typicalHidden: ['exact filling ratio', 'oil in filling', 'salt content'],
    nutrition: {
      kcalPer100gMin: 150, kcalPer100gMax: 200,
      proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 4,
      fiberPer100g: 2.5,
      sodiumMgPer100gMin: 300, sodiumMgPer100gMax: 550,
      source: 'IFCT 2017 approximations (steamed dumplings, veg)',
    },
  },
  {
    id: 'momo-fried',
    name: 'Fried Momo',
    aliases: ['fried momo', 'pan fried momo', 'kothey'],
    category: 'dumpling',
    pieceWeightMinG: 20,
    pieceWeightMaxG: 32,
    typicalServeMinG: 150,
    typicalServeMaxG: 250,
    cookingMethod: 'fried',
    typicalVisible: ['golden brown wrapper', 'crisped surface'],
    typicalHidden: ['oil absorbed', 'filling', 'sodium'],
    nutrition: {
      kcalPer100gMin: 220, kcalPer100gMax: 300,
      proteinPer100g: 6, carbsPer100g: 25, fatPer100g: 10,
      fiberPer100g: 2,
      sodiumMgPer100gMin: 320, sodiumMgPer100gMax: 600,
      source: 'IFCT 2017 approximations + fried-preparation adjustment',
    },
  },
  {
    id: 'samosa',
    name: 'Samosa',
    aliases: ['samosa', 'samosas', 'singara'],
    category: 'fried_snack',
    pieceWeightMinG: 35,
    pieceWeightMaxG: 60,
    typicalServeMinG: 70,
    typicalServeMaxG: 180,
    cookingMethod: 'deep_fried',
    typicalVisible: ['fried pastry shell', 'possible potato filling'],
    typicalHidden: ['actual filling', 'oil absorption', 'salt in filling'],
    nutrition: {
      kcalPer100gMin: 250, kcalPer100gMax: 350,
      proteinPer100g: 4, carbsPer100g: 35, fatPer100g: 14,
      fiberPer100g: 3,
      sodiumMgPer100gMin: 350, sodiumMgPer100gMax: 650,
      source: 'IFCT 2017 approximations (deep-fried savoury snack)',
    },
  },
  {
    id: 'chowmein',
    name: 'Chowmein (Vegetable Noodles)',
    aliases: ['chowmein', 'chow mein', 'hakka noodles', 'veg noodles', 'stir fried noodles'],
    category: 'noodles',
    typicalServeMinG: 200,
    typicalServeMaxG: 350,
    cookingMethod: 'mixed',
    typicalVisible: ['noodles', 'visible vegetables', 'possible soy sauce glaze'],
    typicalHidden: ['oil quantity', 'sauce sodium', 'added MSG'],
    nutrition: {
      kcalPer100gMin: 130, kcalPer100gMax: 190,
      proteinPer100g: 4.5, carbsPer100g: 22, fatPer100g: 5,
      fiberPer100g: 2,
      sodiumMgPer100gMin: 350, sodiumMgPer100gMax: 700,
      source: 'IFCT 2017 approximations (fried mixed noodle preparations)',
    },
  },
  {
    id: 'instant-noodles-cooked',
    name: 'Prepared Instant Noodles',
    aliases: ['instant noodles', 'maggi', '2 minute noodles', 'cooked noodles', 'masala noodles'],
    category: 'noodles',
    typicalServeMinG: 250,
    typicalServeMaxG: 320,
    cookingMethod: 'boiled',
    typicalVisible: ['noodles', 'masala broth or coating', 'possible vegetables'],
    typicalHidden: ['tastemaker sodium', 'oil', 'exact water content'],
    nutrition: {
      kcalPer100gMin: 110, kcalPer100gMax: 160,
      proteinPer100g: 3.5, carbsPer100g: 17, fatPer100g: 4,
      fiberPer100g: 1.2,
      sodiumMgPer100gMin: 380, sodiumMgPer100gMax: 620,
      source: 'IFCT 2017 approximations (boiled instant noodles, drained)',
    },
  },
  {
    id: 'plain-rice',
    name: 'Steamed Rice',
    aliases: ['rice', 'steamed rice', 'chawal', 'bhat', 'white rice'],
    category: 'rice',
    typicalServeMinG: 150,
    typicalServeMaxG: 250,
    cookingMethod: 'boiled',
    typicalVisible: ['cooked rice grains'],
    typicalHidden: ['oil or salt added', 'rice variety'],
    nutrition: {
      kcalPer100gMin: 110, kcalPer100gMax: 140,
      proteinPer100g: 2.7, carbsPer100g: 25, fatPer100g: 0.4,
      fiberPer100g: 0.4,
      sodiumMgPer100gMin: 1, sodiumMgPer100gMax: 10,
      source: 'IFCT 2017 (cooked milled rice)',
    },
  },
  {
    id: 'rajma-curry',
    name: 'Rajma (Kidney Bean Curry)',
    aliases: ['rajma', 'rajma masala', 'kidney beans', 'bean curry'],
    category: 'curry',
    typicalServeMinG: 150,
    typicalServeMaxG: 250,
    cookingMethod: 'boiled',
    typicalVisible: ['red kidney beans', 'gravy'],
    typicalHidden: ['oil in tadka', 'salt', 'sugar in gravy'],
    nutrition: {
      kcalPer100gMin: 110, kcalPer100gMax: 165,
      proteinPer100g: 6.5, carbsPer100g: 16, fatPer100g: 4,
      fiberPer100g: 5,
      sodiumMgPer100gMin: 250, sodiumMgPer100gMax: 550,
      source: 'IFCT 2017 approximations (legume curry preparation)',
    },
  },
  {
    id: 'chole-curry',
    name: 'Chole (Chana Masala)',
    aliases: ['chole', 'chana masala', 'chickpea curry', 'chickpeas'],
    category: 'curry',
    typicalServeMinG: 150,
    typicalServeMaxG: 250,
    cookingMethod: 'boiled',
    typicalVisible: ['chickpeas', 'gravy', 'possible garnish'],
    typicalHidden: ['oil', 'salt', 'added sugar'],
    nutrition: {
      kcalPer100gMin: 120, kcalPer100gMax: 180,
      proteinPer100g: 6, carbsPer100g: 18, fatPer100g: 4.5,
      fiberPer100g: 5,
      sodiumMgPer100gMin: 280, sodiumMgPer100gMax: 600,
      source: 'IFCT 2017 approximations (legume curry preparation)',
    },
  },
  {
    id: 'aloo-paratha',
    name: 'Aloo Paratha',
    aliases: ['aloo paratha', 'paratha', 'stuffed flatbread'],
    category: 'bread',
    pieceWeightMinG: 90,
    pieceWeightMaxG: 140,
    typicalServeMinG: 90,
    typicalServeMaxG: 280,
    cookingMethod: 'mixed',
    typicalVisible: ['flatbread', 'possible ghee/butter sheen'],
    typicalHidden: ['stuffing ratio', 'ghee quantity', 'salt'],
    nutrition: {
      kcalPer100gMin: 230, kcalPer100gMax: 320,
      proteinPer100g: 6, carbsPer100g: 40, fatPer100g: 9,
      fiberPer100g: 3,
      sodiumMgPer100gMin: 300, sodiumMgPer100gMax: 550,
      source: 'IFCT 2017 approximations (stuffed fried flatbread)',
    },
  },
  {
    id: 'pav-bhaji',
    name: 'Pav Bhaji',
    aliases: ['pav bhaji', 'bhaji pav'],
    category: 'mixed',
    typicalServeMinG: 300,
    typicalServeMaxG: 450,
    cookingMethod: 'mixed',
    typicalVisible: ['mashed vegetable bhaji', 'buttered bun (pav)'],
    typicalHidden: ['butter quantity', 'salt', 'pav count'],
    nutrition: {
      kcalPer100gMin: 130, kcalPer100gMax: 190,
      proteinPer100g: 3.5, carbsPer100g: 20, fatPer100g: 6,
      fiberPer100g: 3.5,
      sodiumMgPer100gMin: 380, sodiumMgPer100gMax: 700,
      source: 'IFCT 2017 approximations (mixed street-food preparation)',
    },
  },
  {
    id: 'dhokla',
    name: 'Dhokla',
    aliases: ['dhokla', 'khaman dhokla', 'steamed snack'],
    category: 'snack',
    typicalServeMinG: 100,
    typicalServeMaxG: 200,
    cookingMethod: 'steamed',
    typicalVisible: ['spongy cake texture', 'possible tempering/mustard seeds'],
    typicalHidden: ['oil in tempering', 'sugar in batter', 'salt'],
    nutrition: {
      kcalPer100gMin: 140, kcalPer100gMax: 190,
      proteinPer100g: 6, carbsPer100g: 24, fatPer100g: 3.5,
      fiberPer100g: 2.5,
      sodiumMgPer100gMin: 300, sodiumMgPer100gMax: 550,
      source: 'IFCT 2017 approximations (fermented steamed snack)',
    },
  },
  {
    id: 'dal-fry',
    name: 'Dal Fry / Dal Tadka',
    aliases: ['dal', 'dal fry', 'dal tadka', 'lentil curry'],
    category: 'curry',
    typicalServeMinG: 150,
    typicalServeMaxG: 250,
    cookingMethod: 'boiled',
    typicalVisible: ['yellow lentil curry', 'tempering on top'],
    typicalHidden: ['ghee/oil in tadka', 'salt'],
    nutrition: {
      kcalPer100gMin: 90, kcalPer100gMax: 140,
      proteinPer100g: 5.5, carbsPer100g: 12, fatPer100g: 3.5,
      fiberPer100g: 3.5,
      sodiumMgPer100gMin: 250, sodiumMgPer100gMax: 500,
      source: 'IFCT 2017 approximations (cooked lentil preparations)',
    },
  },
];

/** Find dishes matching a free-text dish name (user input or vision output). */
export function findDishes(query: string): DishDefinition[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const scored = DISH_DATABASE.map((d) => {
    let score = 0;
    if (d.name.toLowerCase().includes(q)) score += 3;
    for (const alias of d.aliases) {
      if (q.includes(alias)) score += 3;
      else if (alias.includes(q) && q.length >= 3) score += 2;
    }
    for (const w of d.name.toLowerCase().split(/\s+/)) {
      if (w.length >= 3 && q.includes(w)) score += 1;
    }
    return { d, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.d);
}

export function getDishById(id: string): DishDefinition | null {
  return DISH_DATABASE.find((d) => d.id === id) || null;
}
