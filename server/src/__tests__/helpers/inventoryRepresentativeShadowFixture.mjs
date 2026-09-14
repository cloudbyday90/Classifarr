/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { representativeProfileFixture } from './inventoryRepresentativeProfileFixture.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';

export async function representativeShadowFixture(mediaType = 'movie', options = {}) {
  const { snapshot, identity } = representativeProfileFixture(options);
  snapshot.libraries.forEach(row => { row.media_type = mediaType; });
  snapshot.corpus.documents.forEach(row => { row.type = mediaType; row.key = `${mediaType}:${row.id}`; });
  snapshot.observedKeys = new Set(snapshot.corpus.documents.map(row => row.key));
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  const metadata = { media_type: mediaType, tmdb_id: 90000, title: 'PRIVATE title', overview: 'PRIVATE unseen voyage' };
  const hash = createHash('sha256').update(metadata.overview).digest('hex');
  const query = { request: { key: `${mediaType}:90000`, mediaType, hash }, identity, vector: [1, 0], configKey: 'PRIVATE config' };
  const decision = { metadata, contract: { valid: true, candidates: [1, 2].map(libraryId => ({ libraryId, mediaType })) },
    result: { library: { id: 1 }, confidence: 45, needs_clarification: true } };
  return { snapshot, identity, model, metadata, query, decision, configKey: query.configKey };
}
