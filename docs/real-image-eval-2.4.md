# Real-image evaluation of the shipped model — v2.4

Everything below was **measured on 2026-10-24** by running the exact shipped
stack: the byte-identical `public/models/food101-mobilenetv2.onnx` through
onnxruntime-web (the runtime users get), with the shipped class vocabulary,
curated mapping (`food101.ts`) and confidence policy (`confidence-policy.ts`).
Harness: `eval/real-image-eval/` (reproducible).

## Test set

- **31 images, all from Wikimedia Commons with per-image licence metadata**
  (27× CC BY-SA 4.0, 2× CC BY-SA 2.0, 1× CC BY-SA 3.0, 1× CC BY 2.0).
  Provenance per image (author, source URL, licence) in
  `eval/real-image-eval/manifest.json`.
- 16 images of **supported classes** (Food-101 classes NutriLens maps):
  samosa (1), chow mein (3), fried rice (3), dumplings (3), gyoza (3),
  spring rolls (3).
- 15 images of **unsupported Indian staples** (no Food-101 class exists):
  dal (3), dosa (3), idli (3), chapati (3), biryani (3).
- Limitation: small n; single crop per image (the shipped center-crop);
  PIL bilinear vs browser-canvas resampling differs slightly (documented in
  the harness). These are Commons photos — **out-of-distribution** relative
  to Food-101's food.com training domain, so raw accuracy is expectedly
  below the model's 76.35% Food-101 test-set figure.

## Measured results — supported classes (n=16)

| Metric | Result |
| --- | --- |
| Raw model top-1 (exact Food-101 class) | 4/16 = **25.0%** |
| Raw model top-3 | 7/16 = **43.8%** |
| True family reachable via curated mapping (top-5) | 8/16 = **50.0%** |

Per-class (n / top1 / top3): fried rice 3/2/2, gyoza 3/1/2, dumplings 3/0/2,
spring rolls 3/1/1, samosa 1/0/0, chow mein 3/0/0.

Notable confusions (from results.json): Indian street chow mein photos score
as `pad_thai` (up to 0.953), `takoyaki`, `bibimbap`; Commons samosa photo
scored `fish_and_chips`/`onion_rings`; several dosa/idli photos drift toward
dessert classes (white/round foods).

## Measured results — unsupported staples (n=15)

| Behaviour (correct = do NOT confidently misname the dish) | First pass (pre-mapping) | Re-run with shipped code* |
| --- | --- | --- |
| Honest `unknown` rejection (policy) | 10/15 = **66.7%** | 9/15 = 60.0% |
| `confirm` with an offered (possibly wrong) candidate | 5/15 = 33.3% | 6/15 = 40.0% |
| **Wrongly auto-routed to a dish without user confirmation** | **0/15 = 0%** | **0/15 = 0%** |

\* The re-run (committed as `eval/real-image-eval/results.json`, so anyone
reproducing gets exactly these numbers) includes the post-evaluation
`pad_thai` mapping described below: one biryani photo that scored pad_thai
now yields a "stir-fried noodles" confirm candidate instead of `unknown`.
Both columns are disclosed because the second run reuses the same test images
— it is transparency, **not** a clean generalization estimate for that
mapping.

No Indian staple was ever silently auto-selected in either run. The
`confirm` cases offered wrong families (e.g. biryani → "pad thai / fried
rice"), but the shipped flow requires user confirmation and shows
alternatives.

## Safety conclusion

On out-of-distribution real photos the bundled model's raw accuracy is far
below its Food-101 test-set accuracy — **this is exactly why the shipped flow
never auto-selects on weak or near-mapped evidence** (confidence policy:
near-ties → confirm, weak top → unknown, near-mappings always confirm). In
this evaluation the policy produced **zero silent misidentifications across
all 31 photos**, at the cost of more manual confirmations.

## Post-evaluation observation (disclosed, NOT counted in metrics above)

Indian chow mein photos frequently scored `pad_thai` (a stir-fried noodle
dish). After the evaluation we added a `pad_thai → chowmein` **near-mapping**
to `food101.ts` on nutritional-family grounds (stir-fried noodles with
vegetables; user must confirm, as with every near-mapping). The headline
metrics above were computed **before** this addition and are not re-quoted
with it — re-running the same 16 photos with the new mapping would be
tuning on the test set.

## Reproduction

```
cd eval/real-image-eval
python3 prepare_images.py manifest.json /tmp/tensors   # decode + shipped preprocessing
npx tsx run_eval.ts /tmp/tensors                        # shipped model + shipped TS logic
# → results.json (summary + per-image evidence)
```
Images are committed with their licence manifest for verifiability.
