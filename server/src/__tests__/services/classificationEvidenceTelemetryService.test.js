/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for classificationEvidenceTelemetryService
 */

'use strict';

const {
  ClassificationEvidenceTelemetryService
} = require('../../services/classificationEvidenceTelemetryService');

function makeComparisonService(overrides = {}) {
  return {
    buildComparisonRecord: jest.fn().mockResolvedValue({ consistent: true, exact: { consistent: true, reasons: [] }, related: { consistent: true, reasons: [] } }),
    ...overrides
  };
}

function makeSvc(comparisonOverrides = {}, opts = {}) {
  return new ClassificationEvidenceTelemetryService({
    comparisonService: makeComparisonService(comparisonOverrides),
    ...opts
  });
}

describe('ClassificationEvidenceTelemetryService', () => {

  // ── recordClassificationEvent ──────────────────────────────────────────────

  describe('recordClassificationEvent', () => {
    test('returns without throwing even when comparison service throws', async () => {
      const svc = makeSvc({
        buildComparisonRecord: jest.fn().mockRejectedValue(new Error('DB error'))
      });

      await expect(
        svc.recordClassificationEvent({ tmdbId: 550, mediaType: 'movie', classificationId: 'abc' })
      ).resolves.not.toThrow();
    });

    test('calls buildComparisonRecord with correct params', async () => {
      const buildFn = jest.fn().mockResolvedValue({ consistent: true, exact: { consistent: true, reasons: [] }, related: { consistent: true, reasons: [] } });
      const svc = makeSvc({ buildComparisonRecord: buildFn });

      await svc.recordClassificationEvent({
        tmdbId: 550, mediaType: 'movie', classificationId: 'abc123'
      });

      expect(buildFn).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 550, mediaType: 'movie', classificationId: 'abc123' })
      );
    });

    test('skips execution when both tmdbId and metadata are absent', async () => {
      const buildFn = jest.fn().mockResolvedValue({ consistent: true, exact: { consistent: true, reasons: [] }, related: null });
      const svc = makeSvc({ buildComparisonRecord: buildFn });

      await svc.recordClassificationEvent({ classificationId: 'abc' });

      expect(buildFn).not.toHaveBeenCalled();
    });

    test('passes metadata to comparison service when provided', async () => {
      const buildFn = jest.fn().mockResolvedValue({ consistent: true, exact: { consistent: true, reasons: [] }, related: null });
      const svc = makeSvc({ buildComparisonRecord: buildFn });

      await svc.recordClassificationEvent({
        tmdbId: 123, mediaType: 'show', classificationId: 'xyz',
        metadata: { source: 'test' }
      });

      expect(buildFn).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 123, mediaType: 'show', metadata: expect.objectContaining({ source: 'test' }) })
      );
    });
  });

  // ── recordBatch ────────────────────────────────────────────────────────────

  describe('recordBatch', () => {
    test('returns totals with all consistent', async () => {
      const svc = makeSvc({
        buildComparisonRecord: jest.fn().mockResolvedValue({ consistent: true, exact: { consistent: true, reasons: [] }, related: null })
      });

      const result = await svc.recordBatch([
        { tmdbId: 1, mediaType: 'movie' },
        { tmdbId: 2, mediaType: 'movie' }
      ]);

      expect(result.total).toBe(2);
      expect(result.errors).toBe(0);
    });

    test('counts mismatches when comparison returns inconsistent', async () => {
      const svc = makeSvc({
        buildComparisonRecord: jest.fn().mockResolvedValue({ consistent: false, exact: { consistent: false, reasons: ['library_id_mismatch'] }, related: null })
      });

      const result = await svc.recordBatch([
        { tmdbId: 1, mediaType: 'movie' },
        { tmdbId: 2, mediaType: 'movie' }
      ]);

      expect(result.total).toBe(2);
      expect(result.mismatches).toBe(2);
      expect(result.errors).toBe(0);
    });

    test('counts errors when comparison service throws; does not rethrow', async () => {
      const svc = makeSvc({
        buildComparisonRecord: jest.fn().mockRejectedValue(new Error('timeout'))
      });

      const result = await svc.recordBatch([
        { tmdbId: 1, mediaType: 'movie' }
      ]);

      expect(result.total).toBe(1);
      expect(result.errors).toBe(1);
    });

    test('returns empty stats for empty input', async () => {
      const svc = makeSvc();
      const result = await svc.recordBatch([]);
      expect(result).toEqual({ total: 0, mismatches: 0, errors: 0 });
    });
  });
});
