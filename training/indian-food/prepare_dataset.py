"""Dataset assembly guard: licence gate, dedupe, leak-safe splits.

NOT EXECUTED (v2.3). Run BEFORE train.py.

Usage: python prepare_dataset.py --src <dataset_root> --dst ./data
Requires a LICENCE.md in --src describing the dataset licence and confirming
that training AND redistributing derived model weights is permitted.
"""
import argparse, hashlib, json, pathlib, shutil

def file_hash(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--dst', default='data')
    args = ap.parse_args()
    src, dst = pathlib.Path(args.src), pathlib.Path(args.dst)
    licence = src / 'LICENCE.md'
    if not licence.exists():
        raise SystemExit('REFUSING: no LICENCE.md in the dataset root. Verify the '
                         'licence permits training AND redistributing derived weights.')
    manifest = {'source': str(src), 'licence': licence.name, 'classes': {}}
    seen_hashes = set()
    for split in ('train', 'val', 'test'):
        (dst / split).mkdir(parents=True, exist_ok=True)
    for cls_dir in sorted(p for p in src.iterdir() if p.is_dir() and p.name not in ('train', 'val', 'test')):
        counts = {'train': 0, 'val': 0, 'test': 0}
        images = [p for p in cls_dir.rglob('*') if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')]
        # deterministic split 70/15/15 by hash order (leak-safe: dedupe first)
        uniq = []
        for img in images:
            h = file_hash(img)
            if h in seen_hashes:
                continue
            seen_hashes.add(h)
            uniq.append(img)
        uniq.sort(key=lambda p: file_hash(str(p)))
        n = len(uniq)
        for i, img in enumerate(uniq):
            split = 'train' if i < n * 0.7 else 'val' if i < n * 0.85 else 'test'
            out = dst / split / cls_dir.name
            out.mkdir(parents=True, exist_ok=True)
            shutil.copy2(img, out / img.name)
            counts[split] += 1
        manifest['classes'][cls_dir.name] = counts
        print(f"{cls_dir.name}: {counts} (unique={n}, dropped_dupes={len(images)-n})")
    json.dump(manifest, open('dataset-manifest.json', 'w'), indent=2)
    print('-> dataset-manifest.json written. Inspect it BEFORE training.')

if __name__ == '__main__':
    main()
