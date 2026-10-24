/**
 * Versioned recognition-model registry (v2.3).
 *
 * Every recognition model NutriLens can use is declared here with its
 * version, provenance, preprocessing contract and class mapping. The
 * registry is the single source of truth for:
 *  - model asset URLs (always relative to the app base path),
 *  - Cache-API keys (derived from the version, so bumping `version`
 *    automatically invalidates every previously cached copy),
 *  - what each model can honestly recognize.
 *
 * The only BUNDLED model today is the Food-101 MobileNetV2 (v2.2 pipeline).
 * The `indian-food` entry documents the planned v2.3+ model — it is NOT
 * downloadable yet: no verified-licence, independently evaluated Indian-food
 * model existed at release time (see docs/indian-food-registry.md and
 * training/indian-food/README.md). Shipping a fake or unverified model file
 * is forbidden; the entry exists so the pipeline, cache and UI are
 * dataset-ready the moment a validated model exists.
 */

export const MODEL_CACHE_PREFIX = 'nutrilens-model-v';

export interface PreprocessingSpec {
  /** Model input tensor shape. */
  inputShape: [number, number, number, number]; // [N, C, H, W]
  /** Resize policy. */
  resize: { longestSide: number; crop: number };
  /** Per-channel mean/std used for normalization (RGB order). */
  mean: [number, number, number];
  std: [number, number, number];
}

export type ModelStatus = 'bundled' | 'planned';

export interface RecognitionModelEntry {
  id: string;
  /** Semantic version of the model AS SHIPPED (bump = cache invalidation). */
  version: string;
  label: string;
  status: ModelStatus;
  /** Path under the app base path (no leading base path). */
  assetPath: string | null;
  approximateBytes: number;
  /** Where the weights came from + licence. */
  provenance: string;
  licence: string;
  /** Number of output classes. */
  classCount: number;
  /** Which class-vocabulary module describes the outputs. */
  classVocabulary: string;
  preprocessing: PreprocessingSpec;
  /** Known, documented limitations — shown in UI/docs, never hidden. */
  limitations: string[];
}

export const PREPROCESSING_IMAGENET: PreprocessingSpec = {
  inputShape: [1, 3, 224, 224],
  resize: { longestSide: 256, crop: 224 },
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
};

export const MODEL_REGISTRY: RecognitionModelEntry[] = [
  {
    id: 'food101-mobilenetv2',
    version: '2.2.0',
    label: 'Food-101 dish recognition (on-device)',
    status: 'bundled',
    assetPath: '/models/food101-mobilenetv2.onnx',
    approximateBytes: 9385782,
    provenance:
      'MobileNetV2 fine-tuned on Food-101 from the AlexKoff88/mobilenet_v2_food101 PyTorch checkpoint (Hugging Face), exported to ONNX opset 13 fp32 by us after proving the upstream ONNX file produced all-zero outputs. Parity with PyTorch verified to 3 decimals.',
    licence: 'Apache-2.0 (weights); Food-101 dataset (MIT licence). No dataset images redistributed.',
    classCount: 101,
    classVocabulary: 'features/engine-v2/food101.ts (FOOD_101_CLASSES)',
    preprocessing: PREPROCESSING_IMAGENET,
    limitations: [
      'No classes for most Indian staples (dal, dosa, idli, curry, biryani, paneer) — those honestly return "no confident match" and the user picks the dish.',
      'Author-reported top-1 accuracy 76.35% on Food-101 test data; the model score is NOT a calibrated probability.',
      'Cannot detect ingredients, portion weight, oil or salt from pixels.',
    ],
  },
  {
    id: 'indian-food',
    version: '0.0.0',
    label: 'Indian-food classifier (planned — not yet available)',
    status: 'planned',
    assetPath: null,
    approximateBytes: 0,
    provenance:
      'No verified-licence, independently evaluated Indian-food model was available at v2.3 release. Candidate datasets (Kaggle "Indian Food Images", 80 classes; "Khana" research dataset) have unclear image-scraping licences, so their weights may not be legally redistributable. A reproducible training/export pipeline is provided in training/indian-food/.',
    licence: 'Undetermined — must be verified before any weights ship.',
    classCount: 0,
    classVocabulary: 'features/engine-v2/indian-food-registry.ts (target vocabulary)',
    preprocessing: PREPROCESSING_IMAGENET,
    limitations: [
      'Planned model: not downloadable, never referenced by the running pipeline.',
      'Target classes are tracked in the Indian-food registry with status "dataset-ready".',
    ],
  },
];

export function getBundledModel(): RecognitionModelEntry {
  const bundled = MODEL_REGISTRY.filter((m) => m.status === 'bundled');
  if (bundled.length !== 1) {
    throw new Error('Registry invariant violated: exactly one bundled model is required.');
  }
  return bundled[0];
}

/** Cache key for a model asset — includes the model version by design. */
export function modelCacheKey(entry: Pick<RecognitionModelEntry, 'id' | 'version'>): string {
  return `${entry.id}-v${entry.version}.onnx`;
}

/** Cache-API store name — bump when the storage SCHEME changes. */
export function modelCacheStore(): string {
  return `${MODEL_CACHE_PREFIX}1`;
}
