/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const PROVIDERS = Object.freeze(['imdb_id', 'tvdb_id']);
const COUNTERS = Object.freeze(['lookups', 'matched', 'notFound', 'reviewRequired',
  'lookupsWithOtherMediaResults', 'notFoundWithOtherMediaResults']);

/** Counts describe TMDb responses, never whether the external record exists. */
export function countCrossReferenceLookups(findings = []) {
  return {
    lookups: findings.length,
    matched: findings.filter(item => item.status === 'resolved').length,
    notFound: findings.filter(item => item.status === 'not_found').length,
    reviewRequired: findings.filter(item => item.status === 'review_required').length,
    lookupsWithOtherMediaResults: findings.filter(item => item.otherMediaResults).length,
    notFoundWithOtherMediaResults: findings.filter(item => item.status === 'not_found' && item.otherMediaResults).length,
  };
}

export function countCrossReferenceProviders(findings = []) {
  return Object.fromEntries(PROVIDERS.map(provider => [provider,
    countCrossReferenceLookups(findings.filter(item => item.source === provider)),
  ]));
}

/** Only fixed numeric counters escape transient, source-rechecked findings. */
export function addCrossReferenceCounts(summary, finding) {
  for (const key of COUNTERS) {
    summary.stableEvidenceLookups[key] += finding[key] ?? 0;
    for (const provider of PROVIDERS) {
      summary.stableEvidenceByProvider[provider][key] += finding.byProvider?.[provider]?.[key] ?? 0;
    }
  }
}
