/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { identityAgreementBlockers } from './sourceIdentityAgreement'

export function parseCombinedEvidence(value, scope, comparison) {
  if (value?.version !== 'source_combined_evidence.v1' || value.crossProviderVerified !== false ||
      value.automaticRecoveryEligible !== false || !/^[a-f0-9]{64}$/.test(value.fingerprint ?? '') ||
      !Array.isArray(value.parentBlockers) || value.parentBlockers.length > 8 ||
      new Set(value.parentBlockers).size !== value.parentBlockers.length ||
      value.parentBlockers.some(code => typeof code !== 'string' || !Object.hasOwn(identityAgreementBlockers, code))) return null
  const parentAgrees = value.parentBlockers.length === 0
  if (parentAgrees ? !Number.isSafeInteger(value.candidateTmdbId) || value.candidateTmdbId < 1 || value.candidateTmdbId > 2147483647
    : value.candidateTmdbId !== null) return null
  const works = scope.kind === 'whole_work' ? [scope.tmdbId] : [...new Set(scope.mappings.map(item => item.tmdbSeriesId))]
  const scopeComplete = comparison.total > 0 && comparison.matched === comparison.total && comparison.exclusions.length === 0 &&
    (scope.kind === 'whole_work' || scope.coverage === 'complete')
  const proposalMatchesIdentity = parentAgrees && works.length === 1 && works[0] === value.candidateTmdbId
  const status = scopeComplete && proposalMatchesIdentity ? 'catalog_and_scope_agreement' : 'review_required'
  if (value.status !== status || value.scopeComplete !== scopeComplete || value.proposalMatchesIdentity !== proposalMatchesIdentity) return null
  return { status, scopeComplete, proposalMatchesIdentity, parentBlockers: [...value.parentBlockers], fingerprint: value.fingerprint }
}
