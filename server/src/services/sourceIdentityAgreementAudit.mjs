/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Project only the bounded, validated output of readSourceCandidates; never write authority. */
export function auditSourceIdentityAgreement({ candidates, lookups }) {
  const blockers = [];
  if (!lookups.some(entry => entry.provider === 'tmdb_id')) blockers.push('no_declared_candidate');
  if (!lookups.some(entry => entry.provider !== 'tmdb_id' && entry.status === 'matched')) blockers.push('no_external_confirmation');
  if (candidates.length > 1) blockers.push('multiple_candidates');
  if (lookups.some(entry => entry.status === 'no_match')) blockers.push('missing_catalog_match');
  if (lookups.some(entry => entry.status === 'unsupported')) blockers.push('unsupported_identifier');
  if (lookups.some(entry => entry.otherScopeMatches > 0)) blockers.push('other_scope_match');
  if (lookups.some(entry => entry.tmdbIds.length > 1)) blockers.push('ambiguous_lookup');
  if (candidates.some(entry => !entry.available)) blockers.push('candidate_unavailable');
  return {
    version: 'source_identity_agreement.v1', basis: 'tmdb_parent_lookups',
    status: blockers.length ? 'review_required' : 'catalog_agreement',
    candidateTmdbId: blockers.length ? null : candidates[0].tmdbId,
    blockers, completeScopeVerified: false, automaticRecoveryEligible: false,
  };
}
