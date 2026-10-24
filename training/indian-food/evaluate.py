"""Held-out evaluation: top-1/top-3, per-class P/R, confusion matrix.

Only the metrics.json this script produces from the TEST split may be quoted
in NutriLens docs. NOT EXECUTED (v2.3).
"""
import argparse, json, pathlib, torch
from collections import Counter
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True, help='ImageFolder root with test/')
    ap.add_argument('--ckpt', required=True)
    ap.add_argument('--out', default='metrics.json')
    args = ap.parse_args()
    import torch.nn as nn
    from torchvision import models
    ds = datasets.ImageFolder(str(pathlib.Path(args.data) / 'test'),
        transform=transforms.Compose([
            transforms.Resize(256), transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])]))
    model = models.mobilenet_v2()
    model.classifier[1] = nn.Linear(model.last_channel, len(ds.classes))
    model.load_state_dict(torch.load(args.ckpt, map_location='cpu')); model.eval()
    top1 = top3 = n = 0
    confusion = Counter(); per_class = {c: {'tp': 0, 'fp': 0, 'fn': 0} for c in ds.classes}
    with torch.no_grad():
        for x, y in DataLoader(ds, batch_size=64):
            logits = model(x)
            ranked = logits.topk(3, dim=1).indices
            for i in range(len(y)):
                true = y[i].item()
                pred = ranked[i, 0].item()
                n += 1
                top1 += pred == true
                top3 += true in ranked[i].tolist()
                confusion[(ds.classes[true], ds.classes[pred])] += 1
                per_class[ds.classes[pred]]['fp'] += pred != true
                per_class[ds.classes[true]]['tp'] += pred == true
                per_class[ds.classes[true]]['fn'] += pred != true
    metrics = {
        'test_samples': n,
        'top1': top1 / n, 'top3': top3 / n,
        'per_class': {c: {'precision': (v['tp'] / (v['tp'] + v['fp'])) if v['tp'] + v['fp'] else None,
                          'recall': (v['tp'] / (v['tp'] + v['fn'])) if v['tp'] + v['fn'] else None}
                      for c, v in per_class.items()},
        'confusion': [[a, b, cnt] for (a, b), cnt in confusion.items()],
    }
    json.dump(metrics, open(args.out, 'w'), indent=2)
    print(f'test n={n} top1={metrics["top1"]:.4f} top3={metrics["top3"]:.4f} -> {args.out}')

if __name__ == '__main__':
    main()
