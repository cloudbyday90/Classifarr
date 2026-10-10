/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const integer = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647
const unique = values => Array.isArray(values) && new Set(values).size === values.length
export const candidateProviderLabels = Object.freeze({ tmdb_id: 'TMDb', imdb_id: 'IMDb', tvdb_id: 'TVDB' })
export const candidateLookupLabels = Object.freeze({
  declared: 'Declared directly by your media server', matched: 'Catalog match found',
  no_match: 'No catalog match found', other_scope: 'Only other types or scopes matched',
  unsupported: 'This identifier type cannot be looked up for movies',
})

export function parseSourceCandidates(data, source) {
  if (data?.version !== 'source_candidates.v1' || data.sourceKey !== source.key ||
      data.sourceVersion !== source.sourceVersion || data.mediaType !== source.mediaType ||
      !['movie', 'tv'].includes(data.mediaType) || data.canApply !== false || data.persisted !== false ||
      typeof data.reference !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.reference) ||
      typeof data.asOf !== 'string' || !Number.isFinite(Date.parse(data.asOf)) ||
      !Array.isArray(data.lookups) || data.lookups.length > 8 ||
      !Array.isArray(data.candidates) || data.candidates.length > 8) return null
  const declarations = new Set(), lookups = []
  for (const item of data.lookups) {
    if (!Object.hasOwn(candidateProviderLabels, item?.provider) ||
        !Object.hasOwn(candidateLookupLabels, item.status) ||
        (item.provider === 'imdb_id' ? typeof item.id !== 'string' || !/^tt[0-9]{1,12}$/.test(item.id) : !integer(item.id)) ||
        !unique(item.tmdbIds) || item.tmdbIds.length > 8 || !item.tmdbIds.every(integer) ||
        !Number.isSafeInteger(item.otherScopeMatches) || item.otherScopeMatches < 0 || item.otherScopeMatches > 20) return null
    const declaration = `${item.provider}:${item.id}`
    if (declarations.has(declaration)) return null
    declarations.add(declaration)
    const expected = item.provider === 'tmdb_id' ? 'declared'
      : item.provider === 'tvdb_id' && data.mediaType === 'movie' ? 'unsupported'
        : item.tmdbIds.length ? 'matched' : item.otherScopeMatches ? 'other_scope' : 'no_match'
    if (item.status !== expected || (expected === 'declared' && (item.tmdbIds.length !== 1 || item.tmdbIds[0] !== item.id || item.otherScopeMatches !== 0)) ||
        (expected === 'unsupported' && (item.tmdbIds.length || item.otherScopeMatches))) return null
    lookups.push({ provider: item.provider, id: item.id, status: item.status, tmdbIds: [...item.tmdbIds], otherScopeMatches: item.otherScopeMatches })
  }
  const candidates = [], candidateIds = new Set()
  for (const item of data.candidates) {
    if (!integer(item?.tmdbId) || item.mediaType !== data.mediaType || candidateIds.has(item.tmdbId) ||
        typeof item.available !== 'boolean' || !unique(item.lookupIndexes) ||
        (item.available ? typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500
          : item.title !== null || item.releaseDate !== null) ||
        (item.releaseDate !== null && (typeof item.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.releaseDate)))) return null
    const indexes = lookups.flatMap((lookup, index) => lookup.tmdbIds.includes(item.tmdbId) ? [index] : [])
    if (!indexes.length || indexes.length !== item.lookupIndexes.length || indexes.some((value, index) => value !== item.lookupIndexes[index])) return null
    candidateIds.add(item.tmdbId)
    candidates.push({ tmdbId: item.tmdbId, title: item.title, releaseDate: item.releaseDate,
      available: item.available, lookupIndexes: indexes })
  }
  if (lookups.some(item => item.tmdbIds.some(id => !candidateIds.has(id)))) return null
  return { reference: data.reference, asOf: data.asOf, candidates, lookups }
}

export function candidateFailureMessage(error) {
  const status = error?.response?.status, code = error?.response?.data?.code
  if (status === 401 || status === 403) return 'Sign in with an active administrator account to look up candidates.'
  if (status === 409) return 'The source changed. Refresh items and try again.'
  if (status === 429) return 'Too many candidate lookups. Wait before trying again.'
  if (status === 503 && code === 'candidate_busy') return 'Another source review is running. Wait for it to finish.'
  if (status === 503 && code === 'candidate_lookup_limit') return 'This source has too many candidates for a bounded lookup. Review its identifiers individually.'
  if (status === 503 && code === 'candidate_timed_out') return 'The candidate lookup timed out. Nothing was saved; try again later.'
  return 'Candidate lookup did not complete. Nothing was saved. Check provider availability and try again later.'
}
