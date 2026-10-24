# Indian-food model & dataset audit — v2.4

Question: **can a verified-licence, independently measurable Indian-food
model be shipped in 2.4?** Audited October 2026, evidence-linked.

## Candidates examined

| Candidate | Classes | Data source | Licence verdict | Shipped? |
| --- | --- | --- | --- | --- |
| Kaggle `l33tc0d3r/indian-food-classification` → HF `rajistics/indian_food_images` | 20 (incl. burger, pizza — not all Indian) | Stated on the dataset card: "All the images are extracted from google" | **No licence declared**; images are scraped copyrighted photos. Redistribution of derived weights is not verifiable. | No |
| Kaggle `iamsouravbanerjee/indian-food-images-dataset` (80 classes) and its HF mirrors | 80 | Web-scraped food photos | No image-level rights; dataset page licence does not establish third-party photo rights | No |
| HF `dima806/indian_food_image_detection` | 80 | Kaggle 80-class set above; "75% accuracy for a validation dataset" (validation ≠ held-out test) | Same tainted training data | No |
| HF `DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3` | ~20 | Model card is an unmodified auto-generated template (claims training on "Human_Action_Recognition") | Unreliable provenance, unverifiable | No |
| HF `Amrrs/indian-foods`, `south-indian-foods`, `mindflayer/south-indian-foods` | small, south-Indian subsets | Derived from the same scraped sets | Same | No |
| Food-101 (bundled, v2.2) | 101 | MIT licence; we verified the export ourselves | **Verified** | **Yes (fallback)** |

## Decision

**No new model ships in 2.4.** Every Indian-food classifier we could find is
trained on scraped Google Images without established redistribution rights.
Shipping such weights under an open-source licence would misrepresent the
copyright status; relabelling Food-101 classes as "Indian dishes" is forbidden
by project policy and would be fake specialisation.

Per the v2.4 mission fallback: the limitation stays documented, the
reproducible training/evaluation pipeline remains in `training/indian-food/`,
and we instead **measured what we actually ship** with a licence-clean
real-image evaluation (see `docs/real-image-eval-2.4.md`).

## What would unblock a bundled Indian model

A dataset with machine-verifiable image-level rights (e.g. photographer-
contributed CC0/CC-BY sets, or synthetic/licenced data). The training pipeline
already enforces a licence gate (`prepare_dataset.py` refuses datasets
without a LICENCE.md attestation) and leak-safe splits.
