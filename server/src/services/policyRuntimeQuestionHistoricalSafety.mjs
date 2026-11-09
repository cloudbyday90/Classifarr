/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPolicyDecisionCandidate, policyDecisionAction } from '../utils/policyDecisionAuthority.mjs';
import { buildClassificationRouteSafetyProjection, evaluateClassificationRouteSafety } from './classificationRouteSafetyGate.mjs';

function historicalScore(value) {
  if (typeof value === 'string') {
    if (value.length > 32 || !value.trim()) return null;
    value = Number(value);
  }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
}

/** Preserve an existing legacy refusal only. Positional/global evidence here
 * cannot identify a displayed candidate, supply numbers or authorize an action. */
export function hasLegacyPolicyReviewHistoricalHold({ classification, question, candidateDestinations, policyResult, persistedRouteSafety }) {
  if (['prompt_select', 'prompt_confirm'].includes(policyDecisionAction(policyResult))) return false;
  const destination = candidateDestinations[0] || null;
  const policyCandidate = getPolicyDecisionCandidate(policyResult, destination);
  const candidates = Array.isArray(question?.meta?.candidates) ? question.meta.candidates.slice(0, 64) : [];
  const questionCandidate = destination ? candidates.find(candidate =>
    (typeof candidate?.library_id === 'number' || typeof candidate?.library_id === 'string') &&
    Number(candidate.library_id) === destination.library_id) : null;
  const score = historicalScore(policyCandidate?.score) ?? historicalScore(policyResult.confidence) ??
    historicalScore(questionCandidate?.score) ?? historicalScore(classification.confidence);
  const threshold = historicalScore(policyCandidate?.auto_classify_threshold) ?? historicalScore(policyResult.thresholds?.auto_classify);
  if (score === null || threshold === null || score < threshold) return false;
  const safety = persistedRouteSafety || buildClassificationRouteSafetyProjection(evaluateClassificationRouteSafety({
    result: { method: classification.method, confidence: classification.confidence, library: destination, policyResult }, policyResult,
  }));
  const gate = safety?.primary_gate;
  return !gate || !persistedRouteSafety && gate.id === 'policy_threshold_unavailable';
}
