/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const auditCaptureLabels = Object.freeze({ invalid: 'Invalid comparison or observation group',
  duplicateIdentityOrDescription: 'Later comparison in an already held-out group', unboundCaptures: 'Legacy comparison without frozen identity',
  identityMismatchCaptures: 'History and frozen comparison identity differ', conflicting: 'Conflicting destination evidence',
  unverifiedCaptures: 'Missing or insufficient proof of a scored operator action', awaitingOutcome: 'Awaiting an eligible operator outcome',
  unavailable: 'Selected destination unavailable', mixedKinds: 'Mixed confirmation and change evidence',
  outsideCandidateScope: 'Choice outside the frozen candidate set' })
export const auditObservationLabels = Object.freeze({ missingSnapshotRows: 'Missing retained snapshot', unknownKindRows: 'Unknown legacy action kind',
  selectionOnlyRows: 'Destination selection without an explicit confirmation/change command',
  unverifiedOutcomeRows: 'Unverified legacy outcome', identityMismatchRows: 'Outcome identity differs from frozen comparison',
  sourceOnlyRows: 'Source-only identity', unavailableOutcomeRows: 'Unavailable destination', excludedTemporalRows: 'Outside the outcome time bounds' })
const messages = Object.freeze({ never_run: 'The evidence audit has not completed its first pass.', unavailable: 'The saved evidence audit is unavailable on this server.',
  invalid: 'The saved evidence audit could not be verified. Counts are withheld.', stale: 'The evidence audit is stale. Counts are withheld until a new pass completes.',
  busy: 'The evidence audit is waiting for foreground work to finish.', memory_pressure: 'The evidence audit is waiting for memory safeguards.',
  memory_unknown: 'The evidence audit could not verify available memory.', evidence_budget: 'The evidence audit exceeded its inspection capacity. Counts are withheld.',
  invalid_evidence: 'The evidence audit found evidence it could not validate. Counts are withheld.',
  deadline: 'The evidence audit reached its time limit. It will retry automatically.',
  evaluation_unavailable: 'The evidence audit could not complete. It will retry automatically.' })
export function evidenceGapAuditMessage(audit) {
  if (!audit) return 'The saved evidence audit is not available.'
  if (audit.status !== 'complete') return messages[audit.reason ?? audit.status] ?? messages.evaluation_unavailable
  const { intake, comparisons } = audit.report
  if (intake.recordedMovieTvEvents === 0) return 'No retained movie or TV intake in this audit window.'
  if (comparisons.inspected === 0) return 'No retained complete comparisons in this window. Some decisions do not need this comparison.'
  return `Audited ${comparisons.inspected} retained comparisons; ${comparisons.eligible} groups have eligible operator evidence.`
}
