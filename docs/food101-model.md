# On-device recognition model (Food-101 / MobileNetV2)

NutriLens 2.2 recognizes cooked dishes **entirely in the user's browser**. No
API keys, no cloud calls, no account. This card documents exactly what the
model is, where it came from, and what it can and cannot do.

## Weights

| Property | Value |
| --- | --- |
| Architecture | MobileNetV2 (torchvision), 101 output classes |
| Dataset | Food-101 (101,000 images, 101 dish classes, MIT-licensed dataset) |
| Checkpoint source | `AlexKoff88/mobilenet_v2_food101` on Hugging Face (Apache-2.0), author-reported top-1 accuracy 76.35% (our conversion reports the checkpoint's stored `best_acc1` of the same value) |
| Export | PyTorch → ONNX (opset 13, fp32), converted by us — the repo's own ONNX file was dead (all-zero outputs); we converted the PyTorch checkpoint ourselves and verified export parity |
| File served | `public/models/food101-mobilenetv2.onnx` (≈9.4 MB, fp32) |
| Runtime | onnxruntime-web 1.22 (WebAssembly, single-threaded; wasm files self-hosted under `public/ort/`) |
| Quantization | None. We tested dynamic int8 quantization (2.5 MB) and rejected it: predictions degraded (e.g. dumplings/gyoza signals for momo dropped sharply). fp32 keeps exact PyTorch parity. |
| License | Apache-2.0 (model weights); Food-101 images are not redistributed |

## Preprocessing (matches training: torchvision standard)

1. Resize longest side to 256 px (bilinear), center-crop 224×224.
2. Scale RGB to 0–1, normalize with ImageNet mean (0.485, 0.456, 0.406) and
   std (0.229, 0.224, 0.225).
3. CHW float32 tensor `[1, 3, 224, 224]`.
4. Softmax over the 101 logits is applied in our code (the model emits raw
   logits).

## Honest capability statement

- Food-101 contains: `samosa`, `chow_mein`, `dumplings`, `gyoza`,
  `fried_rice`, `ramen`, `pho`, `spring_rolls` and 93 mostly Western/Asian
  classes.
- It contains **no** classes for most Indian staples: dal, rajma, chole,
  idli, dosa, pav bhaji, curry. Photos of those dishes produce
  low-confidence foreign guesses. The app handles this honestly: no confident
  match → the user picks the dish manually. We never stretch a foreign class
  into an Indian dish.
- Model scores are **model confidence, not accuracy**. The UI always shows
  ranked candidates and asks the user to confirm ambiguous results.
- The model cannot list ingredients, weigh portions, or see oil/salt. The
  app never fabricates those values; portion size is always user-confirmed.

## Class → dish mapping

`features/engine-v2/food101.ts` maps a **curated subset** of Food-101
classes to NutriLens dish entries:

| Food-101 class | Dish | Kind |
| --- | --- | --- |
| samosa | Samosa | direct |
| chow_mein | Chowmein | direct |
| dumplings, gyoza | Steamed Momo | near (user confirms filling) |
| fried_rice | Steamed Rice | near (note about extra oil) |
| ramen, pho | Prepared Instant Noodles | near |
| spring_rolls | Samosa | near (fried savoury pastry) |

## Offline / caching behaviour

- The ONNX weights are fetched from the same origin
  (`/nutrilens/models/food101-mobilenetv2.onnx`) and stored in the **Cache
  API** (`nutrilens-model-v1`), so recognition works offline afterwards.
- The onnxruntime-web WASM files are self-hosted (`/nutrilens/ort/`), so no
  third-party CDN is required at runtime either.
- If the model cannot be downloaded (offline, first visit), the UI says so
  and offers manual dish selection instead of pretending.
