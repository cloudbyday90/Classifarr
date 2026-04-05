/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for EvidenceHistoryReadModel
 */

'use strict';

const { EvidenceHistoryReadModel } = require('../../services/evidenceHistoryReadModel');
const { LEGACY_METHOD } = require('../../services/evidenceCompatibilityMapper');

function makeRepo(overrides = {}) {
  return {
    findExactMatch: jest.fn().mockResolvedValue(null),
    findRelatedEvidence: jest.fn().mockResolvedValue([]),
    ...overrides
  };
}

function makeModel(repoOverrides = {}) {
  return new EvidenceHistoryReadModel({ repository: makeRepo(repoOverrides) });
}

describe('EvidenceHistoryReadModel', () => {

  // ── getItemSummary ─────────────────────────────────────────────────────────

  describe('getItemSummary', () => {
    test('returns empty result when no evidence rows exist', async () => {
      const model = makeModel();
      const result = await model.getItemSummary({ tmdbId: 550, mediaType: 'movie' });

      expect(result.winningEvidence).toBeNull();
      expect(result.authoritativeEvidence).toBeNull();
      expect(result.relatedEvidenceSummary).toEqual({});
      expect(result.method).toBe(LEGACY_METHOD.POLICY_AUTO);
      expect(result.isAuthoritative).toBe(false);
    });

    test('item_exact (human_confirmed) → winning=exact, authoritative=exact, method=exact_match', async () => {
      const exactRow = { scope: 'item_exact', provenance: 'human_confirmed', tmdb_id: 550, media_type: 'movie', confidence: 100 };
      const model = makeModel({
        findExactMatch: jest.fn().mockResolvedValue(exactRow)
      });

      const result = await model.getItemSummary({ tmdbId: 550, mediaType: 'movie' });

      expect(result.winningEvidence).toBe(exactRow);
      expect(result.authoritativeEvidence).toBe(exactRow);
      expect(result.method).toBe(LEGACY_METHOD.EXACT_MATCH);
      expect(result.methodLabel).toBe('Exact Match');
      expect(result.isAuthoritative).toBe(true);
    });

    test('item_exact (mined provenance) → authoritative=null but winning=exact', async () => {
      const exactRow = { scope: 'item_exact', provenance: 'mined', tmdb_id: 99, confidence: 80 };
      const model = makeModel({
        findExactMatch: jest.fn().mockResolvedValue(exactRow)
      });

      const result = await model.getItemSummary({ tmdbId: 99, mediaType: 'movie' });

      expect(result.winningEvidence).toBe(exactRow);
      expect(result.authoritativeEvidence).toBeNull();
      expect(result.isAuthoritative).toBe(false);
    });

    test('no exact match → winning falls back to best related row', async () => {
      const genreRow = { scope: 'genre', provenance: 'policy_confirmed', evidence_key: 'genre:action', confidence: 90 };
      const model = makeModel({
        findExactMatch: jest.fn().mockResolvedValue(null),
        findRelatedEvidence: jest.fn().mockResolvedValue([genreRow])
      });

      const result = await model.getItemSummary({ tmdbId: 550, mediaType: 'movie', libraryId: 3 });

      expect(result.winningEvidence).toBe(genreRow);
      expect(result.method).toBe(LEGACY_METHOD.LEARNED_PATTERN);
    });

    test('related evidence is grouped by scope in relatedEvidenceSummary', async () => {
      const rows = [
        { scope: 'genre',   confidence: 90, evidence_key: 'genre:action' },
        { scope: 'genre',   confidence: 75, evidence_key: 'genre:drama' },
        { scope: 'studio',  confidence: 80, evidence_key: 'studio:marvel' }
      ];
      const model = makeModel({
        findRelatedEvidence: jest.fn().mockResolvedValue(rows)
      });

      const result = await model.getItemSummary({ tmdbId: 550, mediaType: 'movie', libraryId: 1 });
      const summary = result.relatedEvidenceSummary;

      expect(summary.genre.count).toBe(2);
      expect(summary.genre.topRow.evidence_key).toBe('genre:action');
      expect(summary.studio.count).toBe(1);
      expect(summary.franchise).toBeUndefined();
    });

    test('does not query related evidence when no libraryIds provided', async () => {
      const findRelated = jest.fn().mockResolvedValue([]);
      const model = new EvidenceHistoryReadModel({
        repository: makeRepo({ findRelatedEvidence: findRelated })
      });

      await model.getItemSummary({ tmdbId: 550, mediaType: 'movie' });

      expect(findRelated).not.toHaveBeenCalled();
    });

    test('uses fallbackMethod when no evidence row exists', async () => {
      const model = makeModel();
      const result = await model.getItemSummary({ tmdbId: 1, mediaType: 'movie', fallbackMethod: 'learned_pattern' });

      expect(result.method).toBe('learned_pattern');
      expect(result.methodLabel).toBe('Learned Pattern');
    });

    test('swallows repository error and returns empty result', async () => {
      const model = makeModel({
        findExactMatch: jest.fn().mockRejectedValue(new Error('DB down'))
      });

      await expect(
        model.getItemSummary({ tmdbId: 1, mediaType: 'movie' })
      ).resolves.toMatchObject({
        winningEvidence: null,
        isAuthoritative: false
      });
    });
  });

  // ── getRowSummary ──────────────────────────────────────────────────────────

  describe('getRowSummary', () => {
    test('hasExactMatch=false when no row', async () => {
      const model = makeModel();
      const result = await model.getRowSummary({ tmdbId: 99, mediaType: 'movie' });
      expect(result.hasExactMatch).toBe(false);
      expect(result.method).toBe(LEGACY_METHOD.POLICY_AUTO);
    });

    test('hasExactMatch=true when exact row present', async () => {
      const model = makeModel({
        findExactMatch: jest.fn().mockResolvedValue({ scope: 'item_exact', provenance: 'human_confirmed' })
      });
      const result = await model.getRowSummary({ tmdbId: 550, mediaType: 'movie' });
      expect(result.hasExactMatch).toBe(true);
      expect(result.isAuthoritative).toBe(true);
    });

    test('swallows error and returns safe defaults', async () => {
      const model = makeModel({
        findExactMatch: jest.fn().mockRejectedValue(new Error('timeout'))
      });
      const result = await model.getRowSummary({ tmdbId: 1, mediaType: 'movie' });
      expect(result.hasExactMatch).toBe(false);
    });
  });

  // ── getLibrarySummary ──────────────────────────────────────────────────────

  describe('getLibrarySummary', () => {
    test('returns empty stats when no rows exist', async () => {
      const model = makeModel();
      const result = await model.getLibrarySummary({ libraryIds: [1, 2] });
      expect(result.total).toBe(0);
      expect(result.byScope).toEqual({});
      expect(result.topItems).toEqual([]);
    });

    test('groups rows by scope and returns counts', async () => {
      const rows = [
        { scope: 'genre', confidence: 90 },
        { scope: 'genre', confidence: 85 },
        { scope: 'studio', confidence: 75 }
      ];
      const model = makeModel({
        findRelatedEvidence: jest.fn().mockResolvedValue(rows)
      });

      const result = await model.getLibrarySummary({ libraryIds: [5] });

      expect(result.total).toBe(3);
      expect(result.byScope.genre).toBe(2);
      expect(result.byScope.studio).toBe(1);
    });

    test('limits topItems to 5 highest-confidence rows', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        scope: 'genre', confidence: 90 - i, evidence_key: `genre:k${i}`
      }));
      const model = makeModel({
        findRelatedEvidence: jest.fn().mockResolvedValue(rows)
      });

      const result = await model.getLibrarySummary({ libraryIds: [5] });
      expect(result.topItems).toHaveLength(5);
      expect(result.topItems[0].confidence).toBe(90);
    });

    test('swallows error and returns empty stats', async () => {
      const model = makeModel({
        findRelatedEvidence: jest.fn().mockRejectedValue(new Error('DB error'))
      });
      const result = await model.getLibrarySummary({ libraryIds: [1] });
      expect(result.total).toBe(0);
    });
  });
});
