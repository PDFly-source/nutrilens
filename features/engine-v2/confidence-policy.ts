/**
 * Confidence & unknown policy (v2.3).
 *
 * One tested place decides what a recognition score MEANS:
 *  - 'auto'     — strong evidence, single clear dish: preselect it (the user
 *                 can still change it on the confirm screen).
 *  - 'confirm'  — plausible candidates exist but are ambiguous: rank them and
 *                 require user confirmation (near-mappings ALWAYS land here).
 *  - 'unknown'  — nothing mapped, or everything is weak: say so honestly and
 *                 ask for manual selection. No forcing, ever.
 *
 * Raw softmax outputs are NOT calibrated probabilities; the thresholds below
 * are operational decision rules, and every surfaced number is labelled a
 * "model score", not a probability of correctness.
 */

import type { DishCandidate } from './vision-mapping';

export const POLICY_VERSION = '2.3.0';

/** Above this top score a DIRECT match may be preselected automatically. */
export const DIRECT_AUTO_THRESHOLD = 0.55;
/** A near-mapping (dumplings→momo) always requires confirmation, however high. */
export const NEAR_CONFIRM_ONLY = true;
/** Below this top score, with no mapped candidate, we declare unknown. */
export const UNKNOWN_TOP_SCORE = 0.2;

export type PolicyDecision = 'auto' | 'confirm' | 'unknown';

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

export function classifyConfidence(candidates: DishCandidate[]): PolicyResult {
  if (candidates.length === 0) {
    return { decision: 'unknown', reason: 'No dish candidate was mapped from the model output.' };
  }
  const top = candidates[0];
  if (top.kind === 'near' && NEAR_CONFIRM_ONLY) {
    return {
      decision: 'confirm',
      reason: `"${top.name}" is a close relative of the preselected dish, not a verified identification — please confirm.`,
    };
  }
  // Gap check: a near-tie between the top two is a tie in practice.
  const second = candidates[1];
  if (second && top.confidence - second.confidence < 0.15) {
    return {
      decision: 'confirm',
      reason: `Top candidates are close ("${top.name}" vs "${second.name}") — please confirm.`,
    };
  }
  if (top.kind === 'direct' && top.confidence >= DIRECT_AUTO_THRESHOLD) {
    return { decision: 'auto', reason: `Clear direct match: "${top.name}".` };
  }
  if (top.confidence < UNKNOWN_TOP_SCORE) {
    return {
      decision: 'unknown',
      reason: 'The model had no confident dish match for this photo.',
    };
  }
  return { decision: 'confirm', reason: `Possible match "${top.name}" — please confirm.` };
}

/** UI copy constant: scores are model scores, never calibrated probabilities. */
export const SCORE_DISCLAIMER =
  'Percentages are relative model scores, not probabilities of being correct.';
