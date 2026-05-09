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
import { RatingNormalizationQueueService } from '../services/ratingNormalizationQueueService.mjs';

function createService(overrides = {}) {
  const db = {
    query: jest.fn(),
  };
  const ratingNormalizer = {
    getNeedsNormalizationSQL: jest.fn().mockReturnValue('content_rating IS NOT NULL'),
  };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    db,
    ratingNormalizer,
    logger,
    service: new RatingNormalizationQueueService({
      db,
      ratingNormalizer,
      logger,
      ...overrides,
    }),
  };
}

describe('RatingNormalizationQueueService', () => {
  it('returns route-ready normalization stats from focused count queries', async () => {
    const { db, service } = createService();
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '4' }] })
      .mockResolvedValueOnce({ rows: [{ count: '8' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    await expect(service.getStats()).resolves.toEqual({
      needsNormalization: 4,
      alreadyNormalized: 8,
      queuedTasks: 2,
      failedTasks: 1,
    });

    expect(db.query).toHaveBeenCalledTimes(4);
  });

  it('queues backfill rows with the partial active-task conflict target', async () => {
    const { db, service } = createService();
    db.query.mockResolvedValueOnce({ rowCount: 3 });

    await expect(service.queueBackfill({ limit: 1000 })).resolves.toEqual({ queued: 3 });

    const [sql, params] = db.query.mock.calls[0];
    expect(params).toEqual(['rating_normalization']);
    expect(sql).toMatch(/INSERT INTO task_queue/);
    expect(sql).toMatch(/LIMIT 1000/);
    expect(sql).toMatch(/ON CONFLICT \(task_type, \(payload->>'media_item_id'\)\) WHERE status IN \('pending', 'processing'\) DO NOTHING/);
    expect(sql).not.toMatch(/^\s*ON CONFLICT DO NOTHING/m);
  });

  it('skips startup queueing when nothing needs normalization', async () => {
    const { db, service } = createService();
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

    await expect(service.queueStartupBackfill()).resolves.toEqual({
      queued: 0,
      totalNeedingNormalization: 0,
    });

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('limits startup queueing while preserving the total needing normalization count', async () => {
    const { db, logger, service } = createService();
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1200' }] })
      .mockResolvedValueOnce({ rowCount: 1000 });

    await expect(service.queueStartupBackfill()).resolves.toEqual({
      queued: 1000,
      totalNeedingNormalization: 1200,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Auto-queuing first 1000 items for rating normalization (1200 total need normalization)'
    );
  });

  it('logs and contains daily queue failures', async () => {
    const { db, logger, service } = createService();
    const error = new Error('database unavailable');
    db.query.mockRejectedValueOnce(error);

    const result = await service.queueDailyBackfill();

    expect(result).toEqual({
      queued: 0,
      totalNeedingNormalization: 0,
      error,
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Daily normalization check failed',
      { error: 'database unavailable' }
    );
  });
});
