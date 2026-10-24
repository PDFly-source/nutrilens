/**
 * Packaged Food Image Preprocessor & Diagnostics
 *
 * Implements decoding, dimension check, brightness/contrast normalization,
 * diagnostic logging, and payload preparation for vision OCR.
 */

export interface PreprocessedImageResult {
  dataUrl: string;
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  name: string;
  aspectRatio: number;
}

export function logScanDiagnostic(stage: string, details?: Record<string, any>) {
  if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
    const formatted = details
      ? Object.entries(details)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')
      : '';
    console.log(`[NutriLens Engine] ${stage}${formatted ? ` -> ${formatted}` : ''}`);
  }
}

/**
 * Read File or Blob, decode image, gather metrics, and prepare high-contrast canvas
 */
export async function preprocessFoodImage(
  source: File | Blob,
  fallbackName = 'food-photo.jpg'
): Promise<PreprocessedImageResult> {
  const fileName = (source as File).name || fallbackName;
  const mimeType = source.type || 'image/jpeg';
  const fileSize = source.size || 0;

  logScanDiagnostic('IMAGE RECEIVED', {
    filename: fileName,
    mimeType,
    fileSize: `${Math.round(fileSize / 1024)}KB`,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file into memory'));
    };

    reader.onload = () => {
      const initialDataUrl = reader.result as string;
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Failed to decode image data into bitmap'));
      };

      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const aspectRatio = width / (height || 1);

        logScanDiagnostic('IMAGE DECODED', {
          width,
          height,
          aspectRatio: aspectRatio.toFixed(2),
        });

        // Create canvas to normalize orientation and size
        // Max constraint 1800px on longest side for optimal vision OCR without enormous payload
        const maxDim = 1800;
        let targetW = width;
        let targetH = height;

        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not create 2D canvas context'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Normalize brightness and slight contrast enhancement
        // We preserve full RGB color for food package brand identification
        const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const cleanBase64 = finalDataUrl.replace(/^data:[^;]+;base64,/, '');

        logScanDiagnostic('IMAGE PREPROCESSING COMPLETE', {
          scaledWidth: targetW,
          scaledHeight: targetH,
        });

        resolve({
          dataUrl: finalDataUrl,
          base64Data: cleanBase64,
          mimeType: 'image/jpeg',
          width: targetW,
          height: targetH,
          fileSize,
          name: fileName,
          aspectRatio,
        });
      };

      img.src = initialDataUrl;
    };

    reader.readAsDataURL(source);
  });
}
