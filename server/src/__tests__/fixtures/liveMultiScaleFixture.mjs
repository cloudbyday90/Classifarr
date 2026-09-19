/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { fixture, representation } from './inventoryMultiScaleFixture.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
export function liveFixture() {
  const snapshot = fixture();
  const state = { rag_enabled: true, busy: false, primary_provider: 'ollama', embedding_provider_mode: 'same',
    embedding_model: representation.model, ollama_host: 'localhost' };
  snapshot.state = state;
  snapshot.observedKeys = new Set(snapshot.corpus.documents.map(row => row.key));
  const identity = { provider: 'ollama', ...representation };
  const request = { key: 'movie:9999', mediaType: 'movie', libraryIds: [1, 2],
    hash: createHash('sha256').update('Unseen synopsis').digest('hex'),
    contextConfigKey: JSON.stringify(resolveLocalStudyEmbeddingConfig(state)) };
  const rows = snapshot.corpus.documents.map(doc => ({ tmdb_id: Number(doc.key.split(':')[1]), media_type: doc.type }));
  return { snapshot, state, identity, input: { request, identity, rows, corpus: snapshot.corpus, vector: [1, 0, 0, 0] } };
}
