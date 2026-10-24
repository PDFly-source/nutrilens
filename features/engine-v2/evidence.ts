/**
 * Evidence store (v2): per-field provenance, validation and merge policy.
 *
 * Rules enforced here (tested in evidence.test.ts):
 *  - unknown stays unknown; never coerced to 0
 *  - user edits always win and mark the field user_provided/verified
 *  - a database candidate never overwrites visually-observed or user evidence
 *  - disagreements between two non-user sources become 'conflict'
 */

import { EvidenceField, FieldEvidenceMap, Provenance } from './types';

/** Priority for merging: higher wins when both present. */
const PROVENANCE_PRIORITY: Record<Provenance, number> = {
  user_provided: 100,
  visually_observed: 60,
  database_derived: 40,
  ai_estimated: 20,
  unknown: 0,
};

export function unknownField(sourceLabel = 'Not detected'): EvidenceField {
  return {
    value: null,
    provenance: 'unknown',
    validation: 'unavailable',
    extractionConfidence: 0,
    sourceLabel,
  };
}

export function field(
  value: number | string | null,
  provenance: Provenance,
  confidence: number,
  sourceLabel: string
): EvidenceField {
  return {
    value,
    provenance,
    validation: value === null ? 'unavailable' : 'extracted',
    extractionConfidence: confidence,
    sourceLabel,
  };
}

/**
 * Merge incoming evidence into existing evidence for ONE field.
 * Returns the merged field plus whether a conflict was flagged.
 */
export function mergeField(
  existing: EvidenceField | undefined,
  incoming: EvidenceField
): { merged: EvidenceField; conflict: boolean } {
  if (!existing || existing.value === null || existing.validation === 'unavailable') {
    return { merged: incoming, conflict: false };
  }
  if (incoming.value === null || incoming.validation === 'unavailable') {
    // Empty evidence NEVER erases real evidence.
    return { merged: existing, conflict: false };
  }

  const existingPriority = PROVENANCE_PRIORITY[existing.provenance];
  const incomingPriority = PROVENANCE_PRIORITY[incoming.provenance];

  // Equal non-null values: strengthen, combine provenance note.
  if (existing.value === incoming.value) {
    return {
      merged: {
        ...existing,
        validation: 'verified',
        extractionConfidence: Math.max(existing.extractionConfidence, incoming.extractionConfidence),
        sourceLabel: `${existing.sourceLabel} + ${incoming.sourceLabel}`,
      },
      conflict: false,
    };
  }

  // User evidence always wins.
  if (existing.provenance === 'user_provided') {
    return { merged: existing, conflict: false };
  }

  // Lower-priority incoming never silently overwrites higher-priority existing:
  // flag a conflict instead.
  if (incomingPriority < existingPriority) {
    return { merged: { ...existing, validation: 'conflict' }, conflict: true };
  }
  if (incomingPriority > existingPriority) {
    return { merged: { ...incoming, validation: 'conflict' }, conflict: true };
  }

  // Same priority, different values → conflict, keep existing for review.
  return { merged: { ...existing, validation: 'conflict' }, conflict: true };
}

/**
 * Merge a whole evidence map. Returns merged map + list of conflicted keys.
 */
export function mergeEvidence(
  existing: FieldEvidenceMap,
  incoming: Record<string, EvidenceField>
): { merged: FieldEvidenceMap; conflicts: string[] } {
  const merged: FieldEvidenceMap = { ...existing };
  const conflicts: string[] = [];
  for (const [key, inc] of Object.entries(incoming)) {
    const { merged: m, conflict } = mergeField(merged[key], inc);
    merged[key] = m;
    if (conflict) conflicts.push(key);
  }
  return { merged, conflicts };
}

/** Mark a field as corrected by the user. */
export function applyUserEdit(map: FieldEvidenceMap, key: string, value: number | string | null): FieldEvidenceMap {
  const current = map[key] ?? unknownField();
  return {
    ...map,
    [key]: {
      value,
      provenance: 'user_provided',
      validation: 'verified',
      extractionConfidence: 1,
      sourceLabel: current.provenance === 'user_provided' ? current.sourceLabel : `${current.sourceLabel} → edited by you`,
    },
  };
}

/**
 * Confidence of the extraction vs reliability of the source.
 * High OCR confidence never inflates database reliability, and vice versa.
 */
export function overallReliability(f: EvidenceField): { extraction: number; source: number } {
  const sourceReliability: Record<Provenance, number> = {
    user_provided: 1,
    visually_observed: 0.8,
    database_derived: 0.7,
    ai_estimated: 0.4,
    unknown: 0,
  };
  return { extraction: f.extractionConfidence, source: sourceReliability[f.provenance] };
}
