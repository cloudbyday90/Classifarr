/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const scopeExclusionLabels = Object.freeze({
  unmapped_season: 'No season mapping proposed',
  ambiguous_episode_ids: 'Conflicting episode IDs',
  reused_episode_id: 'An episode ID is used more than once',
  missing_tmdb_episode_id: 'No TMDb episode ID supplied',
  episode_absent_from_scope: 'Episode ID not found in the proposed catalog scope',
  episode_outside_mapping: 'Episode belongs to a different series or season',
  episode_numbering_differs: 'Episode numbering differs',
  parent_identity_unresolved: 'Source does not declare this as its single TMDb movie ID',
})
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000

export function parseSourceScopeEvidence(data, draft) {
  const comparison = data?.comparison
  if (data?.version !== 'source_scope_evidence.v1' || data.sourceKey !== draft.sourceKey ||
      data.sourceVersion !== draft.sourceVersion || data.draftFingerprint !== draft.draftFingerprint ||
      data.canApply !== false || data.persisted !== false || data.crossProviderVerified !== false ||
      data.verification !== 'typed_catalog_membership' || data.backfill?.eligible !== false ||
      data.backfill.excludedScope !== 'all' || typeof data.reference !== 'string' ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.reference) ||
      !['movie', 'episode'].includes(comparison?.unit) || !count(comparison.total) ||
      comparison.total > 2000 || !count(comparison.matched) || !Array.isArray(comparison.exclusions) ||
      comparison.exclusions.length !== comparison.total - comparison.matched) return null
  const positions = new Set()
  const exclusions = []
  for (const value of comparison.exclusions) {
    if (!Object.hasOwn(scopeExclusionLabels, value?.reason)) return null
    if (comparison.unit === 'episode') {
      if (!count(value.season) || !count(value.episode) || value.reason === 'parent_identity_unresolved') return null
      const position = `${value.season}:${value.episode}`
      if (positions.has(position)) return null
      positions.add(position)
      exclusions.push({ season: value.season, episode: value.episode, reason: value.reason })
    } else {
      if (comparison.total !== 1 || value.reason !== 'parent_identity_unresolved') return null
      exclusions.push({ reason: value.reason })
    }
  }
  if (comparison.unit === 'movie' && comparison.total !== 1) return null
  return { reference: data.reference, unit: comparison.unit, total: comparison.total,
    matched: comparison.matched, exclusions }
}
