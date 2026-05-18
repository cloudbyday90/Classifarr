/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { createDbRowsResult, createLoggerModuleMock, createTransactionalDbMock } from './helpers/mockFactory.mjs';

const mockDb = createTransactionalDbMock();
const loggerModuleMock = createLoggerModuleMock();

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...mockDb,
  default: mockDb,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => loggerModuleMock.module);

const { PolicyThresholdIntegrityService } = await import('../services/policyThresholdIntegrityService.mjs');

describe('PolicyThresholdIntegrityService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockDb.query.mockReset();
    mockLogger = loggerModuleMock.logger;
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();
    service = new PolicyThresholdIntegrityService({ db: mockDb, logger: mockLogger });
  });

  describe('warnOnNormalizedThresholds', () => {
    test('does nothing when thresholds did not require normalization', () => {
      const didWarn = service.warnOnNormalizedThresholds({
        source: 'policy_ranking',
        thresholds: { policy_id: 7, library_id: 2 },
        normalizedThresholds: { wasNormalized: false, reasons: [] },
      });

      expect(didWarn).toBe(false);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('emits a deduped warning with policy context when thresholds were normalized', () => {
      const didWarn = service.warnOnNormalizedThresholds({
        source: 'clarification_tiering',
        thresholds: {
          policy_id: 12,
          library_id: 4,
          policy_name: 'Movies',
          library_name: 'Movies',
          auto_classify_threshold: null,
          prompt_threshold: 120,
        },
        normalizedThresholds: {
          wasNormalized: true,
          reasons: [
            'auto_classify_threshold was missing or invalid; using conservative fallback',
            'prompt_threshold exceeded the policy-engine ceiling; using conservative fallback',
          ],
        },
      });

      expect(didWarn).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Normalized invalid policy thresholds; conservative fallback will be used',
        expect.objectContaining({
          source: 'clarification_tiering',
          policyId: 12,
          libraryId: 4,
          policyName: 'Movies',
          libraryName: 'Movies',
          autoClassifyThreshold: null,
          promptThreshold: 120,
        }),
        expect.objectContaining({
          dedupeKey: expect.stringContaining('policy-threshold-normalized:clarification_tiering:12:4'),
          dedupeWindowMs: 15 * 60 * 1000,
        })
      );
    });
  });

  describe('auditPersistedThresholds', () => {
    test('returns a clean summary without warning when all persisted thresholds are valid', async () => {
      mockDb.query.mockResolvedValueOnce(createDbRowsResult([
        { invalid_count: 0, sample_rows: [] },
      ]));

      const result = await service.auditPersistedThresholds({ source: 'startup_preflight' });

      expect(result).toEqual({ invalidCount: 0, sample: [] });
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('emits one summarized warning when persisted policy thresholds are invalid', async () => {
      mockDb.query.mockResolvedValueOnce(createDbRowsResult([
        {
          invalid_count: 2,
          sample_rows: [
            {
              policy_id: 5,
              library_id: 11,
              policy_name: 'Movies Policy',
              library_name: 'Movies',
              auto_classify_threshold: null,
              prompt_threshold: 60,
            },
            {
              policy_id: 9,
              library_id: 12,
              policy_name: 'Shows Policy',
              library_name: 'Shows',
              auto_classify_threshold: 70,
              prompt_threshold: 80,
            },
          ],
        },
      ]));

      const result = await service.auditPersistedThresholds({ source: 'startup_preflight' });

      expect(result).toEqual({
        invalidCount: 2,
        sample: [
          {
            policyId: 5,
            libraryId: 11,
            policyName: 'Movies Policy',
            libraryName: 'Movies',
            autoClassifyThreshold: null,
            promptThreshold: 60,
          },
          {
            policyId: 9,
            libraryId: 12,
            policyName: 'Shows Policy',
            libraryName: 'Shows',
            autoClassifyThreshold: 70,
            promptThreshold: 80,
          },
        ],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Persisted library policy thresholds are invalid; conservative runtime fallback may be used',
        expect.objectContaining({
          source: 'startup_preflight',
          invalidCount: 2,
          sample: expect.arrayContaining([
            expect.objectContaining({ policyId: 5, libraryId: 11 }),
            expect.objectContaining({ policyId: 9, libraryId: 12 }),
          ]),
        }),
        expect.objectContaining({
          dedupeKey: 'persisted-library-policy-threshold-drift',
          dedupeWindowMs: 15 * 60 * 1000,
        })
      );
    });
  });
});
