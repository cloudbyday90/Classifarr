/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for verify_classification_evidence_backfill check functions.
 * Uses mocked database clients — no live DB connection required.
 */

const {
  countBySource,
  countLearningPatternsSource,
  countDiscoveredPatternsSource,
  findMalformedKeys,
  findExactMatchWithoutTmdbId
} = require('../../scripts/verify_classification_evidence_backfill');

function makeClient(responses) {
  let callIndex = 0;
  return {
    query: jest.fn(() => {
      const response = responses[callIndex++];
      return Promise.resolve(response);
    })
  };
}

describe('verify_classification_evidence_backfill', () => {

  // ── countBySource ──────────────────────────────────────────────────────────

  describe('countBySource', () => {
    test('aggregates counts by source_system', async () => {
      const client = makeClient([{
        rows: [
          { source_system: 'learning_patterns', cnt: 42 },
          { source_system: 'discovered_patterns', cnt: 18 }
        ]
      }]);

      const result = await countBySource(client);

      expect(result.learning_patterns).toBe(42);
      expect(result.discovered_patterns).toBe(18);
      expect(result.total).toBe(60);
    });

    test('returns zero counts for missing source_systems', async () => {
      const client = makeClient([{ rows: [] }]);

      const result = await countBySource(client);

      expect(result.learning_patterns).toBe(0);
      expect(result.discovered_patterns).toBe(0);
      expect(result.total).toBe(0);
    });

    test('handles only learning_patterns being present', async () => {
      const client = makeClient([{
        rows: [{ source_system: 'learning_patterns', cnt: 10 }]
      }]);

      const result = await countBySource(client);

      expect(result.learning_patterns).toBe(10);
      expect(result.discovered_patterns).toBe(0);
      expect(result.total).toBe(10);
    });
  });

  // ── countLearningPatternsSource ────────────────────────────────────────────

  describe('countLearningPatternsSource', () => {
    test('returns count from learning_patterns query', async () => {
      const client = makeClient([{ rows: [{ cnt: 33 }] }]);

      const result = await countLearningPatternsSource(client);

      expect(result).toBe(33);
    });

    test('returns 0 when table is empty', async () => {
      const client = makeClient([{ rows: [{ cnt: 0 }] }]);

      const result = await countLearningPatternsSource(client);

      expect(result).toBe(0);
    });
  });

  // ── countDiscoveredPatternsSource ──────────────────────────────────────────

  describe('countDiscoveredPatternsSource', () => {
    test('returns count when discovered_patterns table exists', async () => {
      const client = makeClient([
        { rows: [{ exists: true }] },
        { rows: [{ cnt: 22 }] }
      ]);

      const result = await countDiscoveredPatternsSource(client);

      expect(result).toBe(22);
    });

    test('returns 0 when discovered_patterns table does not exist', async () => {
      const client = makeClient([
        { rows: [{ exists: false }] }
      ]);

      const result = await countDiscoveredPatternsSource(client);

      expect(result).toBe(0);
    });
  });

  // ── findMalformedKeys ──────────────────────────────────────────────────────

  describe('findMalformedKeys', () => {
    test('returns empty array when all keys are valid', async () => {
      const client = makeClient([{ rows: [] }]);

      const result = await findMalformedKeys(client);

      expect(result).toEqual([]);
    });

    test('returns malformed key rows', async () => {
      const client = makeClient([{
        rows: [
          { id: 5, scope: 'genre', evidence_key: 'GENRE:Documentary' },
          { id: 9, scope: 'studio', evidence_key: 'studio:' }
        ]
      }]);

      const result = await findMalformedKeys(client);

      expect(result).toHaveLength(2);
      expect(result[0].evidence_key).toBe('GENRE:Documentary');
    });
  });

  // ── findExactMatchWithoutTmdbId ────────────────────────────────────────────

  describe('findExactMatchWithoutTmdbId', () => {
    test('returns empty array when all item_exact rows have tmdb_id', async () => {
      const client = makeClient([{ rows: [] }]);

      const result = await findExactMatchWithoutTmdbId(client);

      expect(result).toEqual([]);
    });

    test('returns rows where tmdb_id is null', async () => {
      const client = makeClient([{
        rows: [{ id: 3, scope: 'item_exact', library_id: 7, evidence_key: null }]
      }]);

      const result = await findExactMatchWithoutTmdbId(client);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });
  });
});
