/**
 * Product resolver (v2): splits recognized package text into
 * brand / product title / flavour / net weight — evidence only.
 *
 * The printed front of a package typically reads like:
 *   MAGGI                    <- brand
 *   2-Minute Masala Noodles  <- product title (+ flavour)
 *   70 g                     <- net weight
 *
 * Nothing here ever uses image filenames.
 */

import { BRAND_LEXICON } from '@/data/brand-lexicon';

export interface ResolvedProduct {
  brand: string | null;
  title: string | null;
  flavour: string | null;
  netWeightG: number | null;
  netWeightRaw: string | null;
}

const FLAVOUR_WORDS = [
  'masala', 'spicy', 'plain', 'sweet', 'sour', 'tangy', 'tomato', 'cheese',
  'butter', 'cream', 'onion', 'garlic', 'ginger', 'chilli', 'chili',
  'pepper', 'lemon', 'salted', 'original', 'classic', 'hot', 'mild',
  'periperi', 'peri peri', 'tandoori', 'paneer', 'mango', 'pickle',
];

const NET_WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(g|gram|grams|kg|ml|l)\b/i;

/** Extract the net quantity from OCR text (front or back). */
export function extractNetWeight(text: string): { grams: number; raw: string } | null {
  const m = (text || '').match(NET_WEIGHT_RE);
  if (!m) return null;
  let value = parseFloat(m[1].replace(',', '.'));
  if (isNaN(value)) return null;
  const unit = m[2].toLowerCase();
  if (unit === 'kg') value *= 1000;
  if (unit === 'l') value *= 1000;
  return { grams: value, raw: `${m[1].trim()} ${m[2]}` };
}

/**
 * Split a recognized title line into title + flavour.
 * "2-Minute Masala Noodles" -> title "2-Minute Noodles", flavour "Masala".
 */
export function splitFlavour(title: string): { title: string; flavour: string | null } {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length < 2) return { title, flavour: null };
  const flavourWords = words.filter((w) =>
    FLAVOUR_WORDS.some((f) => w.toLowerCase().includes(f))
  );
  if (flavourWords.length === 0) return { title, flavour: null };
  const rest = words.filter((w) => !flavourWords.includes(w));
  const flavour = flavourWords
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  if (rest.length === 0) return { title, flavour: null };
  return { title: rest.join(' '), flavour };
}

/**
 * Resolve brand/title/flavour/weight from OCR text lines, reusing the
 * offline brand lexicon for brand detection (whole-text word-boundary match).
 */
export function resolveProduct(ocrText: string): ResolvedProduct {
  const text = (ocrText || '').trim();
  if (!text) {
    return { brand: null, title: null, flavour: null, netWeightG: null, netWeightRaw: null };
  }

  // Brand via lexicon, per-LINE: real packages print the brand line and a
  // separate manufacturer line ("Nestle India Ltd"). A match that sits on a
  // manufacturer-style line is the manufacturer, NOT the product brand —
  // claiming it as the brand is a real-world OCR misidentification we saw
  // in validation, so it is excluded (brand stays honestly null then).
  const MANUFACTURER_RE =
    /\b(ltd|limited|pvt|private|inc|co|company|industries|foods?|farms|dairy|india|enterprises|marketing|address)\b/i;
  let brand: string | null = null;
  const textLines = (text.match(/[^\n]+/g) || [text]).map((l) => l.trim());
  for (const line of textLines) {
    for (const entry of BRAND_LEXICON) {
      const found = entry.aliases.some((alias) => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(line);
      });
      if (found) {
        if (MANUFACTURER_RE.test(line)) continue; // manufacturer line
        brand = entry.display;
        break;
      }
    }
    if (brand) break;
  }

  const netWeight = extractNetWeight(text);

  // Title: the first plausible printed-title line.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 48);

  const isBrandLine = (l: string) =>
    brand !== null && new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(l);

  const titleLine = lines.find((l) => {
    if (isBrandLine(l)) return false;
    if (NET_WEIGHT_RE.test(l) && l.replace(NET_WEIGHT_RE, '').trim().length === 0) return false;
    if (/^\d+$/.test(l)) return false; // numeric junk / filenames never become titles
    if (!/[A-Za-z]{2}/.test(l)) return false;
    const digits = (l.match(/\d/g) || []).length;
    if (digits / l.replace(/\s/g, '').length > 0.5) return false;
    return true;
  });

  let flavour: string | null = null;
  let title: string | null = null;
  if (titleLine) {
    const withoutWeight = titleLine.replace(NET_WEIGHT_RE, '').trim();
    const withFlavour = splitFlavour(withoutWeight || titleLine);
    title = withFlavour.title || null;
    flavour = withFlavour.flavour;
    if (brand && title && title.toLowerCase() === brand.toLowerCase()) title = null;
  }

  return {
    brand,
    title,
    flavour,
    netWeightG: netWeight ? netWeight.grams : null,
    netWeightRaw: netWeight ? netWeight.raw : null,
  };
}
