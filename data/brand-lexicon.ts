/**
 * Brand & Product Name Lexicon
 *
 * A small, deterministic, offline lexicon of common packaged-food brands
 * (India + global) used by the OCR fallback pipeline to recognize the
 * brand printed on a package. The OCR text must contain evidence of the
 * brand for it to be used — nothing is ever invented from the filename.
 *
 * Privacy-first: this is a static list bundled with the app. No network
 * calls, no database, no cloud lookups.
 */

export interface BrandEntry {
  /** Canonical display name, e.g. "Maggi" */
  display: string;
  /** Lowercase aliases matched against OCR text (whole word). */
  aliases: string[];
}

export const BRAND_LEXICON: BrandEntry[] = [
  { display: 'Maggi', aliases: ['maggi'] },
  { display: 'Nestlé', aliases: ['nestle', 'nestlé', 'nestea'] },
  { display: 'Britannia', aliases: ['britannia'] },
  { display: "Haldiram's", aliases: ['haldiram', 'haldirams', "haldiram's"] },
  { display: 'Bikaji', aliases: ['bikaji', 'bikaner'] },
  { display: 'Parle', aliases: ['parle', 'parle-g', 'parle g'] },
  { display: 'Kurkure', aliases: ['kurkure'] },
  { display: 'Lays', aliases: ["lay's", 'lays'] },
  { display: 'Uncle Chips', aliases: ['uncle chips', 'unclechipps'] },
  { display: 'Bingo', aliases: ['bingo'] },
  { display: 'Too Yumm', aliases: ['too yumm'] },
  { display: 'Amul', aliases: ['amul'] },
  { display: 'Tata', aliases: ['tata'] },
  { display: 'Dabur', aliases: ['dabur'] },
  { display: 'Patanjali', aliases: ['patanjali'] },
  { display: 'Cadbury', aliases: ['cadbury', 'dairy milk'] },
  { display: 'Pepsi', aliases: ['pepsi'] },
  { display: 'Coca-Cola', aliases: ['coca cola', 'coca-cola', 'coke'] },
  { display: 'Sprite', aliases: ['sprite'] },
  { display: 'Fanta', aliases: ['fanta'] },
  { display: 'Mirinda', aliases: ['mirinda'] },
  { display: 'Frooti', aliases: ['frooti'] },
  { display: 'Real', aliases: ['real juice'] },
  { display: 'Tropicana', aliases: ['tropicana'] },
  { display: 'Maaza', aliases: ['maaza'] },
  { display: 'Slice', aliases: ['slice'] },
  { display: 'Horlicks', aliases: ['horlicks'] },
  { display: 'Bournvita', aliases: ['bournvita'] },
  { display: 'Complan', aliases: ['complan'] },
  { display: 'Boost', aliases: ['boost'] },
  { display: 'Milo', aliases: ['milo'] },
  { display: 'Kellogg', aliases: ['kellogg', "kellogg's"] },
  { display: 'Quaker', aliases: ['quaker'] },
  { display: 'Nescafé', aliases: ['nescafe', 'nescafé'] },
  { display: 'Bru', aliases: ['bru'] },
  { display: 'Tata Tea', aliases: ['tata tea'] },
  { display: 'MDH', aliases: ['mdh'] },
  { display: 'Everest', aliases: ['everest'] },
  { display: 'Aashirvaad', aliases: ['aashirvaad', 'ashirvaad'] },
  { display: 'Fortune', aliases: ['fortune'] },
  { display: 'Saffola', aliases: ['saffola'] },
  { display: 'Sunfeast', aliases: ['sunfeast'] },
  { display: 'Yippee', aliases: ['yippee', 'yippee!'] },
  { display: 'Top Ramen', aliases: ['top ramen'] },
  { display: 'Ching\u2019s Secret', aliases: ["ching's secret", 'chings secret'] },
  { display: 'Knorr', aliases: ['knorr'] },
  { display: 'Kissan', aliases: ['kissan'] },
  { display: 'Lipton', aliases: ['lipton'] },
  { display: 'Oreo', aliases: ['oreo'] },
  { display: 'Hide & Seek', aliases: ['hide & seek', 'hide and seek'] },
  { display: 'Marie Gold', aliases: ['marie gold', 'mariegold'] },
  { display: 'Good Day', aliases: ['good day'] },
  { display: 'Moms Magic', aliases: ["mom's magic", 'moms magic'] },
  { display: 'NutriChoice', aliases: ['nutri choice', 'nutrichoice'] },
  { display: 'Pringles', aliases: ['pringles'] },
  { display: 'Cheetos', aliases: ['cheetos'] },
  { display: 'Doritos', aliases: ['doritos'] },
  { display: 'Danone', aliases: ['danone'] },
  { display: 'Yakult', aliases: ['yakult'] },
  { display: 'Mother Dairy', aliases: ['mother dairy'] },
  { display: 'Saras', aliases: ['saras'] },
  { display: 'Verka', aliases: ['verka'] },
  { display: 'Nandini', aliases: ['nandini'] },
  { display: 'Amul Kool', aliases: ['amul kool'] },
  { display: 'Hershey\u2019s', aliases: ["hershey's", 'hersheys'] },
  { display: 'Perfetti', aliases: ['perfetti', 'mentos', 'alpenliebe', 'center fresh', 'centrefresh'] },
  { display: 'Wrigley', aliases: ['wrigley', 'boomer', 'orbit', 'doublemint', 'juicy fruit'] },
  { display: 'Lotte', aliases: ['lotte', 'choconut', 'choco pie'] },
  { display: 'Campa', aliases: ['campa'] },
  { display: 'Bisléri', aliases: ['bisleri'] },
  { display: 'Kinley', aliases: ['kinley'] },
  { display: 'Aquafina', aliases: ['aquafina'] },
  { display: 'Vedica', aliases: ['vedica'] },
  { display: 'Himalaya', aliases: ['himalaya', 'himalayan'] },
  { display: 'Boroline', aliases: ['boroline'] },
  { display: 'Colgate', aliases: ['colgate'] },
  { display: 'PepsiCo', aliases: ['pepsico'] },
];

/** Generic product-type words used to recognize a likely product name line. */
export const PRODUCT_TYPE_WORDS = [
  'noodle', 'noodles', 'masala', 'bhujia', 'namkeen', 'sev', 'chips', 'crisps',
  'biscuit', 'biscuits', 'cookie', 'cookies', 'cake', 'rusk', 'toast', 'bread',
  'chocolate', 'candy', 'toffee', 'gum', 'lozenge', 'juice', 'drink', 'beverage',
  'soda', 'cola', 'water', 'milk', 'shake', 'lassi', 'chaas', 'tea', 'coffee',
  'cereal', 'muesli', 'oats', 'cornflakes', 'corn flakes', 'porridge',
  'pickle', 'achar', 'jam', 'sauce', 'ketchup', 'spread', 'honey',
  'ghee', 'oil', 'atta', 'flour', 'rice', 'dal', 'pulses', 'pappad',
  'soup', 'pasta', 'macaroni', 'vermicelli', 'upma', 'poha', 'idli',
  'ice cream', 'kulfi', 'yoghurt', 'yogurt', 'curd', 'paneer', 'cheese',
  'butter', 'namkin', 'khakhra', 'thepla', 'bhel', 'mixture', 'chivda',
  'wafer', 'wafers', 'snack', 'balls', 'sticks', 'rings', 'puffs',
];
