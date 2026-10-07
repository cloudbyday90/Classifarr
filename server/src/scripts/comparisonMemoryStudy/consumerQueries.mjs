/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { projectInventoryDescription } from '../../services/inventoryDescriptionProjection.mjs';

/** Fixture decisions only. No database writes, routing calls or provider traffic. */
export function enqueueComparisonStudyQueries(observer, { snapshot, identity, configKey }, batch) {
  for (const [index, mediaType] of ['movie', 'tv'].entries()) {
    const candidates = snapshot.libraries.filter(row => row.media_type === mediaType)
      .map(row => ({ libraryId: row.id, mediaType }));
    if (candidates.length < 2) continue;
    const id = 900000 + batch * 2 + index;
    const metadata = { media_type: mediaType, tmdb_id: id, overview: `Synthetic unseen comparison ${id}` };
    const hash = createHash('sha256').update(projectInventoryDescription({ metadata }).text).digest('hex');
    observer.remember(metadata, { request: { key: `${mediaType}:${id}`, mediaType, hash }, identity, configKey,
      vector: Array.from({ length: identity.dimensions }, (_, d) => Math.sin(d + 1 + index)) });
    observer.observe({ metadata, contract: { valid: true, candidates }, result: { library: { id: candidates[0].libraryId } } });
  }
}
