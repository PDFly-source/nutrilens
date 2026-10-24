"""Decode + exact-shipped preprocessing for the real-image evaluation.

Reproduces the browser pipeline from browser-vision.ts: scale the LONGEST
side to 256, center-crop 224x224, ImageNet mean/std normalization.
Caveat (documented in the eval report): PIL bilinear and browser canvas use
slightly different resampling kernels; the effect on scores is small but this
is a known approximation, which is why the model + mapping + policy are run
through the SHIPPED TypeScript modules in run_eval.ts.
"""
import json, pathlib, sys
import numpy as np
from PIL import Image

def preprocess(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    scale = 256 / max(w, h)
    nw, nh = (round(w * scale), round(h * scale)) if w >= h else (round(w * scale), 256)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    img = img.resize((nw, nh), Image.BILINEAR)
    left, top = (nw - 224) // 2, (nh - 224) // 2
    a = np.asarray(img.crop((left, top, left + 224, top + 224))).astype("float32") / 255.0
    a = (a - np.array([0.485, 0.456, 0.406], dtype="float32")) / np.array(
        [0.229, 0.224, 0.225], dtype="float32")
    return a.transpose(2, 0, 1).astype("float32")

def main(manifest_path, out_dir):
    manifest = json.load(open(manifest_path))
    out = pathlib.Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    for item in manifest:
        x = preprocess(item["file"])
        np.save(out / (pathlib.Path(item["file"]).name + ".f32.npy"), x)
    print("preprocessed", len(manifest), "images ->", out)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
