/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceMappingGuidance } from './sourceMappingGuidance'
export const sourceMappingStatusLabels = Object.freeze({
  awaiting_sync: 'Awaiting successful verification by a library sync. This is not a completed repair.',
  verification_deferred: 'This verification has not completed. The item remains unresolved. See the recorded reason below.',
  materialized: 'The complete mapping was verified and applied. Optional description vectors may still be backfilling.',
  revoked: 'Mapping revoked. It no longer authorizes recovery.',
})
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647
export function parseSourceMappings(data) {
  if (data?.version !== 'source_mappings.v1' || !integer(data.offset) || typeof data.hasMore !== 'boolean' ||
      !Array.isArray(data.items) || data.items.length > 50) return null
  const items = []
  for (const item of data.items) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(item?.id) || !Object.hasOwn(sourceMappingStatusLabels, item.status) ||
        typeof item.title !== 'string' || item.title.length > 500 || typeof item.libraryName !== 'string' || item.libraryName.length > 500 ||
        (item.retryAfter != null && !Number.isFinite(Date.parse(item.retryAfter)))) return null
    const scope = item.scope
    if (scope?.kind === 'whole_work') {
      if (!integer(scope.tmdbId) || !scope.tmdbId) return null
    } else if (scope?.kind !== 'seasons' || scope.coverage !== 'complete' || !Array.isArray(scope.mappings) ||
        !scope.mappings.length || scope.mappings.length > 32 || scope.mappings.some(edge =>
          !integer(edge?.sourceSeason) || !integer(edge.tmdbSeriesId) || !edge.tmdbSeriesId || !integer(edge.tmdbSeason))) return null
    items.push({ id: item.id, title: item.title, libraryName: item.libraryName, status: item.status, retryAfter: item.retryAfter,
      guidance: item.status === 'verification_deferred'
        ? sourceMappingGuidance[Object.hasOwn(sourceMappingGuidance, item.diagnostic?.code ?? '') ? item.diagnostic.code : 'unknown'] : null,
      scope: scope.kind === 'whole_work' ? { kind: scope.kind, tmdbId: scope.tmdbId }
        : { kind: scope.kind, mappings: scope.mappings.map(({ sourceSeason, tmdbSeriesId, tmdbSeason }) => ({ sourceSeason, tmdbSeriesId, tmdbSeason })) } })
  }
  return { offset: data.offset, hasMore: data.hasMore, items }
}
