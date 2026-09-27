/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const sourceReviewReasons = Object.freeze([
  'insufficient_evidence', 'external_ids_disagree', 'candidate_not_supported', 'title_year_mismatch',
])

export const recoveryOutcomeLabels = Object.freeze({
  insufficient_evidence: 'Not enough independent IDs to repair safely',
  adapter_unsupported: 'This source cannot provide a fresh identity check',
  provider_unavailable: 'Metadata provider request failed',
  provider_response_invalid: 'Metadata provider returned unusable data',
  external_evidence_inconclusive: 'Independent IDs did not establish one match',
  external_ids_disagree: 'Independent IDs point to different titles',
  candidate_not_supported: 'Independent match disagrees with the source IDs',
  title_year_mismatch: 'Title or year does not match the independent result',
  source_changed: 'Source metadata changed during verification',
  source_unavailable: 'A fresh source check could not be completed',
  internal_error: 'Recovery could not complete its local checks',
  persistence_failed: 'Verified repair could not be saved',
})

const isDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
export function validRecoveryOutcome(value, asOf) {
  // Additive v1 field: older servers/observations have no recorded outcome.
  if (value == null) return true
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['reason', 'attemptedAt', 'completedAt'].includes(key))) return false
  if (value.reason === null) return isDate(value.attemptedAt) && value.completedAt === null &&
    Date.parse(value.attemptedAt) <= Date.parse(asOf)
  return Object.hasOwn(recoveryOutcomeLabels, value.reason) && isDate(value.completedAt) &&
    Date.parse(value.completedAt) <= Date.parse(asOf) && (value.attemptedAt === null ||
      (isDate(value.attemptedAt) && Date.parse(value.attemptedAt) <= Date.parse(value.completedAt)))
}

export function recoveryOutcomeLabel(outcome) {
  if (!outcome) return 'No recovery result recorded yet'
  return outcome.reason === null ? 'Attempt recorded; completion is not confirmed'
    : recoveryOutcomeLabels[outcome.reason]
}
