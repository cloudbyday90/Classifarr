/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MetadataProviderIntegrityService } from '../services/metadataProviderIntegrityService.mjs';
import { createMockDb, createMockLogger } from './helpers/mockFactory.mjs';

describe('MetadataProviderIntegrityService', () => {
  test('warnProviderRuntimeFailure emits a deduped runtime warning', () => {
    const logger = createMockLogger();
    const service = new MetadataProviderIntegrityService({ db: createMockDb(), logger });

    service.warnProviderRuntimeFailure({
      provider: 'omdb',
      category: 'queue_failure',
      message: 'OMDb enrichment failed; queuing for OMDb retry',
      metadata: { source: 'queue_enrichment', code: 'ECONNREFUSED' },
      dedupeSignature: 'econnrefused:provider_down',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'OMDb enrichment failed; queuing for OMDb retry',
      expect.objectContaining({
        provider: 'omdb',
        category: 'queue_failure',
        source: 'queue_enrichment',
        code: 'ECONNREFUSED',
      }),
      expect.objectContaining({
        dedupeKey: 'metadata-provider-runtime:omdb:queue_failure:econnrefused:provider_down',
      })
    );
  });

  test('auditPersistedConfigs warns once when TMDB, OMDb, and Tavily configs drift', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, is_active: true, api_key: '', daily_limit: 0, requests_today: -1 },
          { id: 2, is_active: true, api_key: 'secondary', daily_limit: 1000, requests_today: 5 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, is_active: true, api_key: '', search_depth: 'sideways', max_results: 0 },
          { id: 2, is_active: true, api_key: 'tavily-key', search_depth: 'advanced', max_results: 3 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, is_active: true, api_key: '', language: 'english' },
          { id: 2, is_active: true, api_key: 'tmdb-key', language: 'en-US' },
        ],
      });

    const service = new MetadataProviderIntegrityService({ db, logger, startupSampleLimit: 2 });
    const result = await service.auditPersistedConfigs({ source: 'startup_preflight' });

    expect(result.invalidProviderCount).toBe(3);
    expect(result.providers).toHaveLength(3);
    expect(logger.warn).toHaveBeenCalledWith(
      'Persisted metadata provider configuration drift detected; metadata lookups and enrichment may warn once and fall back conservatively',
      expect.objectContaining({
        source: 'startup_preflight',
        invalidProviderCount: 3,
      }),
      expect.objectContaining({
        dedupeKey: 'persisted-metadata-provider-config-drift',
      })
    );
  });

  test('auditPersistedConfigs stays quiet when provider config rows are valid', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, is_active: true, api_key: 'omdb-key', daily_limit: 1000, requests_today: 10 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, is_active: true, api_key: 'tavily-key', search_depth: 'advanced', max_results: 3 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, is_active: true, api_key: 'tmdb-key', language: 'en-US' },
        ],
      });

    const service = new MetadataProviderIntegrityService({ db, logger });
    const result = await service.auditPersistedConfigs({ source: 'startup_preflight' });

    expect(result).toEqual({ invalidProviderCount: 0, providers: [] });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('auditPersistedConfigs flags duplicate active TMDB rows and invalid language drift', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, is_active: true, api_key: 'tmdb-a', language: 'en-US' },
          { id: 2, is_active: true, api_key: 'tmdb-b', language: '' },
        ],
      });

    const service = new MetadataProviderIntegrityService({ db, logger });
    const result = await service.auditPersistedConfigs({ source: 'startup_preflight' });

    expect(result.invalidProviderCount).toBe(1);
    expect(result.providers).toEqual([
      expect.objectContaining({
        provider: 'tmdb',
        invalidCount: 2,
        sample: expect.arrayContaining([
          expect.objectContaining({ reasons: ['multiple_active_rows'] }),
          expect.objectContaining({ id: 2, reasons: ['invalid_language'] }),
        ]),
      }),
    ]);
  });
});
