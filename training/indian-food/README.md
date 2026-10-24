# Indian-food recognition model — reproducible training pipeline

**Status: NOT TRAINED.** No training was executed and no weights ship with
NutriLens 2.3. This directory is the dataset-ready, reproducible pipeline that
produces the planned `indian-food` recognition model (registry entry
`indian-food`, `training/indian-food/`, `features/engine-v2/indian-food-registry.ts`).

## Why no model ships yet

At v2.3 release there is no verified-licence, independently evaluated
Indian-food classifier we could legally redistribute and honestly evaluate:

- Kaggle "Indian Food Images Dataset" (80 classes, ~4000+ images): images are
  scraped; the dataset licence does not clearly permit redistribution of
  derived model weights, and no held-out evaluation exists.
- "Khana" (research Indian-cuisine dataset): academic release, licence terms
  must be reviewed before use.
- Hugging Face food classifiers: Food-101-derived (same blind spots: no dal,
  dosa, idli, biryani, paneer classes) — renaming classes would be dishonest
  specialisation.

NutriLens therefore ships the verified Food-101 model only, and this pipeline
is the honest path to an Indian-food model.

## Target vocabulary

`features/engine-v2/indian-food-registry.ts` (version 2.3.0). Classes marked
`dataset-ready` (pitha, jolpan, tenga, khar, mithai, chai) and the
`manual`-identification dishes (dal, dosa, idli, chapati, biryani, paneer,
pakora, poha, upma, poori) are the target classes. Keep visually
indistinguishable pairs (e.g. poha/upma) as separate classes only if the
dataset supports the split — otherwise merge and document it.

## Steps (run outside GitHub Pages — training needs a GPU workstation)

1. **Assemble the dataset** (script: `prepare_dataset.py`)
   - Start from an image dataset you have the RIGHT to use for training
     AND for redistributing trained weights (check the licence!). For each
     class in the registry, aim for ≥150 train + 30 val + 30 test images.
   - Enforce a clean split: no near-duplicate frames across splits (hash +
     perceptual-hash dedupe) to avoid data leakage.
   - Record per-class counts in `dataset-manifest.json`.
2. **Train** (`train.py`)
   - MobileNetV2 (ImageNet pre-trained) transfer learning, 224×224 inputs,
     torchvision preprocessing (Resize 256 / CenterCrop 224 / ImageNet
     mean-std) — identical to `features/engine-v2/model-registry.ts`
     PREPROCESSING_IMAGENET so the browser contract stays unchanged.
   - Fine-tune, track best top-1 on the VALIDATION split only.
3. **Evaluate** (`evaluate.py`)
   - On the held-out test split: top-1, top-3, per-class precision/recall and
     a confusion matrix, saved to `metrics.json`. These are the ONLY numbers
     that may be quoted — never validation accuracy, never a guess.
4. **Export** (`export_onnx.py`)
   - ONNX opset 13, fp32 first; quantize to int8 only if evaluation of the
     QUANTIZED model stays within 1 point of top-1 (we rejected int8 for
     Food-101 at v2.2 because it was not).
   - Verify parity: same image, PyTorch vs ONNX logits within 1e-3.
5. **Ship**
   - Add the file under `public/models/`, add a `bundled` entry to
     `MODEL_REGISTRY` with its own version (cache invalidation is automatic
     — keys derive from `modelCacheKey`), write the class vocabulary module,
     and map classes honestly in the same style as `food101.ts`.
