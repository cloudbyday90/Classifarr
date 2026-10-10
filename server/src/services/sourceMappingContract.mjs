/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ConflictError } from '../utils/appError.mjs';
import { copySourceCatalogScope } from './sourceCatalogScopePlan.mjs';

export function sourceMappingConfiguration(target) {
  return createHash('sha256').update(JSON.stringify([target.media_server_id, target.server_type,
    target.url, target.api_key, target.library_external_id, target.media_type,
    target.catalog_config?.id, target.catalog_config?.active, target.catalog_config?.key])).digest('hex');
}

export function approvedScopeDocuments(scope, mediaType, catalog) {
  const copied = copySourceCatalogScope(mediaType, scope);
  if (!copied || (copied.kind === 'seasons' && copied.coverage !== 'complete')) {
    throw new ConflictError('Map every source season before approving recovery.', { code: 'scope_incomplete' });
  }
  if (copied.kind === 'whole_work') {
    const work = catalog.details.find(value => value.tmdbId === copied.tmdbId && value.mediaType === mediaType);
    if (!work) throw new ConflictError('Catalog details changed.', { code: 'scope_evidence_changed' });
    return [{ catalogScope: { kind: 'whole_work', tmdbId: copied.tmdbId }, overview: work.overview }];
  }
  return copied.mappings.map(edge => {
    const season = catalog.seasons.find(value => value.tmdbSeriesId === edge.tmdbSeriesId && value.seasonNumber === edge.tmdbSeason);
    if (!season) throw new ConflictError('Catalog season changed.', { code: 'scope_evidence_changed' });
    return { sourceSeason: edge.sourceSeason, catalogScope: { kind: 'season', tmdbSeriesId: edge.tmdbSeriesId,
      seasonNumber: edge.tmdbSeason }, overview: season.overview };
  });
}
