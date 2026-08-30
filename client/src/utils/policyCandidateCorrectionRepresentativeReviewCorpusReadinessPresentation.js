/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const CORPUS_VERSION = 'policy.candidate_correction_representative_review_corpus.v1'
const SUSTAINED_REVIEW_SIGNAL = 'sustained_review_signal'
const REQUIRED_SAFEGUARD_IDS = Object.freeze([
  'authorization',
  'redaction',
  'retention',
  'operator_audit',
])
const REQUIRED_SAFEGUARDS = Object.freeze([
  Object.freeze({ id: 'authorization', label: 'Authorization', description: 'A record-level review route must enforce an explicit administrator authorization boundary.' }),
  Object.freeze({ id: 'redaction', label: 'Redaction', description: 'The review projection must remove metadata, provider, prompt, response, and RAG text not needed for the review purpose.' }),
  Object.freeze({ id: 'retention', label: 'Retention', description: 'The sampled corpus needs a documented retention and deletion rule before it is persisted or exported.' }),
  Object.freeze({ id: 'operator_audit', label: 'Operator audit', description: 'Each selection and review outcome needs an immutable operator-owned audit record.' }),
])

const DESIGN_REQUIRED_PRESENTATION = Object.freeze({
  heading: 'Historical review corpus is not enabled',
  message: 'The sustained aggregate signal supports reviewing current decisions, but Classifarr has not selected or exposed historical records. A historical corpus needs explicit safeguards first.',
  disclosureLabel: 'View required safeguards for a future historical corpus',
  announcement: 'Historical review records remain unavailable pending required safeguards.',
  safeguards: REQUIRED_SAFEGUARDS,
})

function matchesRequiredSafeguards(value) {
  return Array.isArray(value) && value.length === REQUIRED_SAFEGUARD_IDS.length &&
    value.every((entry, index) => entry === REQUIRED_SAFEGUARD_IDS[index])
}

function validReviewFrame(value) {
  return value?.periodCount === 2 && value?.completedUtcDaysPerPeriod === 28 &&
    Array.isArray(value?.strata) && value.strata.length === 2 &&
    value.strata[0] === 'score_margin_band' &&
    value.strata[1] === 'operator_selection_outcome'
}

/**
 * Retains only a server-verifiable, content-free corpus-preflight state. Any
 * record data, arbitrary safeguards, or mismatched trend relation fails closed.
 */
export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusReadiness(
  value,
  trend,
) {
  const historicalReviewIsIndicated = trend?.statusId === SUSTAINED_REVIEW_SIGNAL
  const expectedStatusId = historicalReviewIsIndicated
    ? 'historical_corpus_design_required'
    : 'review_not_indicated'
  const hasExpectedFrame = historicalReviewIsIndicated
    ? validReviewFrame(value?.reviewFrame)
    : value?.reviewFrame === null
  const hasExpectedSafeguards = historicalReviewIsIndicated
    ? matchesRequiredSafeguards(value?.requiredSafeguardIds)
    : Array.isArray(value?.requiredSafeguardIds) && value.requiredSafeguardIds.length === 0

  if (value?.version !== CORPUS_VERSION || value?.statusId !== expectedStatusId ||
      value?.historicalRecordAccess !== false || !hasExpectedFrame || !hasExpectedSafeguards) {
    return null
  }

  return Object.freeze({
    statusId: expectedStatusId,
    historicalRecordAccess: false,
  })
}

export function getPolicyCandidateCorrectionRepresentativeReviewCorpusPresentation(statusId) {
  return statusId === 'historical_corpus_design_required'
    ? DESIGN_REQUIRED_PRESENTATION
    : null
}
