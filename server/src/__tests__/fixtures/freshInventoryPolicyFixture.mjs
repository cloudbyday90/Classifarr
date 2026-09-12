/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { collectInventoryCandidateMetadata } from '../../services/inventoryMetadataCandidates.mjs';
import { fingerprintFreshPolicySnapshot } from '../../services/freshInventoryPolicyRuntime.mjs';

export const freshSettings = { seed: 'fresh-policy-test-seed-2026', size: 12, generateCases: 12, folds: 3 };
export function freshFixture() {
  const libraries = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Private library ${index}`, is_active: true, media_type: index < 3 ? 'movie' : 'tv' }));
  const evaluationRows = Array.from({ length: 120 }, (_, index) => ({ tmdb_id: index + 1, library_id: index % 6 + 1,
    media_type: libraries[index % 6].media_type, overview: `Private synopsis number ${index}.`,
    title: `Private title ${index}`, year: 2020, genres: [`Genre ${index % 6}`], studio: 'Private studio', content_rating: 'PG',
    evaluation_metadata: { inventory_tmdb: { version: 1, tmdb_id: index + 1, media_type: libraries[index % 6].media_type,
      keywords: ['voyage'], original_language: 'en' } } }));
  const corpus = prepareInventoryDescriptionCorpus(evaluationRows);
  const vectors = new Map(corpus.documents.map((doc, index) => [doc.hash, [1, (index % 17) / 17]]));
  const policies = libraries.map(library => ({ id: library.id, library_id: library.id, enabled: true,
    library_name: library.name, library_media_type: library.media_type, auto_classify_threshold: 85,
    prompt_threshold: 60, trust_rag: true, trust_patterns: true, trust_history: true, presets: [],
    profile_weight: 1, rag_weight: 1, pattern_weight: 1, history_weight: 1 }));
  const config = { primary_provider: 'ollama', rag_enabled: true, ollama_host: 'localhost', ollama_model: 'test:latest', embedding_model: 'embedding:latest' };
  const source = { corpus, libraries, vectors, policies, config, evaluationRows, candidateMetadata: collectInventoryCandidateMetadata(evaluationRows) };
  source.fingerprint = fingerprintFreshPolicySnapshot(source);
  const identity = { model: 'test:latest', digest: 'a'.repeat(64), contextLength: 32768 };
  const client = { inspect: jest.fn(async () => identity), generate: jest.fn(async ({ onGenerationCall }) => {
    onGenerationCall(); return { response: '{"decision":"PROPOSE","library_number":1}', latencyMs: 3, promptTokens: 100, outputTokens: 14 };
  }) };
  const embedder = { provider: 'ollama', model: 'embedding:latest', inspect: jest.fn(async () => ({
    provider: 'ollama', model: 'embedding:latest', digest: 'b'.repeat(64), dimensions: 2 })) };
  const runtime = { config, embedder, repository: { read: jest.fn(async () => source) }, createClient: jest.fn(() => client), close: jest.fn() };
  return { source, runtime, client, identity };
}
