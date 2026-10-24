/**
 * Pure mapping for vision-model dish classification responses.
 *
 * Shared by the server route (app/api/analyze-cooked) and the client
 * (vision-provider) so the contract is tested in one place.
 */

export interface DishCandidate {
  name: string;
  confidence: number; // 0..1
  /** Resolved NutriLens dish id (browser-model candidates carry it directly). */
  dishId?: string;
  /** 'direct' = the class IS the dish; 'near' = same family, user must confirm. */
  kind?: 'direct' | 'near';
  /** Honest caveat shown with near-matches. */
  note?: string;
  /** Raw Food-101 class name for transparency/debugging. */
  rawClass?: string;
}

export interface CookedVisionResult {
  /** Ranked candidate dishes, best first. May be empty. */
  candidates: DishCandidate[];
  /** Ingredients visibly identifiable in the photo. */
  visibleIngredients: string[];
  /** Rough portion estimate in grams when the model can justify one. */
  portionEstimateG: number | null;
  /** Model's honest note, shown to the user. */
  note: string | null;
}

const MAX_CANDIDATES = 4;

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > 80) return null;
  // Guard against the model returning junk/numbers as dish names.
  if (!/[a-zA-Z]{2}/.test(t)) return null;
  return t.toLowerCase();
}

/**
 * Map a raw model JSON payload into a ranked, sanitized result.
 * Invalid/absent entries are dropped — never fabricated.
 */
export function mapCookedVision(raw: unknown): CookedVisionResult {
  const out: CookedVisionResult = {
    candidates: [],
    visibleIngredients: [],
    portionEstimateG: null,
    note: null,
  };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;

  const rawCandidates = Array.isArray(r.candidates) ? r.candidates : [];
  const seen = new Set<string>();
  for (const c of rawCandidates) {
    if (out.candidates.length >= MAX_CANDIDATES) break;
    const item = (c ?? {}) as Record<string, unknown>;
    const name = normalizeName(item.name ?? item.dish);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.candidates.push({ name, confidence: clamp01(item.confidence ?? 0.5) });
  }
  // Rank by confidence descending.
  out.candidates.sort((a, b) => b.confidence - a.confidence);

  if (Array.isArray(r.visibleIngredients)) {
    out.visibleIngredients = r.visibleIngredients
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0 && v.trim().length < 60)
      .map((v) => v.trim())
      .slice(0, 12);
  }

  const portion = r.portionEstimateG ?? r.portion_estimate_g;
  const p = typeof portion === 'number' ? portion : parseFloat(String(portion));
  if (!isNaN(p) && p > 0 && p <= 3000) out.portionEstimateG = Math.round(p);

  if (typeof r.note === 'string' && r.note.trim()) out.note = r.note.trim().slice(0, 400);

  return out;
}

/**
 * Ambiguity policy: the top candidate is auto-applied only when clearly ahead.
 * Otherwise the user must confirm — the app never silently guesses a dish.
 */
export function isAmbiguous(candidates: DishCandidate[]): boolean {
  if (candidates.length === 0) return true;
  const top = candidates[0];
  if (top.confidence < 0.65) return true;
  const second = candidates[1];
  if (second && top.confidence - second.confidence < 0.15) return true;
  return false;
}
