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
} from '@/features/ocr/parser';
import { runLocalOcr } from '@/features/ocr/ocr-service';
import { compileProductAnalysis } from '@/features/scoring/engine';

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
      imageType: detectedType,
      detectionNotes,
      imagesProcessed: imageItems,
      isFrontPackageOnly,
      hasVerifiedNutrition: compiled.hasVerifiedNutritionData || false,
      hasVerifiedIngredients: compiled.hasVerifiedIngredientsData || false,
    };
  }

  // Local OCR Fallback (with strict 7s timeout to prevent 40% hang!)
  onProgress?.('Running local text recognition engine...', 55);

  let rawOcrText = '';
  try {
    const ocrTimeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Local OCR timed out after 7 seconds')), 7000)
    );

    const ocrExecution = (async () => {
      // Create offscreen image/canvas for first image
      const primary = preprocessedList[0];
      const img = new Image();
      img.src = primary.dataUrl;
      await new Promise((res) => {
        img.onload = res;
      });

      const canvas = document.createElement('canvas');
      canvas.width = primary.width;
      canvas.height = primary.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);

      const res = await runLocalOcr(canvas, (status, prog) => {
        onProgress?.(`${status} (${Math.round(prog * 100)}%)`, Math.min(85, 55 + prog * 30));
      });
      return res.text;
    })();

    rawOcrText = await Promise.race([ocrExecution, ocrTimeout]);
  } catch (ocrErr) {
    console.warn('[NutriLens Engine] Local OCR failed or timed out:', ocrErr);
    rawOcrText = '';
  }

  onProgress?.('Validating extracted fields...', 85);

  const parsedNutrition = parseNutritionText(rawOcrText);
  const parsedIngredients = parseIngredientsText(rawOcrText);
  const detectedClaims = detectMarketingClaimsFromText(rawOcrText);
  const imageType = detectImageTypeFromText(rawOcrText);

  for (const img of imageItems) {
    img.imageType = imageType;
  }

  const isFrontPackageOnly =
    imageType === 'front_package' ||
    (parsedNutrition.calories === null &&
      parsedNutrition.protein === null &&
      parsedNutrition.totalFat === null);

  const fallbackProductName =
    preprocessedList[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Packaged Food Product';

  const detectionNotes = isFrontPackageOnly
    ? 'Front package view detected. Nutrition facts not found in image text.'
    : 'Local text extraction completed.';

  const compiled = compileProductAnalysis({
    scanMode: mode,
    imageType,
    productName: fallbackProductName,
    nutrition: parsedNutrition,
    ingredients: parsedIngredients.items,
    rawIngredientsText: parsedIngredients.cleanRawList,
    detectedClaims: detectedClaims,
    imagePreviewUrl: preprocessedList[0].dataUrl,
    images: imageItems,
    nutritionConfidence: isFrontPackageOnly ? 'none' : 'medium',
    detectionNotes,
  });

  onProgress?.('Preparing review screen...', 95);

  return {
    analysis: compiled,
    extractedNutrition: parsedNutrition,
    ingredientsText: parsedIngredients.cleanRawList,
    productName: fallbackProductName,
    brand: null,
    productVariant: null,
    claims: detectedClaims,
    imageType,
    detectionNotes,
    imagesProcessed: imageItems,
    isFrontPackageOnly,
    hasVerifiedNutrition: compiled.hasVerifiedNutritionData || false,
    hasVerifiedIngredients: compiled.hasVerifiedIngredientsData || false,
  };
}
