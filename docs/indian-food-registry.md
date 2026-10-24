# Indian-food intelligence registry (v2.3)

This document is the human-readable companion to
`features/engine-v2/indian-food-registry.ts` (registry version **2.3.0**).

## What NutriLens 2.3 can honestly do

| Capability | Status |
| --- | --- |
| Packaged-food OCR, barcode + Open Food Facts | Preserved from v2.2, unchanged |
| On-device dish recognition (Food-101 model, no keys) | Bundled and verified (3-decimal parity, 6 real photos) |
| Indian-dish coverage | 21 dish records with sourced per-100 g ranges; 11 category groups |
| Assamese foods (pitha, jolpan, tenga, khar) | Registered as **dataset-ready**: recognized concepts, NO nutrition estimates (no verified composition records exist) |
| Indian-food recognition model | **Not shipped.** No verified-licence, independently evaluated model existed; see below |

## Why no Indian-food model ships in 2.3

We surveyed available options and none could be legally and honestly shipped:

- **Kaggle "Indian Food Images Dataset"** (80 classes): scraped images, licence
  does not clearly permit redistributing trained weights; no held-out
  evaluation.
- **Khana** (research cuisine dataset): academic licence must be reviewed first.
- **Hugging Face food classifiers**: Food-101-derived — they contain no dal,
  dosa, idli, biryani or paneer classes, so renaming labels would be fake
  "Indian specialisation".

Per project policy, we ship **no model file rather than an unverifiable one**.
The reproducible path forward is `training/indian-food/` (dataset licence gate,
leak-safe splits, training, held-out evaluation with confusion matrix, ONNX
export with parity check). When that pipeline produces an evaluated model, the
`indian-food` entry in `features/engine-v2/model-registry.ts` becomes
`bundled` with its own version, and the browser pipeline needs no other
change — cache invalidation is automatic because cache keys derive from the
model version.

## Dish coverage (21 records, per-100 g ranges)

| Category | Dishes |
| --- | --- |
| Rice & rice-based | Steamed Rice*, Veg Biryani / Pulao |
| Indian breads | Chapati / Roti, Poori, Aloo Paratha |
| Breakfast | Idli, Plain Dosa, Poha, Upma |
| Lentils & pulses | Dal Fry / Dal Tadka, Rajma, Chole |
| Curries & gravies | Paneer Butter Masala, Pav Bhaji |
| Snacks & fried | Samosa*, Pakora, Dhokla |
| Noodles & Indo-Chinese | Chowmein*, Prepared Instant Noodles* |
| Dumplings & momo | Steamed Momo*, Fried Momo |

`*` = reachable today through the bundled model (direct or near-mapping with
user confirmation). All others are identified by manual selection (searchable,
category-grouped picker) — honest identification, no fake automation.

Sweets, beverages and Assamese/regional dishes (pitha, jolpan, tenga, khar)
are registered with **status `dataset-ready`**: the app knows they exist,
shows them in the picker context, but provides **no nutrition estimate** and
asks for manual entry instead.

## Nutrition data provenance

Every record cites its source in `nutrition.source`:

- **IFCT 2017** (Indian Food Composition Tables, ICMR-NIN) for standard
  preparations (rice, chapati, idli, dosa, dal).
- **Recipe-based estimates** built on IFCT component values where no direct
  dish record exists (poha, upma, paneer butter masala, biryani); labelled as
  estimates with deliberately wide ranges.
- Values are **ranges, never points**; the estimator propagates the range, so
  the report shows e.g. "150–230 kcal", not false precision.

Missing values stay `null`; nothing is ever silently zero. The app never
presents these reference values as measurements of the user's actual plate.

## Evidence model (used everywhere)

Every ingredient/nutrition item carries one of:

- **visual / user-provided** — seen or confirmed in the review screen.
- **typical** — expected for the dish, not observed (badged).
- **unknown** — a photo cannot reveal it (oil, salt, hidden filling); listed
  for the user to confirm or leave open.

Model outputs are labelled **model scores**, explicitly not calibrated
probabilities (`features/engine-v2/confidence-policy.ts`, tested).
