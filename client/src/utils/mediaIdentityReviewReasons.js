/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const reasons = {
  missing_year: 'The source has no year to verify a title match.',
  invalid_request: 'The source identity details are incomplete or invalid.',
  invalid_response: 'The provider returned details that could not be verified.',
  incomplete_results: 'The provider results were incomplete.',
  ambiguous_title_year: 'More than one title and year matched.',
  no_exact_title_year_match: 'No exact title and year match was found.',
  provider_unavailable: 'The identity provider was unavailable.',
  invalid_external_id: 'A supplied external ID is invalid.',
  conflicting_external_ids: 'The supplied external IDs identify different items.',
  incomplete_external_evidence: 'Some supplied external IDs could not be verified.',
  duplicate_external_results: 'An external ID returned duplicate results.',
  ambiguous_external_id: 'An external ID identifies more than one item.',
  external_result_limit: 'The external ID returned too many results to verify.',
}

export function mediaIdentityReviewReason(reason) {
  return Object.hasOwn(reasons, reason) ? reasons[reason] : 'The source identity needs operator verification.'
}
