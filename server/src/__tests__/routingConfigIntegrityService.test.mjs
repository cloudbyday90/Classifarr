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

const { RoutingConfigIntegrityService } = await import('../services/routingConfigIntegrityService.mjs');

describe('RoutingConfigIntegrityService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockDb.query.mockReset();
    mockLogger = loggerModuleMock.logger;
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();
    service = new RoutingConfigIntegrityService({ db: mockDb, logger: mockLogger });
  });

  describe('warnRoutingDrift', () => {
    test('warns with dedupe metadata for config drift reasons', () => {
      const warned = service.warnRoutingDrift({
        reasonCode: 'config_missing_or_inactive',
        library: { id: 4, name: 'Movies', arr_type: 'radarr', arr_id: 12 },
        metadata: { title: 'Example Movie' },
        details: { arrType: 'radarr', arrId: 12 },
      });

      expect(warned).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Mapped *arr config is missing or inactive; routing will be skipped until configuration is repaired',
        expect.objectContaining({
          title: 'Example Movie',
          libraryId: 4,
          libraryName: 'Movies',
          arrType: 'radarr',
          arrConfigId: 12,
        }),
        expect.objectContaining({
          dedupeKey: 'routing-drift:config_missing_or_inactive:4:radarr:12:none',
          dedupeWindowMs: 15 * 60 * 1000,
        })
      );
    });

    test('returns false for unsupported reason codes', () => {
      const warned = service.warnRoutingDrift({
        reasonCode: 'lookup_no_series',
        library: { id: 5 },
      });

      expect(warned).toBe(false);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('auditPersistedMappings', () => {
    test('returns a clean summary without warning when mappings are valid', async () => {
      mockDb.query.mockResolvedValueOnce(createDbRowsResult([
        { invalid_count: 0, sample_rows: [] },
      ]));

      const result = await service.auditPersistedMappings({ source: 'startup_preflight' });

      expect(result).toEqual({ invalidCount: 0, sample: [] });
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('warns once when persisted mappings reference missing or inactive configs', async () => {
      mockDb.query.mockResolvedValueOnce(createDbRowsResult([
        {
          invalid_count: 2,
          sample_rows: [
            {
              library_id: 3,
              library_name: 'Movies',
              arr_type: 'radarr',
              arr_config_id: null,
              issue: 'missing_arr_config_id',
            },
            {
              library_id: 7,
              library_name: 'Shows',
              arr_type: 'sonarr',
              arr_config_id: 19,
              issue: 'sonarr_config_missing_or_inactive',
            },
          ],
        },
      ]));

      const result = await service.auditPersistedMappings({ source: 'startup_preflight' });

      expect(result).toEqual({
        invalidCount: 2,
        sample: [
          {
            libraryId: 3,
            libraryName: 'Movies',
            arrType: 'radarr',
            arrConfigId: null,
            issue: 'missing_arr_config_id',
          },
          {
            libraryId: 7,
            libraryName: 'Shows',
            arrType: 'sonarr',
            arrConfigId: 19,
            issue: 'sonarr_config_missing_or_inactive',
          },
        ],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Persisted *arr library mappings are incomplete or reference inactive configs; routing will be skipped until configuration is repaired',
        expect.objectContaining({
          source: 'startup_preflight',
          invalidCount: 2,
          sample: expect.arrayContaining([
            expect.objectContaining({ libraryId: 3, issue: 'missing_arr_config_id' }),
            expect.objectContaining({ libraryId: 7, issue: 'sonarr_config_missing_or_inactive' }),
          ]),
        }),
        expect.objectContaining({
          dedupeKey: 'persisted-routing-config-drift',
          dedupeWindowMs: 15 * 60 * 1000,
        })
      );
    });
  });
});
