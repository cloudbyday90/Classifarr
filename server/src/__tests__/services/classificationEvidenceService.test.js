/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for ClassificationEvidenceService.
 */

const { ClassificationEvidenceService } = require('../../services/classificationEvidenceService');

describe('ClassificationEvidenceService', () => {
  let learningPatternEvidenceAdapter;
  let discoveredPatternEvidenceAdapter;
  let service;

  beforeEach(() => {
    learningPatternEvidenceAdapter = {
      findExactMatch: jest.fn(),
      collectRelatedEvidence: jest.fn(),
      purgeEvidence: jest.fn(),
      listAll: jest.fn(),
      purgeAll: jest.fn(),
      restoreLegacyPattern: jest.fn()
    };
    discoveredPatternEvidenceAdapter = {
      collectRelatedEvidence: jest.fn()
    };
    service = new ClassificationEvidenceService({
      learningPatternEvidenceAdapter,
      discoveredPatternEvidenceAdapter,
      evidenceRepository: {
        findExactMatch: jest.fn().mockResolvedValue(null),
        upsertEvidence: jest.fn().mockResolvedValue(null),
        purgeByTmdbId: jest.fn().mockResolvedValue({ deleted: 0 })
      }
    });
  });

  test('findExactMatch returns normalized row from new table when found', async () => {
    service.evidenceRepository.findExactMatch = jest.fn().mockResolvedValueOnce({
      library_id: 14,
      confidence: 95,
      provenance: 'human_confirmed',
      media_type: 'movie',
      updated_at: '2025-01-01'
    });

    const result = await service.findExactMatch({ tmdbId: 550, mediaType: 'movie' });

    expect(result).toMatchObject({
      matched: true,
      libraryId: 14,
      confidence: 95,
      source: 'classification_evidence'
    });
    expect(learningPatternEvidenceAdapter.findExactMatch).not.toHaveBeenCalled();
  });

  test('findExactMatch falls back to legacy adapter when not in new table', async () => {
    service.evidenceRepository.findExactMatch = jest.fn().mockResolvedValueOnce(null);
    learningPatternEvidenceAdapter.findExactMatch.mockResolvedValueOnce({
      matched: true,
      libraryId: 14,
      source: 'learning_patterns'
    });

    const result = await service.findExactMatch({ tmdbId: 550, mediaType: 'movie' });

    expect(result).toMatchObject({ matched: true, libraryId: 14 });
    expect(learningPatternEvidenceAdapter.findExactMatch).toHaveBeenCalledWith({
      tmdbId: 550,
      mediaType: 'movie'
    });
  });

  test('collectRelatedEvidence excludes discovered patterns by default (Phase 7)', async () => {
    learningPatternEvidenceAdapter.collectRelatedEvidence.mockResolvedValueOnce([
      { scope: 'genre', libraryId: 10, confidence: 82, usageCount: 3, source: 'learning_patterns' }
    ]);

    const result = await service.collectRelatedEvidence({
      metadata: { genres: ['Documentary'], media_type: 'movie' }
    });

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('learning_patterns');
    expect(discoveredPatternEvidenceAdapter.collectRelatedEvidence).not.toHaveBeenCalled();
  });

  test('collectRelatedEvidence includes discovered patterns when explicitly opted in', async () => {
    learningPatternEvidenceAdapter.collectRelatedEvidence.mockResolvedValueOnce([
      { scope: 'genre', libraryId: 10, confidence: 82, usageCount: 3, source: 'learning_patterns' }
    ]);
    discoveredPatternEvidenceAdapter.collectRelatedEvidence.mockResolvedValueOnce([
      { scope: 'studio', libraryId: 20, confidence: 65, usageCount: 9, source: 'discovered_patterns' },
      { scope: 'franchise', libraryId: 30, confidence: 88, usageCount: 1, source: 'discovered_patterns' }
    ]);

    const result = await service.collectRelatedEvidence({
      metadata: { genres: ['Documentary'], media_type: 'movie' },
      includeDiscoveredPatterns: true
    });

    expect(result.map((entry) => `${entry.source}:${entry.scope}:${entry.libraryId}`)).toEqual([
      'discovered_patterns:franchise:30',
      'learning_patterns:genre:10',
      'discovered_patterns:studio:20'
    ]);
  });

  test('collectRelatedEvidence can skip discovered patterns during compatibility flows', async () => {
    learningPatternEvidenceAdapter.collectRelatedEvidence.mockResolvedValueOnce([
      { scope: 'genre', libraryId: 10, confidence: 82, usageCount: 3, source: 'learning_patterns' }
    ]);

    const result = await service.collectRelatedEvidence({
      metadata: { genres: ['Documentary'], media_type: 'movie' },
      includeDiscoveredPatterns: false
    });

    expect(result).toHaveLength(1);
    expect(discoveredPatternEvidenceAdapter.collectRelatedEvidence).not.toHaveBeenCalled();
  });

  test('purgeEvidence uses new table as primary and still calls legacy for compatibility', async () => {
    service.evidenceRepository.purgeByTmdbId = jest.fn().mockResolvedValueOnce({ deleted: 1 });
    learningPatternEvidenceAdapter.purgeEvidence.mockResolvedValueOnce({
      deleted: 1,
      deletedByScope: { item_exact: 1 }
    });

    const result = await service.purgeEvidence({
      tmdbId: 550,
      mediaType: 'movie',
      scopes: ['item_exact'],
      actor: 'admin',
      reason: 'classification_retry'
    });

    expect(service.evidenceRepository.purgeByTmdbId).toHaveBeenCalledWith({
      tmdbId: 550,
      mediaType: 'movie',
      scopes: ['item_exact'],
      client: null
    });
    expect(result).toEqual({
      deleted: 2,
      deletedByScope: { item_exact: 2 },
      classificationEvidence: { deleted: 1 },
      actor: 'admin',
      reason: 'classification_retry'
    });
  });

  test('listLegacyPatterns delegates to the learning adapter', async () => {
    learningPatternEvidenceAdapter.listAll.mockResolvedValueOnce([{ id: 1 }]);

    const result = await service.listLegacyPatterns();

    expect(learningPatternEvidenceAdapter.listAll).toHaveBeenCalledWith({ client: null });
    expect(result).toEqual([{ id: 1 }]);
  });

  test('purgeAllLegacyPatterns preserves lifecycle metadata', async () => {
    learningPatternEvidenceAdapter.purgeAll.mockResolvedValueOnce({
      deleted: 3,
      rows: [{ id: 11 }, { id: 12 }, { id: 13 }]
    });

    const result = await service.purgeAllLegacyPatterns({
      actor: 'carsa',
      reason: 'clear_and_resync'
    });

    expect(learningPatternEvidenceAdapter.purgeAll).toHaveBeenCalledWith({ client: null });
    expect(result).toEqual({
      deleted: 3,
      rows: [{ id: 11 }, { id: 12 }, { id: 13 }],
      actor: 'carsa',
      reason: 'clear_and_resync'
    });
  });
});
// ── Phase 7: new-table-primary tests ──────────────────────────────────────────

describe('ClassificationEvidenceService — Phase 7 write paths', () => {
  function makeRepo(overrides = {}) {
    return {
      findExactMatch: jest.fn().mockResolvedValue(null),
      upsertEvidence: jest.fn().mockResolvedValue({ id: 10 }),
      purgeByTmdbId: jest.fn().mockResolvedValue({ deleted: 0 }),
      ...overrides
    };
  }

  function makeLpAdapter(overrides = {}) {
    return {
      findExactMatch: jest.fn().mockResolvedValue(null),
      collectRelatedEvidence: jest.fn().mockResolvedValue([]),
      purgeEvidence: jest.fn().mockResolvedValue({ deleted: 0, deletedByScope: {} }),
      listAll: jest.fn().mockResolvedValue([]),
      purgeAll: jest.fn().mockResolvedValue({ deleted: 0, rows: [] }),
      restoreLegacyPattern: jest.fn().mockResolvedValue(null),
      ...overrides
    };
  }

  function makeSvc(repoOverrides = {}, lpOverrides = {}) {
    return new ClassificationEvidenceService({
      learningPatternEvidenceAdapter: makeLpAdapter(lpOverrides),
      discoveredPatternEvidenceAdapter: { collectRelatedEvidence: jest.fn().mockResolvedValue([]) },
      evidenceRepository: makeRepo(repoOverrides)
    });
  }

  describe('rememberExactMatch', () => {
    test('writes item_exact to repository with human_confirmed provenance', async () => {
      const svc = makeSvc();
      await svc.rememberExactMatch({ tmdbId: 550, mediaType: 'movie', libraryId: 7, payload: { title: 'Fight Club' }, createdBy: 'admin', conflictMode: 'do_nothing' });

      const [record, opts] = svc.evidenceRepository.upsertEvidence.mock.calls[0];
      expect(record.scope).toBe('item_exact');
      expect(record.tmdbId).toBe(550);
      expect(record.provenance).toBe('human_confirmed');
      expect(record.evidenceKey).toBeNull();
      expect(opts.conflictMode).toBe('do_nothing');
    });

    test('maps update_metadata to update_data for repository', async () => {
      const svc = makeSvc();
      await svc.rememberExactMatch({ tmdbId: 1, mediaType: 'movie', libraryId: 1, conflictMode: 'update_metadata' });

      const [, opts] = svc.evidenceRepository.upsertEvidence.mock.calls[0];
      expect(opts.conflictMode).toBe('update_data');
    });

    test('returns null and skips write when tmdbId is null', async () => {
      const svc = makeSvc();
      const result = await svc.rememberExactMatch({ tmdbId: null, mediaType: 'movie', libraryId: 1, conflictMode: 'do_nothing' });

      expect(result).toBeNull();
      expect(svc.evidenceRepository.upsertEvidence).not.toHaveBeenCalled();
    });

    test('does NOT write to the legacy learning adapter', async () => {
      const svc = makeSvc();
      await svc.rememberExactMatch({ tmdbId: 550, mediaType: 'movie', libraryId: 7, conflictMode: 'do_nothing' });

      expect(svc.learningPatternEvidenceAdapter.findExactMatch).not.toHaveBeenCalled();
      // legacy adapter has no rememberExactMatch after Phase 7 flip
    });

    test('passes client to repository', async () => {
      const svc = makeSvc();
      const mockClient = {};
      await svc.rememberExactMatch({ tmdbId: 550, mediaType: 'movie', libraryId: 1, client: mockClient, conflictMode: 'update_metadata' });

      const [, repoOpts] = svc.evidenceRepository.upsertEvidence.mock.calls[0];
      expect(repoOpts.client).toBe(mockClient);
    });
  });

  describe('reinforceGenrePatterns', () => {
    test('writes each genre directly to repository with policy_confirmed provenance', async () => {
      const svc = makeSvc();
      const result = await svc.reinforceGenrePatterns({ mediaType: 'movie', libraryId: 58, genres: ['Documentary', 'Drama'], createdBy: 'alice' });

      expect(svc.evidenceRepository.upsertEvidence).toHaveBeenCalledTimes(2);
      const [docRecord, docOpts] = svc.evidenceRepository.upsertEvidence.mock.calls[0];
      expect(docRecord.scope).toBe('genre');
      expect(docRecord.evidenceKey).toBe('genre:documentary');
      expect(docRecord.provenance).toBe('policy_confirmed');
      expect(docOpts.conflictMode).toBe('update_data');
      expect(result).toEqual(['documentary', 'drama']);
    });

    test('returns empty list when no genres provided', async () => {
      const svc = makeSvc();
      const result = await svc.reinforceGenrePatterns({ mediaType: 'movie', libraryId: 1, genres: [], createdBy: null });
      expect(result).toEqual([]);
      expect(svc.evidenceRepository.upsertEvidence).not.toHaveBeenCalled();
    });

    test('swallows individual genre error, continues loop, excludes failed genre from return', async () => {
      let callCount = 0;
      const svc = makeSvc({
        upsertEvidence: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.reject(new Error('fail'));
          return Promise.resolve({ id: callCount });
        })
      });
      const result = await svc.reinforceGenrePatterns({ mediaType: 'movie', libraryId: 1, genres: ['Genre_A', 'Genre_B'], createdBy: null });
      expect(svc.evidenceRepository.upsertEvidence).toHaveBeenCalledTimes(2);
      // genre_a failed to upsert, genre_b succeeded
      expect(result).toEqual(['genre_b']);
    });
  });
});