import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RequestImageItem {
  data: string;
  mimeType: string;
  name?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on server', isFallbackNeeded: true },
        { status: 500 }
      );
    }

    const body = await req.json();
    const images: RequestImageItem[] = body.images || [];

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'No image data provided for analysis' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Prepare contents array with image parts
    const parts: any[] = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      // Strip data:image/...;base64, prefix if present
      const cleanBase64 = img.data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
      const mime = img.mimeType || 'image/jpeg';

      parts.push({
        inlineData: {
          mimeType: mime,
          data: cleanBase64,
        },
      });
    }

    const promptText = `
You are NutriLens's expert food packaging vision and OCR intelligence engine.
Inspect the attached image(s) of packaged food product(s) (e.g. front label, back label with nutrition table and ingredients, barcode, or multiple views).

ABSOLUTE CRITICAL RULES:
1. UNKNOWN VALUES MUST BE NULL. NEVER DEFAULT TO ZERO.
   - If protein, calories, sugar, fat, or sodium are NOT visible or cannot be read, you MUST return null.
   - ONLY return 0 if the source package explicitly prints "0", "0 g", "0.0", "Nil", or "<0.1g".
2. IMAGE CLASSIFICATION:
   - If the user provides a FRONT PACKAGE (brand, product title, marketing claims like "Bikaji Bikaneri Bhujia" or "Maggi 2-Minute Noodles"), detect imageType="front_package". If the nutrition table is NOT present on this side, all nutrition values MUST be null.
   - If the image contains a NUTRITION FACTS TABLE / NUTRITION INFORMATION panel, detect imageType="nutrition_label" or "back_package".
   - If the image contains both or multiple panels (or 2 images: front + back), detect "multi_panel" or "full_package" and merge brand/title from front and nutrition/ingredients from back.
3. SERVING SIZE:
   - Do NOT default to "1 package / serving". If the label says "Per 100g", use "100g". If it says "Serving size: 30g", use "30g". If not stated or unreadable, return null.
4. INGREDIENTS STATEMENT:
   - Extract the actual clean ingredients list.
   - DO NOT accept random OCR noise, symbols, or gibberish (e.g. "XD", "ngodies", "H rb MAG msl").
   - If ingredients are not visible or unreadable, return an empty array [] and null rawIngredientsText.
5. INDIAN & GLOBAL FOOD PACKAGES:
   - Accurately parse Indian food labels (e.g. Bikaji, Haldiram, Nestle India, ITC): Energy (kcal/kJ), Protein, Carbohydrate (of which sugars, added sugars), Total Fat (Saturated fatty acids, Trans fatty acids), Sodium/Salt, Dietary fibre.
   - If salt is listed in grams and sodium is not, keep sodiumMg as null or calculate sodiumMg = saltG * 393.4.

Return a SINGLE strictly valid JSON object matching this schema:
{
  "imageType": "front_package" | "back_package" | "nutrition_label" | "ingredients_label" | "barcode" | "full_package" | "multi_panel" | "unusable",
  "product": {
    "brand": string | null,
    "name": string | null,
    "variant": string | null,
    "packageSize": string | null
  },
  "serving": {
    "size": string | null,
    "unit": string | null,
    "servingsPerContainer": number | null
  },
  "nutrition": {
    "energyKcal": number | null,
    "energyKj": number | null,
    "proteinG": number | null,
    "carbohydrateG": number | null,
    "totalSugarG": number | null,
    "addedSugarG": number | null,
    "fiberG": number | null,
    "totalFatG": number | null,
    "saturatedFatG": number | null,
    "transFatG": number | null,
    "cholesterolMg": number | null,
    "sodiumMg": number | null,
    "saltG": number | null,
    "basis": "per_100g" | "per_serving" | "per_package" | null
  },
  "ingredients": string[],
  "rawIngredientsText": string | null,
  "allergens": string[],
  "barcode": string | null,
  "claims": string[],
  "nutritionConfidence": "high" | "medium" | "low" | "none",
  "detectionNotes": string
}
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse model JSON output');
      }
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    console.error('Vision analysis API error:', err);
    return NextResponse.json(
      {
        error: err.message || 'Vision analysis failed',
        isFallbackNeeded: true,
      },
      { status: 500 }
    );
  }
}
