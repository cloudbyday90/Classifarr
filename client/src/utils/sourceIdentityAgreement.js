/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const identityAgreementBlockers = Object.freeze({
  no_declared_candidate: 'The source does not declare a TMDb candidate. A lookup match alone cannot replace its identity.',
  no_external_confirmation: 'No external identifier confirms the declared work in TMDb.',
  multiple_candidates: 'The identifiers point to more than one catalog work. Preserve grouped shows; do not choose the first result.',
  missing_catalog_match: 'At least one identifier has no catalog match. That does not prove the identifier is stale or wrong.',
  unsupported_identifier: 'A declared identifier cannot be checked for this media type, such as TVDB for a movie.',
  other_scope_match: 'A lookup also matched another media type, season, episode or person. Whole-work agreement is not established.',
  ambiguous_lookup: 'An individual identifier matched several whole works. Review the ambiguity before choosing a scope.',
  candidate_unavailable: 'Details for a referenced catalog work were not found. Its identity remains unverified.',
})

/** Inputs have already passed the candidate response parser. Audit never grants authority. */
export function parseIdentityAgreement(value, { candidates, lookups }) {
  if (value?.version !== 'source_identity_agreement.v1' || value.basis !== 'tmdb_parent_lookups' ||
      value.completeScopeVerified !== false || value.automaticRecoveryEligible !== false ||
      !['catalog_agreement', 'review_required'].includes(value.status) || !Array.isArray(value.blockers) ||
      value.blockers.length > 8 || new Set(value.blockers).size !== value.blockers.length ||
      value.blockers.some(code => typeof code !== 'string' || !Object.hasOwn(identityAgreementBlockers, code))) return null
  if (value.status === 'catalog_agreement') {
    if (value.blockers.length || candidates.length !== 1 || !candidates[0].available ||
        value.candidateTmdbId !== candidates[0].tmdbId || !lookups.some(entry => entry.provider === 'tmdb_id') ||
        !lookups.some(entry => entry.provider !== 'tmdb_id' && entry.status === 'matched') ||
        lookups.some(entry => !['declared', 'matched'].includes(entry.status) || entry.otherScopeMatches ||
          entry.tmdbIds.length !== 1 || entry.tmdbIds[0] !== value.candidateTmdbId)) return null
  } else if (!value.blockers.length || value.candidateTmdbId !== null) return null
  return { status: value.status, candidateTmdbId: value.candidateTmdbId, blockers: [...value.blockers] }
}
