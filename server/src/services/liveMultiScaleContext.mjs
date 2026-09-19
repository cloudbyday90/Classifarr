/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { representativeNoveltyKey } from './inventoryRepresentativeShadowScorer.mjs';

/** No names, text or vectors in this request-time membership fingerprint. */
export function multiScaleCorpusKey(corpus, type) {
  return createHash('sha256').update(JSON.stringify(corpus.documents.filter(row => row.type === type)
    .map(row => [row.key, row.hash, [...row.libraryIds].sort((a, b) => a - b)])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');
}

export const multiScaleIdentityKey = identity => JSON.stringify(validateDescriptionRepresentation(identity));

/** Private admission data; no plaintext retained alongside the fitted handle. */
export function bindLiveMultiScaleContext(snapshot, identity, profile) {
  representativeNoveltyKey(snapshot);
  return { profile, identityKey: multiScaleIdentityKey(identity), knownKeys: new Set(snapshot.observedKeys),
    corpusKeys: new Map(['movie', 'tv'].map(type => [type, multiScaleCorpusKey(snapshot.corpus, type)])),
    libraries: new Map(snapshot.libraries.map(row => [row.id, row.media_type])) };
}

/** Extra examples are data only. The fresh corpus, not cached text, hydrates them. */
export async function retrieveLiveMultiScaleContext(entry, { request, identity, vector, rows, corpus, signal }) {
  if (!entry || multiScaleIdentityKey(identity) !== entry.identityKey ||
      entry.knownKeys.has(request.key) || corpus.texts.has(request.hash) ||
      rows.some(row => `${row.media_type}:${row.tmdb_id}` === request.key) ||
      !Array.isArray(request.libraryIds) || request.libraryIds.length < 2 || request.libraryIds.length > 3 ||
      new Set(request.libraryIds).size !== request.libraryIds.length ||
      request.libraryIds.some(id => entry.libraries.get(id) !== request.mediaType) ||
      multiScaleCorpusKey(corpus, request.mediaType) !== entry.corpusKeys.get(request.mediaType)) return null;
  const context = await entry.profile.retrieve({ type: request.mediaType, hash: request.hash, vector }, signal);
  if (context?.purpose !== 'retrieval_context_only' || !Array.isArray(context.candidates)) return null;
  const membership = new Map();
  for (const doc of corpus.documents) {
    if (doc.type !== request.mediaType) continue;
    if (!membership.has(doc.hash)) membership.set(doc.hash, new Set());
    doc.libraryIds.forEach(id => membership.get(doc.hash).add(id));
  }
  const result = new Map();
  for (const id of request.libraryIds) {
    const matches = context.candidates.filter(row => row.id === id);
    if (matches.length !== 1 || !Array.isArray(matches[0].evidence) || matches[0].evidence.length > 9) return null;
    const seen = new Set(), examples = [];
    for (const item of matches[0].evidence) {
      if (!Array.isArray(item.origins) || !item.origins.some(origin => ['broad', 'local'].includes(origin))) continue;
      const scope = membership.get(item.hash), description = corpus.texts.get(item.hash);
      if (seen.has(item.hash) || item.hash === request.hash || scope?.size !== 1 || !scope.has(id) ||
          typeof description !== 'string' || !description.length || !Number.isFinite(item.similarity) ||
          item.similarity < -1 || item.similarity > 1) return null;
      seen.add(item.hash);
      examples.push({ description, similarity: item.similarity, sharedAcrossCandidates: false });
    }
    result.set(id, examples);
  }
  signal?.throwIfAborted();
  return result;
}
