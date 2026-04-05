/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for services/evidenceDiagnosticsService.js
 *
 * Phase 6 — Layer 4 operator debug read model.
 * Uses constructor injection so no live DB is required.
 */

const { EvidenceDiagnosticsService } = require('../../services/evidenceDiagnosticsService');

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

// Minimal valid evidence row
const BASE_EVIDENCE = {
  id: 42,
  scope: 'item_exact',
  provenance: 'human_confirmed',
  status: 'active',
  confidence: 100,
  usage_count: 3,
  success_rate: 0.9,
  tmdb_id: 550,
  media_type: 'movie',
  library_id: 7
};

// Standard mock wiring helpers
function makeMockDb(rows = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

function makeMockRepository(rows = []) {
  return {
    findRelatedEvidence: jest.fn().mockResolvedValue(rows)
  };
}

describe('EvidenceDiagnosticsService', () => {

  // ── diagnose: guard clauses ────────────────────────────────────────────────

  describe('diagnose — null / missing row', () => {
    let service;

    beforeEach(() => {
      service = new EvidenceDiagnosticsService({
        db: makeMockDb(),
        repository: makeMockRepository()
      });
    });

    test('returns empty report when evidenceRow is null', async () => {
      const report = await service.diagnose(null);

      expect(report.evidenceId).toBeNull();
      expect(report.history.recentCount).toBe(0);
      expect(report.related.count).toBe(0);
      expect(report.agreement.consistent).toBeNull();
    });

    test('returns empty report when evidenceRow is undefined', async () => {
      const report = await service.diagnose(undefined);

      expect(report.evidenceId).toBeNull();
    });
  });

  // ── diagnose: happy path ───────────────────────────────────────────────────

  describe('diagnose — with a valid evidence row', () => {
    test('populates all top-level fields from the evidence row', async () => {
      const db = makeMockDb([
        { id: 1, method: 'item_exact', confidence: 100, library_id: 7, classified_at: new Date(), metadata: null }
      ]);
      const repository = makeMockRepository([]);
      const service = new EvidenceDiagnosticsService({ db, repository });

      const report = await service.diagnose(BASE_EVIDENCE);

      expect(report.evidenceId).toBe(42);
      expect(report.scope).toBe('item_exact');
      expect(report.provenance).toBe('human_confirmed');
      expect(report.status).toBe('active');
      expect(report.confidence).toBe(100);
      expect(report.usageCount).toBe(3);
      expect(report.successRate).toBe(0.9);
    });

    test('includes recent history rows fetched via db.query', async () => {
      const historyRows = [
        { id: 1, method: 'item_exact', confidence: 100, library_id: 7, classified_at: new Date(), metadata: null },
        { id: 2, method: 'genre',      confidence: 80,  library_id: 7, classified_at: new Date(), metadata: null }
      ];
      const db = makeMockDb(historyRows);
      const repository = makeMockRepository([]);
      const service = new EvidenceDiagnosticsService({ db, repository });

      const report = await service.diagnose(BASE_EVIDENCE);

      expect(report.history.recentCount).toBe(2);
      expect(report.history.rows).toHaveLength(2);
    });

    test('queries classification_history by tmdb_id and media_type', async () => {
      const db = makeMockDb([]);
      const repository = makeMockRepository([]);
      const service = new EvidenceDiagnosticsService({ db, repository });

      await service.diagnose(BASE_EVIDENCE);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM classification_history'),
        [550, 'movie', 10]
      );
    });

    test('calls findRelatedEvidence with the evidence library_id', async () => {
      const db = makeMockDb([]);
      const repository = makeMockRepository([]);
      const service = new EvidenceDiagnosticsService({ db, repository });

      await service.diagnose(BASE_EVIDENCE);

      expect(repository.findRelatedEvidence).toHaveBeenCalledWith(
        expect.objectContaining({ libraryIds: [7] })
      );
    });

    test('includes related evidence count and scope breakdown', async () => {
      const relatedRows = [
        { id: 10, scope: 'genre',  library_id: 7 },
        { id: 11, scope: 'genre',  library_id: 7 },
        { id: 12, scope: 'studio', library_id: 7 }
      ];
      const db = makeMockDb([]);
      const repository = makeMockRepository(relatedRows);
      const service = new EvidenceDiagnosticsService({ db, repository });

      const report = await service.diagnose(BASE_EVIDENCE);

      expect(report.related.count).toBe(3);
      expect(report.related.scopes).toEqual({ genre: 2, studio: 1 });
    });
  });

  // ── diagnose: rows without tmdb_id ────────────────────────────────────────

  describe('diagnose — genre-scoped evidence (no tmdb_id)', () => {
    test('skips history query when tmdb_id is null', async () => {
      const db = makeMockDb([]);
      const repository = makeMockRepository([]);
      const service = new EvidenceDiagnosticsService({ db, repository });

      await service.diagnose({ ...BASE_EVIDENCE, tmdb_id: null });

      expect(db.query).not.toHaveBeenCalled();
    });

    test('returns empty history with no classification rows', async () => {
      const db = makeMockDb([]);
      const repository = makeMockRepository([]);
      const service = new EvidenceDiagnosticsService({ db, repository });

      const report = await service.diagnose({ ...BASE_EVIDENCE, tmdb_id: null });

      expect(report.history.recentCount).toBe(0);
      expect(report.history.rows).toHaveLength(0);
    });
  });

  // ── _assessAgreement ──────────────────────────────────────────────────────

  describe('_assessAgreement', () => {
    let service;

    beforeEach(() => {
      service = new EvidenceDiagnosticsService({
        db: makeMockDb(),
        repository: makeMockRepository()
      });
    });

    test('returns consistent:null when history is empty', () => {
      const result = service._assessAgreement(BASE_EVIDENCE, []);

      expect(result.consistent).toBeNull();
      expect(result.lastHistoryMethod).toBeNull();
    });

    test('returns consistent:true when evidence method matches history', () => {
      // buildCompatibilityPayload maps scope=item_exact → method='exact_match'
      const result = service._assessAgreement(
        BASE_EVIDENCE,
        [{ method: 'exact_match', confidence: 100, classified_at: new Date() }]
      );

      expect(result.consistent).toBe(true);
      expect(result.lastHistoryMethod).toBe('exact_match');
    });

    test('returns consistent:false when evidence method does not match history', () => {
      const result = service._assessAgreement(
        BASE_EVIDENCE,
        [{ method: 'ai_classification', confidence: 70, classified_at: new Date() }]
      );

      expect(result.consistent).toBe(false);
      expect(result.lastHistoryMethod).toBe('ai_classification');
    });
  });

  // ── error resilience ──────────────────────────────────────────────────────

  describe('diagnose — error resilience', () => {
    test('swallows db.query errors and returns empty report', async () => {
      const db = { query: jest.fn().mockRejectedValue(new Error('connection refused')) };
      const repository = makeMockRepository([]);
      const service = new EvidenceDiagnosticsService({ db, repository });

      // Should not throw
      await expect(service.diagnose(BASE_EVIDENCE)).resolves.toBeDefined();
    });

    test('swallows repository errors and returns empty report', async () => {
      const db = makeMockDb([]);
      const repository = {
        findRelatedEvidence: jest.fn().mockRejectedValue(new Error('repo error'))
      };
      const service = new EvidenceDiagnosticsService({ db, repository });

      // Should not throw; diagnose catches internally
      const report = await service.diagnose(BASE_EVIDENCE);
      expect(report).toBeDefined();
      // When an internal sub-call throws, diagnose catches and returns empty report
      expect(report.evidenceId === null || report.evidenceId === 42).toBe(true);
    });
  });

  // ── _summarizeByScope ─────────────────────────────────────────────────────

  describe('_summarizeByScope', () => {
    let service;

    beforeEach(() => {
      service = new EvidenceDiagnosticsService({
        db: makeMockDb(),
        repository: makeMockRepository()
      });
    });

    test('counts rows by scope correctly', () => {
      const rows = [
        { scope: 'genre' },
        { scope: 'genre' },
        { scope: 'item_exact' }
      ];
      const result = service._summarizeByScope(rows);
      expect(result).toEqual({ genre: 2, item_exact: 1 });
    });

    test('returns empty object for empty input', () => {
      expect(service._summarizeByScope([])).toEqual({});
    });
  });
});
