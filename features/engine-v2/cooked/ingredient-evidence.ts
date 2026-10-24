/**
 * Ingredient evidence labelling (v2.3).
 *
 * Formalizes the three evidence categories the report shows:
 *  1. 'visual'  — seen in the photo or explicitly selected by the user.
 *  2. 'typical' — inferred from the confirmed dish's typical recipe. NOT
 *                 observed; shown with a "typical" badge.
 *  3. 'unknown' — things a photo cannot reveal (oil, salt, hidden filling),
 *                 surfaced so the user can supply them.
 *
 * A photo never proves an ingredient list; every item carries its evidence
 * status into the report.
 */

import type { DishDefinition } from '../types';

export type IngredientEvidenceKind = 'visual' | 'typical' | 'unknown';

export interface IngredientEvidenceItem {
  name: string;
  evidence: IngredientEvidenceKind;
  /** Short human explanation of why this item has its status. */
  note: string;
}

export function buildIngredientEvidence(
  dish: DishDefinition,
  visuallyConfirmed: string[],
  userNotes: string[] = []
): IngredientEvidenceItem[] {
  const visual = new Set(
    [...visuallyConfirmed, ...userNotes].map((v) => v.trim().toLowerCase()).filter(Boolean)
  );
  const items: IngredientEvidenceItem[] = [];
  const seen = new Set<string>();

  for (const name of visual) {
    if (seen.has(name)) continue;
    seen.add(name);
    items.push({
      name,
      evidence: 'visual',
      note: 'You confirmed this in the review screen.',
    });
  }
  for (const name of dish.typicalVisible) {
    if (visual.has(name.toLowerCase()) || seen.has(name)) continue;
    seen.add(name);
    items.push({
      name,
      evidence: 'typical',
      note: 'Typical for this dish — not necessarily in your portion.',
    });
  }
  for (const name of dish.typicalHidden) {
    if (seen.has(name)) continue;
    seen.add(name);
    items.push({
      name,
      evidence: 'unknown',
      note: 'Cannot be known from a photo — edit the report if you know it.',
    });
  }
  return items;
}

/** Convenience for report rendering: group items by evidence kind. */
export function groupByEvidence(items: IngredientEvidenceItem[]): Record<IngredientEvidenceKind, string[]> {
  const out: Record<IngredientEvidenceKind, string[]> = { visual: [], typical: [], unknown: [] };
  for (const it of items) out[it.evidence].push(it.name);
  return out;
}
