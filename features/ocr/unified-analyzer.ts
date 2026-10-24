import {
  ScanMode,
  ImageType,
  NutritionData,
  ProductAnalysis,
  ScanImageItem,
} from '@/types/food';
import {
  preprocessFoodImage,
  logScanDiagnostic,
  PreprocessedImageResult,
} from '@/features/ocr/image-preprocessor';
import {
  parseNutritionText,
  parseIngredientsText,
  detectMarketingClaimsFromText,
  detectImageTypeFromText,
  extractBrandAndName,
} from '@/features/ocr/parser';
import { runLocalOcr, warmUpOcrEngine, detectBarcodeFromImage } from '@/features/ocr/ocr-service';
import { compileProductAnalysis } from '@/features/scoring/engine';
import { combineTableAndLineParsing, buildPackagedEvidence } from '@/features/engine-v2/pipeline';
import { resolveProduct } from '@/features/engine-v2/product-resolver';
import { lookupBarcode, offNutritionAsEvidence } from '@/features/engine-v2/barcode-off';
import { assessImageQualityBrowser } from '@/features/engine-v2/image-quality';
import { EvidenceField, FieldEvidenceMap } from '@/features/engine-v2/types';

export interface UnifiedAnalysisInput {
  file?: File;
  blob?: Blob;
  dataUrl?: string;
  name?: string;
  label?: string;
}

export interface UnifiedAnalysisResult {
  analysis: ProductAnalysis;
  extractedNutrition: NutritionData;
  ingredientsText: string;
  productName: string;
  brand: string | null;
  productVariant: string | null;
  claims: string[];
  imageType: ImageType;
  detectionNotes: string;
  imagesProcessed: ScanImageItem[];
  isFrontPackageOnly: boolean;
  hasVerifiedNutrition: boolean;
  hasVerifiedIngredients: boolean;
  /** v2: per-field provenance + validation evidence. */
  evidence?: FieldEvidenceMap;
  /** v2: detected product barcode, when any. */
  barcode?: string | null;
  /** v2: image quality verdict for the primary photo. */
  qualityAdvice?: string | null;
  /**
   * v2.4.1: TRUE packaging evidence existed in the OCR text — a known brand,
   * a validated (non-garbage) product title, nutrition numbers, ingredients,
   * or a barcode. When this is false the photo may be cooked food or junk
   * text, and auto-mode routing must NOT open the packaged review form.
   */
  hasPackagingEvidence: boolean;
}

/**
 * Unified Food Image Analyzer for both Camera and Gallery uploads
 * Supports single-photo and multi-photo sessions (e.g. Front + Back)
 */
export async function analyzeFoodImages(
  inputList: UnifiedAnalysisInput[],
  mode: ScanMode = 'nutrition',
  onProgress?: (stage: string, percent: number) => void
): Promise<UnifiedAnalysisResult> {
  if (!inputList || inputList.length === 0) {
    throw new Error('No images provided for analysis');
  }

  onProgress?.('Reading & decoding package photo(s)...', 15);

  const preprocessedList: PreprocessedImageResult[] = [];
  const imageItems: ScanImageItem[] = [];

  for (let i = 0; i < inputList.length; i++) {
    const input = inputList[i];
    let preprocessed: PreprocessedImageResult;

    if (input.file || input.blob) {
      preprocessed = await preprocessFoodImage(
        (input.file || input.blob)!,
        input.name || `photo-${i + 1}.jpg`
      );
    } else if (input.dataUrl) {
      // Decode data URL through canvas
      const res = await fetch(input.dataUrl);
      const blob = await res.blob();
      preprocessed = await preprocessFoodImage(blob, input.name || `photo-${i + 1}.jpg`);
    } else {
      continue;
    }

    preprocessedList.push(preprocessed);
    imageItems.push({
      id: `img-${Date.now()}-${i}`,
      dataUrl: preprocessed.dataUrl,
      file: input.file,
      name: preprocessed.name,
      label: input.label || (i === 0 ? 'Photo 1' : `Photo ${i + 1}`),
      width: preprocessed.width,
      height: preprocessed.height,
      fileSize: preprocessed.fileSize,
    });
  }

  if (preprocessedList.length === 0) {
    throw new Error('Could not decode any of the provided images');
  }

  onProgress?.('Inspecting packaging layout & visual regions...', 35);
  logScanDiagnostic('VISION/OCR STARTED', {
    imageCount: preprocessedList.length,
    names: preprocessedList.map((p) => p.name).join(', '),
  });

  // Try Multimodal Vision API First
  let visionData: any = null;
  let useVisionSuccess = false;

  try {
    onProgress?.('Extracting product details, nutrition table & ingredients...', 55);

    const apiPayload = {
      images: preprocessedList.map((p) => ({
        data: p.base64Data,
        mimeType: p.mimeType,
        name: p.name,
      })),
      scanMode: mode,
    };

    const res = await fetch('/api/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        visionData = json.data;
        useVisionSuccess = true;
        logScanDiagnostic('RAW EXTRACTION RECEIVED', {
          imageType: visionData.imageType,
          brand: visionData.product?.brand,
          name: visionData.product?.name,
        });
      }
    }
  } catch (apiErr) {
    console.warn('[NutriLens Engine] Server vision API unavailable, falling back to local OCR:', apiErr);
  }

  // Handle Vision Result
  if (useVisionSuccess && visionData) {
    onProgress?.('Validating extracted fields & verifying data...', 80);

    const detectedType: ImageType = visionData.imageType || 'full_package';
    for (const img of imageItems) {
      img.imageType = detectedType;
    }

    // Construct Product Name - Never default to "Packaged Food Label"
    let productName = '';
    const brand = visionData.product?.brand || null;
    const prodName = visionData.product?.name || null;
    const variant = visionData.product?.variant || null;
    const packageSize = visionData.product?.packageSize || null;

    if (brand && prodName) {
      productName = `${brand} ${prodName}${variant ? ` (${variant})` : ''}`;
    } else if (prodName) {
      productName = `${prodName}${variant ? ` (${variant})` : ''}`;
    } else if (brand) {
      productName = `${brand} Food Product`;
    } else {
      productName = 'Packaged Food Product';
    }

    // Construct Nutrition - Unknowns MUST remain null, NEVER 0
    const vNut = visionData.nutrition || {};
    let calories = vNut.energyKcal !== undefined ? vNut.energyKcal : null;
    if (calories === null && vNut.energyKj !== null && vNut.energyKj !== undefined) {
      calories = Math.round(vNut.energyKj / 4.184);
    }

    let sodium = vNut.sodiumMg !== undefined ? vNut.sodiumMg : null;
    if (sodium === null && vNut.saltG !== null && vNut.saltG !== undefined) {
      sodium = Math.round(vNut.saltG * 393.4);
    }

    const nutrition: NutritionData = {
      servingSize: visionData.serving?.size || null,
      servingsPerContainer: visionData.serving?.servingsPerContainer || null,
      calories,
      totalFat: vNut.totalFatG !== undefined ? vNut.totalFatG : null,
      saturatedFat: vNut.saturatedFatG !== undefined ? vNut.saturatedFatG : null,
      transFat: vNut.transFatG !== undefined ? vNut.transFatG : null,
      cholesterol: vNut.cholesterolMg !== undefined ? vNut.cholesterolMg : null,
      sodium,
      totalCarbs: vNut.carbohydrateG !== undefined ? vNut.carbohydrateG : null,
      dietaryFiber: vNut.fiberG !== undefined ? vNut.fiberG : null,
      totalSugars: vNut.totalSugarG !== undefined ? vNut.totalSugarG : null,
      addedSugars: vNut.addedSugarG !== undefined ? vNut.addedSugarG : null,
      protein: vNut.proteinG !== undefined ? vNut.proteinG : null,
      salt: vNut.saltG !== undefined ? vNut.saltG : null,
      energyKj: vNut.energyKj !== undefined ? vNut.energyKj : null,
      basis: vNut.basis || null,
    };

    // Parse Ingredients
    let ingredientsText = visionData.rawIngredientsText || '';
    if (!ingredientsText && Array.isArray(visionData.ingredients) && visionData.ingredients.length > 0) {
      ingredientsText = visionData.ingredients.join(', ');
    }

    const parsedIngredients = parseIngredientsText(ingredientsText);
    const claims = Array.isArray(visionData.claims) ? visionData.claims : [];

    const isFrontPackageOnly =
      detectedType === 'front_package' &&
      nutrition.calories === null &&
      nutrition.protein === null &&
      nutrition.totalFat === null &&
      nutrition.sodium === null;

    const detectionNotes =
      visionData.detectionNotes ||
      (isFrontPackageOnly
        ? 'Front package detected. Nutrition facts are not visible on this side of the package.'
        : 'Label information extracted successfully.');

    logScanDiagnostic('STRUCTURED EXTRACTION COMPLETE', {
      productName,
      imageType: detectedType,
      isFrontPackageOnly,
    });

    onProgress?.('Preparing review & intelligence report...', 95);

  const compiled = compileProductAnalysis({
      scanMode: mode,
      imageType: detectedType,
      productName,
      brand,
      productVariant: variant,
      packageSize,
      barcode: visionData.barcode || undefined,
      nutrition,
      ingredients: parsedIngredients.items,
      rawIngredientsText: parsedIngredients.cleanRawList || ingredientsText,
      detectedClaims: claims,
      imagePreviewUrl: preprocessedList[0].dataUrl,
      images: imageItems,
      nutritionConfidence: visionData.nutritionConfidence,
      detectionNotes,
    });

    logScanDiagnostic('VALIDATION COMPLETE', {
      overallScore: compiled.scores.overall,
      isScoreAvailable: compiled.scores.isScoreAvailable,
    });

    return {
      analysis: compiled,
      extractedNutrition: nutrition,
      ingredientsText: parsedIngredients.cleanRawList || ingredientsText,
      productName,
      brand,
      productVariant: variant,
      claims,
      // The structured vision adapter only runs for images it classified as
      // packaging, so this path inherently carries packaging evidence.
      hasPackagingEvidence: true,
      imageType: detectedType,
      detectionNotes,
      imagesProcessed: imageItems,
      isFrontPackageOnly,
      hasVerifiedNutrition: compiled.hasVerifiedNutritionData || false,
      hasVerifiedIngredients: compiled.hasVerifiedIngredientsData || false,
    };
  }

  // ============================================================
  // LOCAL OCR FALLBACK (static hosting, e.g. GitHub Pages)
  // ============================================================
  // The server vision route (/api/analyze-image) is unavailable on static
  // hosts. We run the on-device Tesseract.js OCR pipeline on EVERY image of
  // the session and parse the combined text with validated rules.
  // The engine is a persistent worker; the FIRST run must download the wasm
  // core + eng.traineddata (~4-10MB), which can take tens of seconds on slow
  // connections — hence a generous 90s ceiling instead of the old 7s timeout
  // that silently killed every production scan.
  onProgress?.('Loading local text recognition engine...', 55);

  const OCR_TOTAL_TIMEOUT_MS = 90_000;
  let ocrFailureReason: string | null = null;
  const perImageTexts: string[] = [];

  const ocrAllImages = (async () => {
    for (let i = 0; i < preprocessedList.length; i++) {
      const primary = preprocessedList[i];
      const basePct = 55 + (i / preprocessedList.length) * 30;
      const span = 30 / preprocessedList.length;
      try {
        // Decode the preprocessed image onto a canvas for the OCR engine.
        const img = new Image();
        img.src = primary.dataUrl;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error('Failed to decode image for OCR'));
        });

        const canvas = document.createElement('canvas');
        canvas.width = primary.width;
        canvas.height = primary.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);

        const res = await runLocalOcr(canvas, (status, prog) => {
          onProgress?.(
            `${status}${preprocessedList.length > 1 ? ` (photo ${i + 1}/${preprocessedList.length})` : ''}`,
            Math.min(88, basePct + prog * span)
          );
        });
        perImageTexts.push(res.text || '');
      } catch (err: any) {
        ocrFailureReason = err?.message || 'OCR engine failure';
        perImageTexts.push('');
      }
    }
    return perImageTexts.join('\n\n');
  })();

  let rawOcrText = '';
  try {
    const ocrTimeout = new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new Error('Local OCR timed out after 90 seconds')),
        OCR_TOTAL_TIMEOUT_MS
      )
    );
    rawOcrText = await Promise.race([ocrAllImages, ocrTimeout]);
  } catch (ocrErr: any) {
    console.warn('[NutriLens Engine] Local OCR failed or timed out:', ocrErr);
    rawOcrText = perImageTexts.join('\n\n');
    if (!ocrFailureReason) {
      ocrFailureReason = ocrErr?.message || 'OCR timed out';
    }
  }

  onProgress?.('Validating extracted fields...', 88);

  // ---- v2: image quality gate on the primary photo ----
  let qualityAdvice: string | null = null;
  try {
    const qImg = new Image();
    qImg.src = preprocessedList[0].dataUrl;
    await new Promise((res) => { qImg.onload = res; qImg.onerror = res; });
    const q = await assessImageQualityBrowser(qImg);
    if (q.verdict !== 'good' && q.advice) qualityAdvice = q.advice;
  } catch { /* quality gate is advisory only */ }

  // ---- v2: barcode detection + Open Food Facts candidate lookup ----
  let barcode: string | null = null;
  let offProduct: ReturnType<typeof offNutritionAsEvidence> | null = null;
  let offName: string | null = null;
  let offBrand: string | null = null;
  let offNote: string | null = null;
  try {
    const bImg = new Image();
    bImg.src = preprocessedList[0].dataUrl;
    await new Promise((res) => { bImg.onload = res; bImg.onerror = res; });
    const bc = await detectBarcodeFromImage(bImg);
    if (bc?.rawValue) {
      barcode = bc.rawValue;
      onProgress?.('Checking product database...', 91);
      const lookup = await Promise.race([
        lookupBarcode(bc.rawValue),
        new Promise<any>((res) => setTimeout(() => res({ found: false, product: null, error: 'timeout' }), 6000)),
      ]);
      if (lookup && lookup.found && lookup.product) {
        offProduct = offNutritionAsEvidence(lookup.product);
        offName = lookup.product.name;
        offBrand = lookup.product.brand;
        offNote = `Barcode ${bc.rawValue} matched an Open Food Facts entry — database values are shown as candidates and are NOT auto-confirmed.`;
      } else {
        offNote = `Barcode ${bc.rawValue} detected, but no public product entry was found.`;
      }
    }
  } catch { /* barcode/OFF is best-effort */ }

  // ---- v2: table-aware parsing + line fallback ----
  const { nutrition: parsedNutrition, table } = combineTableAndLineParsing(rawOcrText);
  const parsedIngredients = parseIngredientsText(rawOcrText);
  const detectedClaims = detectMarketingClaimsFromText(rawOcrText);
  const imageType = detectImageTypeFromText(rawOcrText);

  // ---- v2: brand/title/flavour/net-weight resolution (never filenames) ----
  const resolved = resolveProduct(rawOcrText);
  const productName = resolved.title || '';
  const brand = resolved.brand;
  const flavour = resolved.flavour;
  const packageSize = resolved.netWeightRaw;

  for (const img of imageItems) {
    img.imageType = imageType;
  }

  const ocrProducedSomeText = rawOcrText.replace(/\s/g, '').length >= 10;
  const hasNutritionEvidence =
    parsedNutrition.calories !== null ||
    parsedNutrition.protein !== null ||
    parsedNutrition.totalFat !== null ||
    parsedNutrition.sodium !== null;
  const hasIngredientsEvidence = (parsedIngredients.cleanRawList || '').trim().length > 0;
  // v2.4.1: does this text actually look like a package? productName here is
  // the VALIDATED title (garbage like "She" is already null) — a truthy
  // value means a plausible printed title or brand was found.
  const hasPackagingEvidence =
    brand !== null ||
    productName !== '' ||
    hasNutritionEvidence ||
    hasIngredientsEvidence ||
    barcode !== null;

  const isFrontPackageOnly =
    imageType === 'front_package' &&
    !hasNutritionEvidence &&
    !hasIngredientsEvidence;

  // ---- Honest detection notes ----
  let detectionNotes: string;
  if (!ocrProducedSomeText && ocrFailureReason) {
    detectionNotes =
      `Could not read text from this photo (${ocrFailureReason}). ` +
      'Values were left unknown — please type them in manually, or retake the photo with sharper focus and good lighting.';
  } else if (!ocrProducedSomeText) {
    detectionNotes =
      'No readable text was found in this photo. Values were left unknown — please type them in manually, or retake the photo with sharper focus and good lighting.';
  } else if (!hasPackagingEvidence && ocrProducedSomeText) {
    detectionNotes =
      'Some text was found, but nothing that looks like a package (no brand, product title, nutrition table, ingredients or barcode). ' +
      'If this is cooked food, pick the dish from the cooked-food scan instead.';
  } else if (isFrontPackageOnly) {
    detectionNotes =
      'This looks like the FRONT of the package, which usually shows only the brand and product name. ' +
      'Please add a photo of the BACK of the package (nutrition table + ingredients) to complete the report.';
  } else if (ocrFailureReason) {
    detectionNotes =
      `Partial recognition: one photo could not be read (${ocrFailureReason}). ` +
      'Detected values are shown below — please verify them before generating the report.';
  } else {
    detectionNotes =
      (table.detected
        ? `Nutrition table recognized with basis "${table.rawHeader?.trim()}" — column-aware parsing used. `
        : 'Text recognized on-device. ') +
      'Please verify the detected values below before generating the report.';
  }
  if (qualityAdvice) detectionNotes = `${qualityAdvice} ${detectionNotes}`;
  if (offNote) detectionNotes = `${detectionNotes} ${offNote}`;

  // ---- v2: per-field evidence map (OCR + OFF candidates) ----
  const { evidence } = buildPackagedEvidence({
    nutrition: parsedNutrition,
    productName,
    brand,
    ocrConfidence: ocrProducedSomeText ? 0.65 : 0.2,
    offValues: offProduct || undefined,
    offName,
    offBrand,
  });
  const compiled = compileProductAnalysis({
    scanMode: mode,
    imageType,
    productName: productName || 'Packaged Food Product',
    brand,
    productVariant: flavour,
    packageSize,
    nutrition: parsedNutrition,
    ingredients: parsedIngredients.items,
    rawIngredientsText: parsedIngredients.cleanRawList,
    detectedClaims: detectedClaims,
    imagePreviewUrl: preprocessedList[0].dataUrl,
    images: imageItems,
    nutritionConfidence: hasNutritionEvidence ? 'medium' : 'none',
    detectionNotes,
  });

  onProgress?.('Preparing review screen...', 95);

  return {
    analysis: compiled,
    extractedNutrition: parsedNutrition,
    ingredientsText: parsedIngredients.cleanRawList,
    productName,
    brand,
    productVariant: flavour,
    claims: detectedClaims,
    imageType,
    detectionNotes,
    imagesProcessed: imageItems,
    isFrontPackageOnly,
    hasVerifiedNutrition: compiled.hasVerifiedNutritionData || false,
    hasVerifiedIngredients: compiled.hasVerifiedIngredientsData || false,
    evidence,
    barcode,
    qualityAdvice,
    hasPackagingEvidence,
  };
}
