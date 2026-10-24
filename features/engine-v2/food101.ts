/**
 * Food-101 model vocabulary and the honest mapping from Food-101 classes to
 * NutriLens dish database entries.
 *
 * The model (MobileNetV2, see docs/food101-model.md) is trained on Food-101.
 * Food-101 is largely Western + some Asian dishes; Indian staples like dal,
 * rajma or idli have NO class in it. The mapping below is deliberately
 * CURATED: only classes that correspond to (or are close nutritional
 * relatives of) a dish in our database are mapped. Everything else maps to
 * null — the UI then says the model saw a dish we do not know yet and the
 * user picks manually. We never stretch a class into a wrong dish.
 *
 * kind:
 *  - 'direct': the Food-101 class IS the dish (e.g. samosa).
 *  - 'near':   same dish family; the dish's nutrition is a reasonable
 *              estimate, and the UI shows a note asking the user to confirm.
 */

export const FOOD_101_CLASSES: readonly string[] = [
  'apple_pie', 'baby_back_ribs', 'baklava', 'beef_carpaccio', 'beef_tartare', 'beet_salad', 'beignets',
  'bibimbap', 'bread_pudding', 'breakfast_burrito', 'bruschetta', 'caesar_salad', 'cannoli', 'caprese_salad',
  'carrot_cake', 'ceviche', 'cheesecake', 'cheese_plate', 'chicken_curry', 'chicken_quesadilla', 'chicken_wings',
  'chocolate_cake', 'chocolate_mousse', 'churros', 'clam_chowder', 'club_sandwich', 'crab_cakes', 'creme_brulee',
  'croque_madame', 'cup_cakes', 'deviled_eggs', 'donuts', 'dumplings', 'edamame', 'eggs_benedict', 'escargots',
  'falafel', 'filet_mignon', 'fish_and_chips', 'foie_gras', 'french_fries', 'french_onion_soup', 'french_toast',
  'fried_calamari', 'fried_rice', 'frozen_yogurt', 'garlic_bread', 'gnocchi', 'greek_salad',
  'grilled_cheese_sandwich', 'grilled_salmon', 'guacamole', 'gyoza', 'hamburger', 'hot_and_sour_soup', 'hot_dog',
  'huevos_rancheros', 'hummus', 'ice_cream', 'lasagna', 'lobster_bisque', 'lobster_roll_sandwich',
  'macaroni_and_cheese', 'macarons', 'miso_soup', 'mussels', 'nachos', 'omelette', 'onion_rings', 'oysters',
  'pad_thai', 'paella', 'pancakes', 'panna_cotta', 'peking_duck', 'pho', 'pizza', 'pork_chop', 'poutine',
  'prime_rib', 'pulled_pork_sandwich', 'ramen', 'ravioli', 'red_velvet_cake', 'risotto', 'samosa', 'sashimi',
  'scallops', 'seaweed_salad', 'shrimp_and_grits', 'spaghetti_bolognese', 'spaghetti_carbonara', 'spring_rolls',
  'steak', 'strawberry_shortcake', 'sushi', 'tacos', 'takoyaki', 'tiramisu', 'tuna_tartare', 'waffles',
];

export interface Food101Mapping {
  dishId: string;
  /** What the UI should call the model's observation, e.g. "dumplings (gyoza)". */
  observedName: string;
  kind: 'direct' | 'near';
  note?: string;
}

const M: Record<string, Food101Mapping> = {
  samosa: { dishId: 'samosa', observedName: 'samosa', kind: 'direct' },
  chow_mein: { dishId: 'chowmein', observedName: 'chow mein', kind: 'direct' },
  dumplings: {
    dishId: 'momo-steamed',
    observedName: 'dumplings',
    kind: 'near',
    note: 'The model sees dumplings — momo is our closest dish. Confirm and adjust the filling.',
  },
  gyoza: {
    dishId: 'momo-steamed',
    observedName: 'gyoza',
    kind: 'near',
    note: 'The model sees gyoza — momo is our closest dish. Confirm and adjust the filling.',
  },
  fried_rice: {
    dishId: 'plain-rice',
    observedName: 'fried rice',
    kind: 'near',
    note: 'The model sees fried rice — our closest entry is steamed rice; fried rice carries extra oil (~100–150 kcal per serving).',
  },
  ramen: {
    dishId: 'instant-noodles-cooked',
    observedName: 'ramen noodles',
    kind: 'near',
    note: 'The model sees a noodle-soup bowl — our closest entry is prepared instant noodles.',
  },
  pho: {
    dishId: 'instant-noodles-cooked',
    observedName: 'pho / rice noodle soup',
    kind: 'near',
    note: 'The model sees a rice-noodle soup — our closest entry is prepared instant noodles.',
  },
  spring_rolls: {
    dishId: 'samosa',
    observedName: 'spring rolls',
    kind: 'near',
    note: 'The model sees fried spring rolls — samosa is our closest dish nutritionally (fried pastry with savoury filling).',
  },
  // Added in 2.4 after the real-image evaluation (docs/real-image-eval-2.4.md):
  // Indian street chow mein photos frequently score as pad_thai. Pad thai is a
  // stir-fried noodle dish; chowmein is our closest dish family. Near-mapping
  // rules apply: user confirmation required, oil/sauce flagged as unknown.
  pad_thai: {
    dishId: 'chowmein',
    observedName: 'pad thai / stir-fried noodles',
    kind: 'near',
    note: 'The model sees stir-fried noodles — our closest entry is chowmein; sauce and oil quantity still need your confirmation.',
  },
};

export function mapFood101Class(cls: string): Food101Mapping | null {
  return M[cls] ?? null;
}

/** Human-readable label for a raw Food-101 class ("chow_mein" -> "chow mein"). */
export function humanizeFood101(cls: string): string {
  return cls.replace(/_/g, ' ');
}
