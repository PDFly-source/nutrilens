/**
 * NutriLens 2.4 real-image evaluation runner.
 *
 * Runs the EXACT shipped stack against a licence-clean held-out image set:
 *  - model asset: public/models/food101-mobilenetv2.onnx (byte-identical to
 *    what GitHub Pages serves) via onnxruntime-web (the shipped runtime),
 *  - class vocabulary + honest mapping: features/engine-v2/food101.ts,
 *  - confidence/unknown policy: features/engine-v2/confidence-policy.ts.
 *
 * Output: results.json consumed by docs/real-image-eval-2.4.md.
 * Run from eval/real-image-eval after prepare_images.py.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-web';
import { FOOD_101_CLASSES, mapFood101Class } from '../../features/engine-v2/food101';
import { classifyConfidence } from '../../features/engine-v2/confidence-policy';
import type { DishCandidate } from '../../features/engine-v2/vision-mapping';

interface ManifestItem {
  file: string;
  label: string;
  kind: 'supported' | 'unsupported';
  source_url: string;
  licence: string;
  artist: string;
}

function softmax(logits: Float32Array): number[] {
  const max = Math.max(...Array.from(logits));
  const exps = Array.from(logits).map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

async function main() {
  const manifest: ManifestItem[] = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const tensorDir = process.argv[2] ?? '/tmp/eval24/tensors';
  const modelPath = path.resolve(__dirname, '../../public/models/food101-mobilenetv2.onnx');

  ort.env.wasm.numThreads = 1;
  const buf = fs.readFileSync(modelPath);
  const session = await ort.InferenceSession.create(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { executionProviders: ['wasm'] }
  );

  const results: any[] = [];
  for (const item of manifest) {
    const tpath = path.join(tensorDir, path.basename(item.file) + '.f32.npy');
    const raw = fs.readFileSync(tpath);
    const data = new Float32Array(raw.buffer, 128, 150528); // skip npy header
    const out = await session.run({
      [session.inputNames[0]]: new ort.Tensor('float32', data, [1, 3, 224, 224]),
    });
    const logits = out[session.outputNames[0]].data as Float32Array;
    const probs = softmax(logits);
    const ranked = Array.from(probs)
      .map((p, i) => ({ cls: FOOD_101_CLASSES[i], p }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 5);

    // Ship exactly what the browser pipeline builds: mapped candidates.
    const candidates: DishCandidate[] = ranked.flatMap((r): DishCandidate[] => {
      const m = mapFood101Class(r.cls);
      return m
        ? [{ name: m.observedName, confidence: r.p, dishId: m.dishId, kind: m.kind, note: m.note, rawClass: r.cls }]
        : [];
    });
    const policy = classifyConfidence(candidates);

    results.push({
      file: item.file,
      groundTruth: item.label,
      setKind: item.kind,
      top5Raw: ranked.map((r) => ({ cls: r.cls, score: Math.round(r.p * 1000) / 1000 })),
      mappedCandidates: candidates.map((c) => ({
        name: c.name, dishId: c.dishId, kind: c.kind,
        score: Math.round(c.confidence * 1000) / 1000, rawClass: c.rawClass,
      })),
      policy: policy.decision,
      policyReason: policy.reason,
      licence: item.licence,
      source_url: item.source_url,
    });
    console.log(`${item.label.padEnd(12)} | top1=${ranked[0].cls}(${ranked[0].p.toFixed(2)}) | policy=${policy.decision}`);
  }

  // ---- aggregate metrics -------------------------------------------------
  const supported = results.filter((r) => r.setKind === 'supported');
  const unsupported = results.filter((r) => r.setKind === 'unsupported');

  const top1 = supported.filter((r) => r.top5Raw[0].cls === r.groundTruth).length;
  const top3 = supported.filter((r) => r.top5Raw.slice(0, 3).some((t: any) => t.cls === r.groundTruth)).length;
  // End-to-end: does a mapped candidate for the true family exist at all?
  const mappedCorrect = supported.filter((r) =>
    r.mappedCandidates.some((c: any) => c.rawClass === r.groundTruth)
  ).length;
  // Unsupported dishes: correct behaviour = policy 'unknown' (honest reject).
  const rejectedUnknown = unsupported.filter((r) => r.policy === 'unknown').length;
  const misrouted = unsupported.filter((r) => r.policy === 'auto');

  const summary = {
    model: 'food101-mobilenetv2.onnx (shipped asset, onnxruntime-web wasm)',
    images_total: results.length,
    supported_set: {
      n: supported.length,
      raw_model_top1: top1,
      raw_model_top3: top3,
      ground_truth_family_mapped: mappedCorrect,
      per_class: Object.fromEntries(
        [...new Set(supported.map((r) => r.groundTruth))].map((g) => {
          const cls = supported.filter((r) => r.groundTruth === g);
          return [g, {
            n: cls.length,
            top1: cls.filter((r) => r.top5Raw[0].cls === g).length,
            top3: cls.filter((r) => r.top5Raw.slice(0, 3).some((t: any) => t.cls === g)).length,
          }];
        })
      ),
    },
    unsupported_set: {
      n: unsupported.length,
      honest_unknown_rejections: rejectedUnknown,
      required_confirmation: unsupported.filter((r) => r.policy === 'confirm').length,
      wrongly_auto_routed: misrouted.length,
      wrong_auto_details: misrouted.map((r) => ({ gt: r.groundTruth, picked: r.mappedCandidates[0] })),
    },
  };
  fs.writeFileSync('results.json', JSON.stringify({ summary, results }, null, 2));
  console.log('\nSUMMARY:', JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
