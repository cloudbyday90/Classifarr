/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for classificationEvidenceRepository.
 * Uses a mocked DB — no live connection required.
 */

const { ClassificationEvidenceRepository } = require('../../services/classificationEvidenceRepository');

function makeMockDb(rows = []) {
  return {
    query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length })
  };
}

const BASE_EXACT = {
  scope: 'item_exact',
  tmdbId: 550,
  mediaType: 'movie',
  libraryId: 7,
  evidenceKey: null,
  evidenceData: { title: 'Fight Club' },
  confidence: 100,
  usageCount: 0,
  successRate: null,
  provenance: 'human_confirmed',
  status: 'active',
  createdBy: 'admin',
  sourceClassificationId: null,
  sourceSystem: 'learning_patterns'
};

const BASE_GENRE = {
  scope: 'genre',
  tmdbId: null,
  mediaType: 'movie',
  libraryId: 7,
  evidenceKey: 'genre:documentary',
  evidenceData: null,
  confidence: 85,
  usageCount: 0,
  successRate: null,
  provenance: 'policy_confirmed',
  status: 'active',
  createdBy: 'system',
  sourceClassificationId: null,
  sourceSystem: 'learning_patterns'
};

describe('ClassificationEvidenceRepository', () => {

  // ── upsertEvidence — item_exact ────────────────────────────────────────────

  describe('upsertEvidence — item_exact', () => {
    test('issues INSERT with ON CONFLICT DO NOTHING for item_exact + do_nothing', async () => {
      const db = makeMockDb([{ id: 1, ...BASE_EXACT }]);
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.upsertEvidence(BASE_EXACT, { conflictMode: 'do_nothing' });

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (scope, tmdb_id, media_type)');
      expect(sql).toContain("WHERE scope = 'item_exact' AND tmdb_id IS NOT NULL");
      expect(sql).toContain('DO NOTHING');
      expect(params[0]).toBe('item_exact');
      expect(params[1]).toBe(550);
      expect(params[2]).toBe('movie');
    });

    test('issues INSERT with DO UPDATE for item_exact + update_data', async () => {
      const db = makeMockDb([{ id: 1, ...BASE_EXACT }]);
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.upsertEvidence(BASE_EXACT, { conflictMode: 'update_data' });

      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('DO UPDATE SET');
      expect(sql).toContain('evidence_data = EXCLUDED.evidence_data');
    });

    test('returns the upserted row', async () => {
      const row = { id: 99, scope: 'item_exact', tmdb_id: 550, media_type: 'movie' };
      const db = makeMockDb([row]);
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.upsertEvidence(BASE_EXACT);
      expect(result).toEqual(row);
    });

    test('returns null when DO NOTHING fires and no row is returned', async () => {
      const db = makeMockDb([]);
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.upsertEvidence(BASE_EXACT, { conflictMode: 'do_nothing' });
      expect(result).toBeNull();
    });

    test('uses provided client instead of pool', async () => {
      const client = makeMockDb([{ id: 1 }]);
      const db = makeMockDb();
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.upsertEvidence(BASE_EXACT, { client });

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  // ── upsertEvidence — related scopes ───────────────────────────────────────

  describe('upsertEvidence — related scopes', () => {
    test('issues INSERT with ON CONFLICT (scope, media_type, library_id, evidence_key) for genre', async () => {
      const db = makeMockDb([{ id: 5, ...BASE_GENRE }]);
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.upsertEvidence(BASE_GENRE, { conflictMode: 'do_nothing' });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (scope, media_type, library_id, evidence_key)');
      expect(sql).toContain("WHERE scope IN ('genre', 'studio', 'franchise', 'certification')");
      expect(sql).toContain('usage_count   = classification_evidence.usage_count + 1');
      expect(params[0]).toBe('genre');
      expect(params[4]).toBe('genre:documentary');
    });

    test('includes evidence_data and confidence update for update_data mode', async () => {
      const db = makeMockDb([{ id: 5 }]);
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.upsertEvidence(BASE_GENRE, { conflictMode: 'update_data' });

      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('evidence_data = EXCLUDED.evidence_data');
      expect(sql).toContain('confidence    = LEAST(classification_evidence.confidence + 2, 95)');
    });

    test('handles all related scope types: studio, franchise, certification', async () => {
      const scopes = ['studio', 'franchise', 'certification'];
      for (const scope of scopes) {
        const db = makeMockDb([{ id: 1 }]);
        const repo = new ClassificationEvidenceRepository({ db });
        await repo.upsertEvidence({ ...BASE_GENRE, scope });
        const [sql] = db.query.mock.calls[0];
        expect(sql).toContain('ON CONFLICT (scope, media_type, library_id, evidence_key)');
      }
    });
  });

  // ── upsertEvidence — unknown scope ────────────────────────────────────────

  describe('upsertEvidence — unknown scope', () => {
    test('returns null and does not query DB for unknown scope', async () => {
      const db = makeMockDb();
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.upsertEvidence({ ...BASE_EXACT, scope: 'unknown_scope' });

      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  // ── findExactMatch ─────────────────────────────────────────────────────────

  describe('findExactMatch', () => {
    test('queries item_exact by tmdb_id + media_type', async () => {
      const row = { id: 1, scope: 'item_exact', tmdb_id: 550, library_id: 7 };
      const db = makeMockDb([row]);
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.findExactMatch({ tmdbId: 550, mediaType: 'movie' });

      expect(result).toEqual(row);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("scope      = 'item_exact'");
      expect(params).toEqual([550, 'movie']);
    });

    test('returns null when no row exists', async () => {
      const db = makeMockDb([]);
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.findExactMatch({ tmdbId: 999, mediaType: 'movie' });
      expect(result).toBeNull();
    });

    test('returns null immediately when tmdbId is null', async () => {
      const db = makeMockDb();
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.findExactMatch({ tmdbId: null, mediaType: 'movie' });
      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  // ── findRelatedEvidence ────────────────────────────────────────────────────

  describe('findRelatedEvidence', () => {
    test('returns all active non-item_exact rows with no filters', async () => {
      const rows = [{ id: 1, scope: 'genre' }, { id: 2, scope: 'studio' }];
      const db = makeMockDb(rows);
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.findRelatedEvidence({});
      expect(result).toHaveLength(2);
    });

    test('adds library_id filter when libraryIds is provided', async () => {
      const db = makeMockDb([]);
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.findRelatedEvidence({ libraryIds: [1, 2, 3] });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('library_id = ANY(');
      expect(params).toContainEqual([1, 2, 3]);
    });

    test('adds scope filter when scope is provided', async () => {
      const db = makeMockDb([]);
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.findRelatedEvidence({ scope: 'genre' });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('scope =');
      expect(params).toContain('genre');
    });

    test('adds confidence filter when minConfidence > 0', async () => {
      const db = makeMockDb([]);
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.findRelatedEvidence({ minConfidence: 75 });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('confidence >=');
      expect(params).toContain(75);
    });
  });

  // ── listAll ────────────────────────────────────────────────────────────────

  describe('listAll', () => {
    test('queries all rows ordered by id', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const db = makeMockDb(rows);
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.listAll();
      expect(result).toHaveLength(2);
      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('ORDER BY id ASC');
    });
  });

  // ── purgeByTmdbId ──────────────────────────────────────────────────────────

  describe('purgeByTmdbId', () => {
    test('deletes by tmdb_id', async () => {
      const db = { query: jest.fn().mockResolvedValue({ rowCount: 2 }) };
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.purgeByTmdbId({ tmdbId: 550, mediaType: 'movie' });

      expect(result.deleted).toBe(2);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM classification_evidence');
      expect(params).toContain(550);
      expect(params).toContain('movie');
    });

    test('adds scope filter when scopes array is provided', async () => {
      const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
      const repo = new ClassificationEvidenceRepository({ db });

      await repo.purgeByTmdbId({ tmdbId: 550, scopes: ['item_exact'] });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('scope = ANY(');
      expect(params).toContainEqual(['item_exact']);
    });

    test('returns {deleted: 0} when tmdbId is null', async () => {
      const db = makeMockDb();
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.purgeByTmdbId({ tmdbId: null });
      expect(result.deleted).toBe(0);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  // ── purgeAll ───────────────────────────────────────────────────────────────

  describe('purgeAll', () => {
    test('deletes all rows and returns count', async () => {
      const db = { query: jest.fn().mockResolvedValue({ rowCount: 42 }) };
      const repo = new ClassificationEvidenceRepository({ db });

      const result = await repo.purgeAll();

      expect(result.deleted).toBe(42);
      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM classification_evidence');
    });
  });
});
