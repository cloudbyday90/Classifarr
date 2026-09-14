/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';

export function representativeProfileFixture({ perLibrary = 6 } = {}) {
  const state = { rag_enabled: true, embedding_provider_mode: 'same', primary_provider: 'ollama',
    embedding_model: 'test', ollama_host: 'localhost', ollama_port: 11434, busy: false };
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
  const libraries = [{ id: 1, name: 'PRIVATE movie library', media_type: 'movie' },
    { id: 2, name: 'PRIVATE TV library', media_type: 'tv' }];
  const rows = Array.from({ length: perLibrary * 2 }, (_, i) => ({ media_type: i < perLibrary ? 'movie' : 'tv', tmdb_id: i + 1,
    library_id: i < perLibrary ? 1 : 2, overview: `PRIVATE description ${i}` }));
  const corpus = prepareInventoryDescriptionCorpus(rows);
  const vectors = new Map([...corpus.texts.keys()].map((key, i) => [key, i < perLibrary ? [1, 0.01 * i] : [0.01 * i, 1]]));
  const observedKeys = new Set(corpus.documents.map(row => row.key));
  return { state, identity, rows, snapshot: { state, corpus, libraries, vectors, observedKeys } };
}
