import { jest } from '@jest/globals';

import { ClassificationEvidenceComparisonService, MISMATCH_REASON } from '../../services/classificationEvidenceComparisonService.mjs';

function makeMockEvidenceService(overrides = {}) {
  return {
    findExactMatch: jest.fn().mockResolvedValue(null),
    collectRelatedEvidence: jest.fn().mockResolvedValue([]),
    ...overrides
  };
}

function makeMockRepo(overrides = {}) {
  return {
    findExactMatch: jest.fn().mockResolvedValue(null),
    findRelatedEvidence: jest.fn().mockResolvedValue([]),
    ...overrides
  };
}

function makeSvc(svcOverrides = {}, repoOverrides = {}) {
  return new ClassificationEvidenceComparisonService({
    evidenceService: makeMockEvidenceService(svcOverrides),
    evidenceRepository: makeMockRepo(repoOverrides)
  });
}

describe('ClassificationEvidenceComparisonService', () => {

  describe('compareExactMatch', () => {
    test('reports consistent when legacy and new table agree on library_id', async () => {
      const svc = makeSvc(
        { findExactMatch: jest.fn().mockResolvedValue({ library_id: 7, provenance: 'human_confirmed', status: 'active' }) },
        { findExactMatch: jest.fn().mockResolvedValue({ library_id: 7, provenance: 'human_confirmed', status: 'active' }) }
      );

      const result = await svc.compareExactMatch({ tmdbId: 550, mediaType: 'movie' });

      expect(result.consistent).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.legacy).toBe(7);
      expect(result.evidence).toBe(7);
    });

    test('reports LIBRARY_MISMATCH when library IDs differ', async () => {
      const svc = makeSvc(
        { findExactMatch: jest.fn().mockResolvedValue({ library_id: 7 }) },
        { findExactMatch: jest.fn().mockResolvedValue({ library_id: 9 }) }
      );

      const result = await svc.compareExactMatch({ tmdbId: 550, mediaType: 'movie' });

      expect(result.consistent).toBe(false);
      expect(result.reasons).toContain(MISMATCH_REASON.LIBRARY_MISMATCH);
    });

    test('reports MISSING_BACKFILL when legacy exists but new table does not', async () => {
      const svc = makeSvc(
        { findExactMatch: jest.fn().mockResolvedValue({ library_id: 7 }) },
        { findExactMatch: jest.fn().mockResolvedValue(null) }
      );

      const result = await svc.compareExactMatch({ tmdbId: 550, mediaType: 'movie' });

      expect(result.consistent).toBe(false);
      expect(result.reasons).toContain(MISMATCH_REASON.MISSING_BACKFILL);
    });

    test('reports consistent when both legacy and new table have no record', async () => {
      const svc = makeSvc();

      const result = await svc.compareExactMatch({ tmdbId: 999, mediaType: 'movie' });

      expect(result.consistent).toBe(true);
    });

    test('accepts pre-fetched legacyResult and does not re-fetch', async () => {
      const mockFetch = jest.fn();
      const svc = new ClassificationEvidenceComparisonService({
        evidenceService: { findExactMatch: mockFetch },
        evidenceRepository: makeMockRepo()
      });

      await svc.compareExactMatch({ tmdbId: 1, mediaType: 'movie', legacyResult: { library_id: 5 } });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('swallows errors and returns error record', async () => {
      const svc = new ClassificationEvidenceComparisonService({
        evidenceService: { findExactMatch: jest.fn().mockRejectedValue(new Error('db fail')) },
        evidenceRepository: makeMockRepo()
      });

      const result = await svc.compareExactMatch({ tmdbId: 1, mediaType: 'movie' });

      expect(result.error).toBeDefined();
      expect(result.consistent).toBeUndefined();
    });
  });

  describe('compareRelatedEvidence', () => {
    test('reports consistent when legacy and new table have matching keys', async () => {
      const svc = makeSvc(
        { collectRelatedEvidence: jest.fn().mockResolvedValue([
            { evidenceKey: 'genre:documentary' },
            { evidenceKey: 'studio:a24' }
          ]) },
        { findRelatedEvidence: jest.fn().mockResolvedValue([
            { evidence_key: 'genre:documentary' },
            { evidence_key: 'studio:a24' }
          ]) }
      );

      const result = await svc.compareRelatedEvidence({ metadata: {}, libraryIds: [1] });

      expect(result.consistent).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    test('reports MISSING_BACKFILL when legacy key is absent in new table', async () => {
      const svc = makeSvc(
        { collectRelatedEvidence: jest.fn().mockResolvedValue([{ evidenceKey: 'genre:documentary' }]) },
        { findRelatedEvidence: jest.fn().mockResolvedValue([]) }
      );

      const result = await svc.compareRelatedEvidence({ metadata: {}, libraryIds: [1] });

      expect(result.consistent).toBe(false);
      expect(result.reasons).toContain(MISMATCH_REASON.MISSING_BACKFILL);
      expect(result.detail.missingInNew).toContain('genre:documentary');
    });

    test('reports EXTRA_IN_NEW when new table has keys absent in legacy', async () => {
      const svc = makeSvc(
        { collectRelatedEvidence: jest.fn().mockResolvedValue([{ evidenceKey: 'genre:documentary' }]) },
        { findRelatedEvidence: jest.fn().mockResolvedValue([
            { evidence_key: 'genre:documentary' },
            { evidence_key: 'studio:a24' }
          ]) }
      );

      const result = await svc.compareRelatedEvidence({ metadata: {}, libraryIds: [1] });

      expect(result.consistent).toBe(false);
      expect(result.reasons).toContain(MISMATCH_REASON.EXTRA_IN_NEW);
      expect(result.detail.extraInNew).toContain('studio:a24');
    });

    test('reports consistent when both legacy and new table are empty', async () => {
      const svc = makeSvc();
      const result = await svc.compareRelatedEvidence({ metadata: {}, libraryIds: [] });
      expect(result.consistent).toBe(true);
    });

    test('swallows errors and returns error record', async () => {
      const svc = new ClassificationEvidenceComparisonService({
        evidenceService: { collectRelatedEvidence: jest.fn().mockRejectedValue(new Error('fail')) },
        evidenceRepository: makeMockRepo()
      });

      const result = await svc.compareRelatedEvidence({ metadata: {}, libraryIds: [] });
      expect(result.error).toBeDefined();
    });
  });

  describe('buildComparisonRecord', () => {
    test('combines exact and related comparisons into one record', async () => {
      const svc = makeSvc(
        {
          findExactMatch: jest.fn().mockResolvedValue({ library_id: 7 }),
          collectRelatedEvidence: jest.fn().mockResolvedValue([{ evidenceKey: 'genre:documentary' }])
        },
        {
          findExactMatch: jest.fn().mockResolvedValue({ library_id: 7 }),
          findRelatedEvidence: jest.fn().mockResolvedValue([{ evidence_key: 'genre:documentary' }])
        }
      );

      const result = await svc.buildComparisonRecord({
        classificationId: 42,
        tmdbId: 550,
        mediaType: 'movie',
        metadata: { media_type: 'movie' },
        candidateLibraryIds: [7]
      });

      expect(result.classificationId).toBe(42);
      expect(result.consistent).toBe(true);
      expect(result.exact.consistent).toBe(true);
      expect(result.related.consistent).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    test('reports not consistent when either sub-comparison fails', async () => {
      const svc = makeSvc(
        { findExactMatch: jest.fn().mockResolvedValue({ library_id: 7 }) },
        {
          findExactMatch: jest.fn().mockResolvedValue({ library_id: 9 }),
          findRelatedEvidence: jest.fn().mockResolvedValue([])
        }
      );

      const result = await svc.buildComparisonRecord({
        classificationId: 1, tmdbId: 550, mediaType: 'movie',
        metadata: {}, candidateLibraryIds: []
      });

      expect(result.consistent).toBe(false);
    });
  });
});
