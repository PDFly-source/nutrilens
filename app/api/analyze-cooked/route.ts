import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Secure cooked-food vision endpoint (v2).
 *
 * - API key lives ONLY in the server environment (GEMINI_API_KEY). It is
 *   never inlined into the client bundle, static files or the repository.
 * - The client sends images; the model returns a STRUCTURED JSON with ranked
 *   dish candidates, visible ingredients and an optional portion estimate.
 * - No fabricated values: unknowns come back null and the pure mapping
 *   (features/engine-v2/vision-mapping.ts) sanitizes everything.
 */
import { mapCookedVision } from '@/features/engine-v2/vision-mapping';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PROMPT = `
You are NutriLens's cooked-food vision classifier. Inspect the photo of prepared/cooked food.

Return ONLY structured JSON matching this shape:
{
  "candidates": [
    { "name": "samosa", "confidence": 0.8 },
    { "name": "pakora", "confidence": 0.2 }
  ],
  "visibleIngredients": ["fried pastry shell", "possible potato filling"],
  "portionEstimateG": 180,
  "note": "Short honest observation, or null"
}

RULES:
- candidates: 1-4 ranked dishes from COMMON INDIAN AND GLOBAL DISHES, best first
  (use simple lowercase names like: samosa, momo, chowmein, instant noodles,
  steamed rice, dal fry, rajma, chole, aloo paratha, pav bhaji, dhokla, pakora,
  biryani, idli, dosa, vada, poha, upma, sandwich, burger, pizza, pasta, salad,
  fruit, dessert, beverage). Confidence is 0..1.
- If the food is a PACKAGED PRODUCT with a readable label, say so in "note"
  and return candidates as [] — packaged products are analyzed by a different
  pipeline.
- If the image is not food at all, return candidates [] and say so in "note".
- visibleIngredients: ONLY what is actually visible in the image. Never
  invent hidden ingredients, oil quantity or salt.
- portionEstimateG: rough grams ONLY if the photo gives a reference (plate,
  hand, pieces); otherwise null.
- Never return nutrition numbers. Another component estimates nutrition from
  a curated database.
`;

interface RequestImageItem {
  data: string;
  mimeType?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on server', configured: false },
        { status: 500 }
      );
    }

    const body = await req.json();
    const images: RequestImageItem[] = body.images || [];
    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [{ text: PROMPT }];
    for (const img of images.slice(0, 3)) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: (img.data || '').replace(/^data:[a-zA-Z0-9/+-]+;base64,/, ''),
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 1024,
      },
    });

    const text = response.text || '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Model occasionally wraps JSON in prose; extract the outermost object.
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const mapped = mapCookedVision(parsed);
    return NextResponse.json({ ...mapped, configured: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Vision analysis failed', configured: true },
      { status: 500 }
    );
  }
}
