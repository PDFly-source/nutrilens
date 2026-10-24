/**
 * Smart Capture Coach (Client-Side Real-Time Image Quality Analyzer)
 * 
 * Evaluates image frames via HTML5 Canvas using fast statistical heuristics:
 * - Average Luminance (Exposure & Low-Light detection)
 * - Specular Glare (Blown-out hotspot percentage)
 * - Laplacian Variance (Blur, defocus, and motion detection)
 * - Contrast Spread (Dynamic range readability)
 */

export interface QualityAnalysisResult {
  passed: boolean;
  score: number; // 0 - 100
  issues: string[];
  tips: string[];
  metrics: {
    brightness: number; // 0 - 255
    glarePercent: number; // 0 - 100
    sharpness: number; // laplacian variance
    contrast: number; // std dev
  };
}

export function analyzeCanvasQuality(canvas: HTMLCanvasElement): QualityAnalysisResult {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      passed: true,
      score: 80,
      issues: [],
      tips: ['Camera ready'],
      metrics: { brightness: 128, glarePercent: 0, sharpness: 120, contrast: 45 },
    };
  }

  // Downsample to 200x200 for lightning-fast statistical analysis without blocking UI
  const w = 200;
  const h = 200;
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!offCtx) {
    return {
      passed: true,
      score: 80,
      issues: [],
      tips: ['Camera ready'],
      metrics: { brightness: 128, glarePercent: 0, sharpness: 120, contrast: 45 },
    };
  }

  offCtx.drawImage(canvas, 0, 0, w, h);
  const imgData = offCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let totalLuminance = 0;
  let glarePixels = 0;
  const gray = new Float32Array(w * h);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Perceived luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const pixelIdx = i / 4;
    gray[pixelIdx] = lum;
    totalLuminance += lum;

    if (lum > 245) {
      glarePixels++;
    }
  }

  const numPixels = w * h;
  const avgBrightness = totalLuminance / numPixels;
  const glarePercent = (glarePixels / numPixels) * 100;

  // Calculate Contrast (Standard Deviation of Luminance)
  let sumSquaredDiff = 0;
  for (let i = 0; i < numPixels; i++) {
    const diff = gray[i] - avgBrightness;
    sumSquaredDiff += diff * diff;
  }
  const contrast = Math.sqrt(sumSquaredDiff / numPixels);

  // Calculate Sharpness via Discrete Laplacian Variance (3x3 kernel)
  // [ 0,  1,  0 ]
  // [ 1, -4,  1 ]
  // [ 0,  1,  0 ]
  let laplacianSum = 0;
  let laplacianCount = 0;
  const laplacianVals: number[] = [];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const center = gray[idx];
      const top = gray[(y - 1) * w + x];
      const bottom = gray[(y + 1) * w + x];
      const left = gray[y * w + (x - 1)];
      const right = gray[y * w + (x + 1)];

      const lap = Math.abs(top + bottom + left + right - 4 * center);
      laplacianVals.push(lap);
      laplacianSum += lap;
      laplacianCount++;
    }
  }

  const laplacianMean = laplacianSum / (laplacianCount || 1);
  let lapVariance = 0;
  for (let i = 0; i < laplacianVals.length; i++) {
    const d = laplacianVals[i] - laplacianMean;
    lapVariance += d * d;
  }
  const sharpness = lapVariance / (laplacianCount || 1);

  // Issues & Feedback rules
  const issues: string[] = [];
  const tips: string[] = [];
  let score = 100;

  if (avgBrightness < 45) {
    issues.push('Low brightness');
    tips.push('Move into better lighting or turn on flashlight');
    score -= 30;
  } else if (avgBrightness > 225) {
    issues.push('Overexposed image');
    tips.push('Reduce background backlight');
    score -= 25;
  }

  if (glarePercent > 12) {
    issues.push('Surface glare detected');
    tips.push('Tilt the phone slightly to avoid direct light reflection');
    score -= 30;
  }

  if (sharpness < 75) {
    issues.push('Image blurry / motion detected');
    tips.push('Hold steady and move closer to the label');
    score -= 35;
  }

  if (contrast < 22) {
    issues.push('Low text contrast');
    tips.push('Ensure the text is in crisp focus');
    score -= 20;
  }

  if (tips.length === 0) {
    tips.push('Framing and lighting look crisp');
  }

  const finalScore = Math.max(10, Math.min(100, Math.round(score)));
  const passed = finalScore >= 60;

  return {
    passed,
    score: finalScore,
    issues,
    tips,
    metrics: {
      brightness: Math.round(avgBrightness),
      glarePercent: Math.round(glarePercent * 10) / 10,
      sharpness: Math.round(sharpness),
      contrast: Math.round(contrast),
    },
  };
}
