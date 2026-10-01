/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { buildSemanticVectorSearchQuery, executeSemanticVectorSearch, mapSearchResults } from '../services/ragRetrieverQuery.mjs';
import { createHeldOutSemanticStudyScope } from '../services/heldOutSemanticStudyScope.mjs';

const options = { vectorString: '[1,0,0]', imageVectorString: '[0,1,0]',
  textWeight: 0.7, imageWeight: 0.3, candidateLimit: 50, limit: 5 };

test('one parameterized definition retains text-first candidates, images and status', () => {
  const query = buildSemanticVectorSearchQuery(options);
  expect(query.values).toEqual(['[1,0,0]', '[0,1,0]', 0.7, 0.3, 50, 5]);
  expect(query.text).toContain('ORDER BY ce.embedding <=> $1::vector');
  expect(query.text).toContain('LIMIT $5'); expect(query.text).toContain('LIMIT $6');
  expect(query.text).toContain('c.status,'); expect(query.text).toContain('c.image_embedding <=> $2::vector');
  expect(query.text).not.toContain('[1,0,0]');
});

test('production executor uses the same definition after local recall settings', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [] });
  const db = { withTransaction: work => work({ query }) };
  await executeSemanticVectorSearch(db, options);
  const expected = buildSemanticVectorSearchQuery(options);
  expect(query).toHaveBeenLastCalledWith(expected.text, expected.values);
  expect(query.mock.calls[0][0]).toContain("set_config('hnsw.ef_search'");
});

test('signal reaches an explicitly read-only database transaction without changing query parameters', async () => {
  const signal = new AbortController().signal, query = jest.fn().mockResolvedValue({ rows: [] });
  const db = { withTransaction: jest.fn(work => work({ query })) };
  await executeSemanticVectorSearch(db, { ...options, signal });
  expect(db.withTransaction).toHaveBeenCalledWith(expect.any(Function), { signal, readOnly: true });
  expect(query).toHaveBeenLastCalledWith(buildSemanticVectorSearchQuery(options).text, buildSemanticVectorSearchQuery(options).values);
});

test('held-out exclusions stay parameterized and forged scopes are rejected', () => {
  const heldOutScope = createHeldOutSemanticStudyScope(Array.from({ length: 24 }, (_, i) => ({ media_type: 'movie', tmdb_id: i + 1 })));
  const query = buildSemanticVectorSearchQuery({ ...options, heldOutScope });
  expect(query.values[6]).toHaveLength(24); expect(query.values[7]).toContain(24);
  expect(query.text).toContain('unnest($7::text[], $8::integer[])');
  expect(query.text).toContain(', c.id ASC');
  expect(() => buildSemanticVectorSearchQuery({ ...options, heldOutScope: {} })).toThrow();
});

test('mapping retains real status and does not replace absent image evidence with zero', () => {
  const result = mapSearchResults([{ status: 'completed', text_similarity: 0.9,
    image_similarity: null, combined_similarity: 0.9 }], { ...options, applyThreshold: false });
  expect(result.matches[0]).toMatchObject({ status: 'completed', imageSimilarity: null, similarity: 0.9 });
});
