"""Reproducible training script for the planned NutriLens Indian-food model.

NOT EXECUTED as part of NutriLens 2.3 — see README.md. Run on a GPU
workstation after assembling a licence-clear dataset.
"""
import argparse, json, pathlib, torch, torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models

TRAIN_TF = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
EVAL_TF = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True, help='ImageFolder root with train/ and val/')
    ap.add_argument('--epochs', type=int, default=8)
    ap.add_argument('--batch', type=int, default=32)
    ap.add_argument('--out', default='indian-food-model.pt')
    args = ap.parse_args()

    train = datasets.ImageFolder(str(pathlib.Path(args.data) / 'train'), transform=TRAIN_TF)
    val = datasets.ImageFolder(str(pathlib.Path(args.data) / 'val'), transform=EVAL_TF)
    print(f'train={len(train)} val={len(val)} classes={len(train.classes)}')
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
    model.classifier[1] = nn.Linear(model.last_channel, len(train.classes))
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=3e-4)
    crit = nn.CrossEntropyLoss(label_smoothing=0.1)
    best = 0.0
    for ep in range(args.epochs):
        model.train()
        for x, y in DataLoader(train, batch_size=args.batch, shuffle=True, num_workers=4):
            x, y = x.to(device), y.to(device)
            opt.zero_grad(); loss = crit(model(x), y); loss.backward(); opt.step()
        model.eval(); correct = total = 0
        with torch.no_grad():
            for x, y in DataLoader(val, batch_size=args.batch):
                correct += (model(x.to(device)).argmax(1).cpu() == y).sum().item()
                total += len(y)
        acc = correct / total
        print(f'epoch {ep+1}: val top-1={acc:.4f}')
        if acc > best:
            best = acc; torch.save(model.state_dict(), args.out)
    json.dump({'best_val_top1': best, 'classes': train.classes},
              open('train-summary.json', 'w'), indent=2)
    print(f'best val top-1 {best:.4f} -> {args.out}')

if __name__ == '__main__':
    main()
