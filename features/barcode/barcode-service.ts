/**
 * Client-Side Barcode Detection Service
 * 
 * Uses the Web Standards Barcode Detection API (BarcodeDetector) where supported in modern browsers.
 * In accordance with strict privacy & transparency guidelines, this does NOT make external database calls or fabricate brand records.
 */

export interface BarcodeResult {
  rawValue: string;
  format: string;
}

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export async function detectBarcodeFromImage(
  imageSource: ImageBitmapSource
): Promise<BarcodeResult | null> {
  if (!isBarcodeDetectorSupported()) {
    return null;
  }

  try {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
    const detector = new BarcodeDetectorClass({ formats });
    const barcodes = await detector.detect(imageSource);

    if (barcodes && barcodes.length > 0) {
      return {
        rawValue: barcodes[0].rawValue,
        format: barcodes[0].format,
      };
    }
  } catch (err) {
    console.warn('BarcodeDetector error:', err);
  }

  return null;
}
