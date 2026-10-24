"""Export the trained checkpoint to ONNX + verify parity. NOT EXECUTED (v2.3)."""
import argparse, json, pathlib, torch
from torchvision import models

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ckpt', required=True)
    ap.add_argument('--classes', default='train-summary.json')
    ap.add_argument('--out', default='indian-food-mobilenetv2.onnx')
    args = ap.parse_args()
    classes = json.load(open(args.classes))['classes']
    model = models.mobilenet_v2()
    import torch.nn as nn
    model.classifier[1] = nn.Linear(model.last_channel, len(classes))
    model.load_state_dict(torch.load(args.ckpt, map_location='cpu'))
    model.eval()
    dummy = torch.randn(1, 3, 224, 224)
    torch.onnx.export(model, dummy, args.out, opset_version=13,
                      input_names=['input'], output_names=['logits'],
                      dynamic_axes={'input': {0: 'batch'}})
    # parity check against the exported file
    import onnxruntime as ort
    sess = ort.InferenceSession(args.out)
    ort_out = sess.run(None, {'input': dummy.numpy()})[0]
    diff = abs(ort_out - model(dummy).detach().numpy()).max()
    print(f'exported {args.out}; max |pytorch-onnx| logit diff = {diff:.2e}')
    assert diff < 1e-3, 'parity check FAILED — do not ship this export'
    json.dump({'onnx': args.out, 'classes': classes, 'parity_max_diff': float(diff)},
              open('export-summary.json', 'w'), indent=2)

if __name__ == '__main__':
    main()
