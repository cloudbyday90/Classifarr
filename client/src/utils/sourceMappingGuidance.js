/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const sourceMappingGuidance = Object.freeze({
  source_changed: 'The source identity or episode layout changed. Refresh metadata issues, then review every season against the current source before replacing the saved mapping.',
  configuration_changed: 'The media-server or TMDb configuration changed. Verify those settings, then review a fresh mapping. Existing approval is not transferred to a different configuration.',
  source_seasons_changed: 'The source season list changed. Include every current source season, including specials when present, then check the complete draft again.',
  catalog_changed: 'TMDb changed during verification. Wait for the catalog to settle, then check the same draft again before changing its IDs.',
  catalog_season_missing: 'A proposed season was not listed under that TMDb series. Check the series ID and season number together; a TVDB ID is not a TMDb series ID.',
  catalog_invalid: 'TMDb returned incomplete or inconsistent season data. Retry later. Do not remove episodes from the mapping to bypass this check.',
  scope_limit: 'This scope exceeds the bounded verification limit. Keep the source grouping intact and report the mapping reference on GitHub; do not raise safety limits to force approval.',
  invalid_scope: 'The mapping structure is invalid. Check the typed IDs and season rows, then check the draft structure again.',
  empty_source: 'No source episodes could be verified. Check the source item and its season contents; an empty comparison cannot approve recovery.',
  unmapped_season: 'Add an explicit mapping for every source season. A partial mapping stays unresolved, even when its other seasons match.',
  ambiguous_episode_ids: 'Inspect the listed episode in the media server: it declares conflicting IDs. Verify its match and refresh its metadata if appropriate, then check again. Do not select an ID arbitrarily.',
  reused_episode_id: 'The same provider episode ID appears more than once. Review duplicate or combined episodes in the source. Preserve the grouping and report unsupported layouts instead of deleting an ID.',
  missing_tmdb_episode_id: 'The source supplied no TMDb ID for the listed episode. Check its match and episode-level metadata in the media server, then check again. A series poster or synopsis does not supply this episode ID.',
  episode_absent_from_scope: 'The episode ID is not in the proposed catalog scope. Review the series and season assignments against the source episode; do not infer membership from its title.',
  episode_outside_mapping: 'The episode belongs to another series or season within the proposed scope. Correct the explicit season assignment, keeping the source grouped.',
  episode_numbering_differs: 'The episode ID matches but its numbering differs. Check the source episode-order setting against the TMDb season. If the intended order differs, report the unsupported layout rather than renumbering blindly.',
  parent_identity_unresolved: 'The source does not declare this single TMDb movie ID. Review its movie match and conflicting declarations before proposing a different ID.',
  source_unavailable: 'The source layout could not be read. Check media-server connectivity and access in Settings. Keep the mapping while the existing retry cooldown runs.',
  catalog_unavailable: 'The catalog check could not finish. Check TMDb configuration and availability. Keep the mapping while the existing retry cooldown runs.',
  timed_out: 'Verification reached its deadline. Check provider responsiveness and retry after the cooldown; do not disable the timeout or memory safeguards.',
  check_unconfirmed: 'A verification started but has no confirmed completion. It may still be running or have been interrupted. Refresh saved mappings after the sync; the saved cooldown is retained.',
  unknown: 'No specific failure reason was recorded. If it persists, open a GitHub issue with the mapping reference, retry time and redacted diagnostics. Do not reset imports or guess an ID.',
})

const evidenceCodes = Object.freeze({
  scope_catalog_season_missing: 'catalog_season_missing', scope_catalog_invalid: 'catalog_invalid',
  scope_catalog_scope_limit: 'scope_limit', scope_scope_limit: 'scope_limit', scope_invalid_scope: 'invalid_scope',
  scope_source_unavailable: 'source_unavailable', scope_evidence_timed_out: 'timed_out',
  scope_evidence_busy: 'Another evidence check is active. Wait for it to finish, then check this draft again.',
})
export function sourceScopeFailureMessage(failure) {
  const status = failure?.response?.status
  if (status === 409) return 'The source or catalog changed. Refresh items and review the draft again.'
  if ([401, 403].includes(status)) return 'An active administrator session is required.'
  if (status === 429) return 'Too many checks. Wait before trying again.'
  const code = failure?.response?.data?.code
  if (status === 503 && Object.hasOwn(evidenceCodes, code ?? '')) {
    const guidance = evidenceCodes[code]
    return `${sourceMappingGuidance[guidance] ?? guidance} Nothing was saved.`
  }
  return 'Evidence could not be checked within the safety limits. Nothing was saved. If this persists, open a GitHub issue with the draft reference and redacted diagnostics.'
}

/** Optional for old servers; new responses must describe exactly the proposed typed works. */
export function parseScopeCatalogWorks(works, draft, unit) {
  if (works === undefined) return []
  if (!Array.isArray(works) || !works.length || works.length > 4) return null
  const expected = new Set(draft.scope.kind === 'whole_work' ? [draft.scope.tmdbId] : draft.scope.mappings.map(edge => edge.tmdbSeriesId))
  const result = []
  for (const work of works) {
    if (!expected.delete(work?.tmdbId) || work.mediaType !== (unit === 'movie' ? 'movie' : 'tv') ||
        typeof work.title !== 'string' || !work.title.trim() || work.title.length > 500 ||
        (work.releaseDate !== null && (typeof work.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(work.releaseDate)))) return null
    result.push({ tmdbId: work.tmdbId, mediaType: work.mediaType, title: work.title, releaseDate: work.releaseDate })
  }
  return expected.size ? null : result
}
