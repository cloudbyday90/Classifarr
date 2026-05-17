/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { QueueConcurrencySettingsService } from '../services/queueConcurrencySettingsService.mjs';

describe('QueueConcurrencySettingsService', () => {
  it('returns defaults when no queue settings exist', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new QueueConcurrencySettingsService({ db, logger: { warn: jest.fn() } });

    await expect(service.getConfig()).resolves.toEqual({
      generalWorkers: 1,
      metadataEnrichmentWorkers: 5,
    });
  });

  it('normalizes persisted queue settings', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { key: 'queue_concurrent_workers', value: '3' },
          { key: 'queue_metadata_enrichment_workers', value: '8' },
        ],
      }),
    };
    const service = new QueueConcurrencySettingsService({ db, logger: { warn: jest.fn() } });

    await expect(service.getConfig()).resolves.toEqual({
      generalWorkers: 3,
      metadataEnrichmentWorkers: 8,
    });
  });

  it('clamps persisted queue settings into supported ranges', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { key: 'queue_concurrent_workers', value: '0' },
          { key: 'queue_metadata_enrichment_workers', value: '999' },
        ],
      }),
    };
    const service = new QueueConcurrencySettingsService({ db, logger: { warn: jest.fn() } });

    await expect(service.getConfig()).resolves.toEqual({
      generalWorkers: 1,
      metadataEnrichmentWorkers: 20,
    });
  });

  it('caches results until invalidated', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ key: 'queue_concurrent_workers', value: '2' }],
      }),
    };
    const service = new QueueConcurrencySettingsService({
      db,
      logger: { warn: jest.fn() },
      cacheTtlMs: 60_000,
    });

    await service.getConfig();
    await service.getConfig();
    expect(db.query).toHaveBeenCalledTimes(1);

    service.invalidate();
    await service.getConfig();
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

