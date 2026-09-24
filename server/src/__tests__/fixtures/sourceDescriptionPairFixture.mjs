/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { inventorySourceDescriptionKey } from '../../services/inventorySourceDescriptionIdentity.mjs';
import { collectInventoryCandidateMetadata } from '../../services/inventoryMetadataCandidates.mjs';

export const sourcePairIdentity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
export function sourcePairFixture(count = 48) {
  const libraries = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, name: `PRIVATE library ${index}`,
    media_type: index < 2 ? 'movie' : 'tv' }));
  const rows = Array.from({ length: count }, (_, index) => ({ library_id: index % 4 + 1,
    media_type: libraries[index % 4].media_type, tmdb_id: index % 8 < 4 ? index + 1 : null,
    media_server_id: 1, external_id: `PRIVATE-source-${index}`, overview: `PRIVATE synopsis ${index}`,
    genres: [`PRIVATE genre ${index % 4}`], studio: 'PRIVATE studio', content_rating: 'PG' }));
  return sourcePairSnapshot(rows, libraries);
}
export function sourcePairSnapshot(rows, libraries) {
  const corpus = prepareInventoryDescriptionCorpus(rows, { includeSourceItems: true });
  return { rows, libraries, corpus, candidateMetadata: collectInventoryCandidateMetadata(rows, inventorySourceDescriptionKey),
    vectors: new Map(corpus.documents.map((doc, index) => [doc.hash, [1, index % 7 / 7]])), operatorFeedbackRows: [],
    config: { rag_enabled: true, primary_provider: 'ollama', embedding_provider_mode: 'same',
      embedding_model: 'test', ollama_host: 'localhost', ollama_port: 11434 } };
}
