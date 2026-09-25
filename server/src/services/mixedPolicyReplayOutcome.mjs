/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { policyDecisionLibraryIdentifier } from '../utils/policyDecisionAuthority.mjs';

export const isCompletedEvaluationOutcome = result => ['automatic', 'proposed', 'abstained'].includes(result?.status);
export const hasEvaluationDestination = result => ['automatic', 'proposed'].includes(result?.status);
export const evaluationDestination = result => hasEvaluationDestination(result) ? String(result.destinationId) : null;

export function evaluationPairKind(results) {
  if (results.length !== 2 || !results.every(isCompletedEvaluationOutcome)) return 'incomplete';
  const automatic = results.filter(result => result.status === 'automatic').length;
  return automatic === 2 ? 'deterministic' : automatic === 1 ? 'mixed' : 'ai';
}

/** Validate the actual policy path; never synthesize provider output or routing authority. */
export function automaticEvaluationOutcome(row, libraries) {
  if (row.outcome?.kind !== 'automatic') return null;
  const destination = policyDecisionLibraryIdentifier(row.common?.policyResult?.library);
  const matches = (libraries ?? []).filter(library => policyDecisionLibraryIdentifier(library.id) === destination);
  if (!['movie', 'tv'].includes(row.mediaType) || !destination || !/^[1-9]\d*$/.test(destination) ||
    !Number.isSafeInteger(Number(destination)) || row.outcome.action !== 'auto_classify' ||
    row.common?.policyResult?.action !== 'auto_classify' || row.common?.mode !== 'skip' ||
    policyDecisionLibraryIdentifier(row.outcome.destination) !== destination || matches.length !== 1 ||
    matches[0].is_active === false || matches[0].media_type !== row.mediaType) {
    return { status: 'unavailable', gap: 'not_adjudication' };
  }
  return { status: 'automatic', destinationId: destination };
}
