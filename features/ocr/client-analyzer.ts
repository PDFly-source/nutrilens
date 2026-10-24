import {
  ProductAnalysis,
  ScanMode,
  ImageType,
  NutritionData,
} from '@/types/food';
import { runLocalOcr } from '@/features/ocr/ocr-service';
import {
  parseNutritionText,
  parseIngredientsText,
  detectMarketingClaimsFromText,
  detectImageTypeFromText,
} from '@/features/ocr/parser';
import { compileProductAnalysis } from '@/features/scoring/engine';

export interface AnalysisProgressCallback {
  (step: string, percent: number): void;
}

export interface AnalysisPipelineResult {
  analysis: ProductAnalysis;
  imageType: ImageType;
  imageTypeLabel: string;
  notes: string;
  isFrontPackageOnly: boolean;
}

/**
 * Convert File or Canvas or Blob into base64 data URL
 */
export async function toBase64(
  input: File | Blob | HTMLCanvasElement
): Promise<string> {
  if (input instanceof HTMLCanvasElement) {
    return input.toDataURL('image/jpeg', 0.88);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(input);
  });
}

/**
 * Analyze any packaged food image using the multi-stage vision pipeline
 */
export async function analyzePackagedFoodImage(
  imageInput: File | Blob | HTMLCanvasElement,
  mode: ScanMode = 'nutrition',
  onProgress?: AnalysisProgressCallback
): Promise<AnalysisPipelineResult> {
  onProgress?.('Validating & Preparing Image...', 15);

  const base64Data = await toBase64(imageInput);

  onProgress?.('Detecting Packaging Type & Layout...', 35);

  // Attempt multimodal vision analysis via /api/analyze-image
  try {
    const res = await fetch('/api/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: 'image/jpeg',
        userHintMode: mode,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        onProgress?.('Extracting Nutritional Intelligence...', 75);

        const d = json.data;
        const imageType: ImageType = d.imageType || 'front_package';
        const imageTypeLabel: string = d.imageTypeLabel || (
          imageType === 'front_package' ? 'Front Packaging / Product Photo' :
          imageType === 'nutrition_label' ? 'Nutrition Facts Panel' :
          imageType === 'ingredients_label' ? 'Ingredients Statement' :
          imageType === 'barcode' ? 'Barcode' : 'Full Packaging'
        );

        const rawNutrition = d.nutritionFacts || {};
        const safeNutrition: NutritionData = {
          servingSize: rawNutrition.servingSize ?? null,
          servingsPerContainer: rawNutrition.servingsPerContainer ?? null,
          calories: typeof rawNutrition.calories === 'number' ? rawNutrition.calories : null,
          totalFat: typeof rawNutrition.totalFat === 'number' ? rawNutrition.totalFat : null,
          saturatedFat: typeof rawNutrition.saturatedFat === 'number' ? rawNutrition.saturatedFat : null,
          transFat: typeof rawNutrition.transFat === 'number' ? rawNutrition.transFat : null,
          cholesterol: typeof rawNutrition.cholesterol === 'number' ? rawNutrition.cholesterol : null,
          sodium: typeof rawNutrition.sodium === 'number' ? rawNutrition.sodium : null,
          totalCarbs: typeof rawNutrition.totalCarbs === 'number' ? rawNutrition.totalCarbs : null,
          dietaryFiber: typeof rawNutrition.dietaryFiber === 'number' ? rawNutrition.dietaryFiber : null,
          totalSugars: typeof rawNutrition.totalSugars === 'number' ? rawNutrition.totalSugars : null,
          addedSugars: typeof rawNutrition.addedSugars === 'number' ? rawNutrition.addedSugars : null,
          protein: typeof rawNutrition.protein === 'number' ? rawNutrition.protein : null,
          iron: typeof rawNutrition.iron === 'number' ? rawNutrition.iron : null,
          calcium: typeof rawNutrition.calcium === 'number' ? rawNutrition.calcium : null,
          potassium: typeof rawNutrition.potassium === 'number' ? rawNutrition.potassium : null,
          vitaminD: typeof rawNutrition.vitaminD === 'number' ? rawNutrition.vitaminD : null,
        };

        const rawIngText = d.rawIngredientsText || (Array.isArray(d.ingredientsList) ? d.ingredientsList.join(', ') : '');
        const parsedIngs = parseIngredientsText(rawIngText);

        // Merge detected allergens from vision if any
        // Allergens flagged by the ingredient parser live on each parsed item.
        const parsedAllergens = Array.from(
          new Set(
            parsedIngs.items
              .map((item) => item.allergenDetected)
              .filter((a): a is string => Boolean(a))
          )
        );
        // Allergen detection is handled by the scoring engine from parsed items.

        const productName =
          d.productName && d.productName !== 'Unknown'
            ? d.productName
            : 'Packaged Food Product';

        onProgress?.('Finalizing Intelligence Report...', 95);

        const analysis = compileProductAnalysis({
          scanMode: mode,
          productName,
          brand: d.brand,
          productVariant: d.flavorVariant,
          packageSize: d.packageSize,
          imageType,
          nutritionConfidence: d.nutritionConfidence || (safeNutrition.calories !== null ? 'high' : 'not_present'),
          detectionNotes: d.detectionNotes,
          barcode: d.barcode || undefined,
          nutrition: safeNutrition,
          ingredients: parsedIngs.items,
          rawIngredientsText: rawIngText,
          detectedClaims: d.marketingClaims || [],
          imagePreviewUrl: base64Data,
        });

        const isFrontPackageOnly =
          imageType === 'front_package' &&
          safeNutrition.calories === null &&
          safeNutrition.protein === null;

        return {
          analysis,
          imageType,
          imageTypeLabel,
          notes: d.detectionNotes || '',
          isFrontPackageOnly,
        };
      }
    }
  } catch (apiErr) {
    console.warn('Server vision API failed, falling back to local OCR:', apiErr);
  }

  // Local OCR Fallback (Tesseract.js + local Regex Parser)
  onProgress?.('Running Local Optical Analysis...', 50);
  let rawText = '';
  try {
    const ocrResult = await runLocalOcr(imageInput, (status, pct) => {
      onProgress?.(`OCR Processing (${Math.round(pct * 100)}%)...`, 50 + pct * 30);
    });
    rawText = ocrResult.text;
  } catch (ocrErr) {
    console.warn('Local OCR fallback error:', ocrErr);
    rawText = '';
  }

  const detectedType: ImageType = detectImageTypeFromText(rawText);
  const parsedNutrition = parseNutritionText(rawText);
  const parsedIngredients = parseIngredientsText(rawText);
  const claims = detectMarketingClaimsFromText(rawText);

  // v2.4.1: filenames are NOT product names ("She.jpg" once became "She").
  // With no validated title evidence the honest answer is "Unknown" and the
  // user types the real name in the review form.
  const fallbackProductName = 'Unknown';

  onProgress?.('Generating Food Intelligence Report...', 95);

  const analysis = compileProductAnalysis({
    scanMode: mode,
    productName: fallbackProductName,
    imageType: detectedType,
    nutritionConfidence: parsedNutrition.calories !== null ? 'low' : 'none',
    detectionNotes:
      parsedNutrition.calories !== null
        ? 'Extracted via on-device OCR from the captured image.'
        : 'No nutrition values could be read from this image.',
    nutrition: parsedNutrition,
    ingredients: parsedIngredients.items,
    rawIngredientsText: parsedIngredients.cleanRawList || rawText,
    detectedClaims: claims,
    imagePreviewUrl: base64Data,
  });

  const isFrontPackageOnly =
    detectedType === 'front_package' &&
    parsedNutrition.calories === null;

  return {
    analysis,
    imageType: detectedType,
    imageTypeLabel:
      detectedType === 'front_package' ? 'Front Packaging / Product Photo' :
      detectedType === 'nutrition_label' ? 'Nutrition Facts Panel' :
      detectedType === 'ingredients_label' ? 'Ingredients Statement' :
      detectedType === 'barcode' ? 'Barcode' : 'Full Packaging',
    notes:
      parsedNutrition.calories !== null
        ? 'Extracted via on-device OCR from the captured image.'
        : 'No nutrition values could be read from this image.',
    isFrontPackageOnly,
  };
}
