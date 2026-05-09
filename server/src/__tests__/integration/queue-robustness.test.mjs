/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Integration tests for queue robustness fixes:
 *  1. recoverExpiredVisibilityTasks() SQL + in-memory counter compensation
 *  2. Rating normalization queue service dedup (prevents double-queueing on restart)
 *  3. _queryWithTimeout() normal-path execution against a real pool client
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

function createLogger() {
  return logger;
}

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: { createLogger },
  createLogger,
}));

const db = await import('../../config/database.mjs');
const { queueService } = await import('../../services/queueService.mjs');
const { ratingNormalizationQueueService } = await import('../../services/ratingNormalizationQueueService.mjs');
const { queryWithTimeout } = await import('../../utils/queryWithTimeout.mjs');

describe('Queue Robustness Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await db.query('DELETE FROM task_queue');
    await db.query('DELETE FROM classification_history');
    queueService.processing = 0;
    queueService.running = false;
    queueService.aiAvailable = true;
    queueService.lastAiAvailabilityProbeAt = 0;
  });

  describe('recoverExpiredVisibilityTasks()', () => {
    test('resets expired processing rows to pending in the real DB', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority, visible_at)
        VALUES ('classification', 'processing', '{}', 5, NOW() - INTERVAL '1 second')
      `);

      const count = await queueService.recoverExpiredVisibilityTasks();

      expect(logger.warn).toHaveBeenCalledWith(
        'Recovered tasks with expired visibility timeout; decremented processing counter',
        expect.objectContaining({ count: 1 })
      );
      expect(count).toBe(1);

      const row = await db.query(
        'SELECT status, started_at, visible_at FROM task_queue LIMIT 1'
      );
      expect(row.rows[0].status).toBe('pending');
      expect(row.rows[0].started_at).toBeNull();
      expect(row.rows[0].visible_at).toBeNull();
    });

    test('does NOT reset processing rows whose visible_at is still in the future', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority, visible_at)
        VALUES ('classification', 'processing', '{}', 5, NOW() + INTERVAL '10 minutes')
      `);

      const count = await queueService.recoverExpiredVisibilityTasks();

      expect(count).toBe(0);

      const row = await db.query('SELECT status FROM task_queue LIMIT 1');
      expect(row.rows[0].status).toBe('processing');
    });

    test('decrements this.processing by the recovered count against a real DB', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority, visible_at)
        VALUES
          ('classification', 'processing', '{}', 5, NOW() - INTERVAL '1 second'),
          ('classification', 'processing', '{}', 5, NOW() - INTERVAL '2 seconds'),
          ('classification', 'processing', '{}', 5, NOW() + INTERVAL '5 minutes')
      `);

      queueService.processing = 3;

      const count = await queueService.recoverExpiredVisibilityTasks();

      expect(logger.warn).toHaveBeenCalledWith(
        'Recovered tasks with expired visibility timeout; decremented processing counter',
        expect.objectContaining({ count: 2, processingAfter: 1 })
      );
      expect(count).toBe(2);
      expect(queueService.processing).toBe(1);
    });

    test('processing counter never goes below zero', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority, visible_at)
        VALUES
          ('classification', 'processing', '{}', 5, NOW() - INTERVAL '1 second'),
          ('classification', 'processing', '{}', 5, NOW() - INTERVAL '1 second')
      `);

      queueService.processing = 1;

      await queueService.recoverExpiredVisibilityTasks();

      expect(logger.warn).toHaveBeenCalledWith(
        'Recovered tasks with expired visibility timeout; decremented processing counter',
        expect.objectContaining({ count: 2, processingAfter: 0 })
      );
      expect(queueService.processing).toBe(0);
    });

    test('recovery sets error_message to the diagnostic string', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority, visible_at)
        VALUES ('classification', 'processing', '{}', 5, NOW() - INTERVAL '1 second')
      `);

      await queueService.recoverExpiredVisibilityTasks();

      expect(logger.warn).toHaveBeenCalledWith(
        'Recovered tasks with expired visibility timeout; decremented processing counter',
        expect.objectContaining({ count: 1 })
      );

      const row = await db.query('SELECT error_message FROM task_queue LIMIT 1');
      expect(row.rows[0].error_message).toBe('Recovered: visibility timeout expired');
    });
  });

  describe('classification dequeue gating', () => {
    test('does not let awaiting_decision rows block classification dequeue', async () => {
      await db.query(`
        INSERT INTO classification_history (media_type, title, method, status, confidence, metadata)
        VALUES ('movie', 'Needs Review', 'ai_analysis', 'awaiting_decision', 55, '{}'::jsonb)
      `);

      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority)
        VALUES
          ('classification', 'pending', '{"title":"Ready Classification"}', 10),
          ('metadata_enrichment', 'pending', '{"title":"Still Fine"}', 5)
      `);

      const blockers = await queueService.hasClassificationDispatchBlocker();
      const task = await queueService.dequeue({
        excludeClassification: blockers.lookupFailed || blockers.hasProcessingClassification
      });

      expect(task).not.toBeNull();
      expect(blockers.hasProcessingClassification).toBe(false);
      expect(task.task_type).toBe('classification');
    });

    test('returns classification work when only classification work is queued and manual review is pending', async () => {
      await db.query(`
        INSERT INTO classification_history (media_type, title, method, status, confidence, metadata)
        VALUES ('movie', 'Needs Review', 'ai_analysis', 'awaiting_decision', 55, '{}'::jsonb)
      `);

      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority)
        VALUES ('classification', 'pending', '{"title":"Ready Classification"}', 10)
      `);

      const blockers = await queueService.hasClassificationDispatchBlocker();
      const task = await queueService.dequeue({
        excludeClassification: blockers.lookupFailed || blockers.hasProcessingClassification
      });

      expect(task).not.toBeNull();
      expect(task.task_type).toBe('classification');
    });

    test('does not let a stale awaiting_decision row block classification dequeue', async () => {
      await db.query(`
        INSERT INTO classification_history (media_type, title, method, status, confidence, metadata, created_at)
        VALUES ('movie', 'Stale Review', 'ai_analysis', 'awaiting_decision', 55, '{}'::jsonb, NOW() - INTERVAL '8 days')
      `);

      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority)
        VALUES ('classification', 'pending', '{"title":"Ready Classification"}', 10)
      `);

      const blockers = await queueService.hasClassificationDispatchBlocker();
      const task = await queueService.dequeue({
        excludeClassification: blockers.lookupFailed || blockers.hasProcessingClassification
      });

      expect(blockers.hasProcessingClassification).toBe(false);
      expect(task).not.toBeNull();
      expect(task.task_type).toBe('classification');
    });

    test('blocks additional classification dequeue while a classification task is processing', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority, visible_at)
        VALUES
          ('classification', 'processing', '{"title":"In Flight"}', 10, NOW() + INTERVAL '5 minutes'),
          ('classification', 'pending', '{"title":"Queued Classification"}', 9, NULL),
          ('metadata_enrichment', 'pending', '{"title":"Background Enrichment"}', 1, NULL)
      `);

      queueService._blockerCacheExpiresAt = 0;
      const blockers = await queueService.hasClassificationDispatchBlocker();
      const task = await queueService.dequeue({
        excludeClassification: blockers.lookupFailed || blockers.hasProcessingClassification
      });

      expect(blockers.hasProcessingClassification).toBe(true);
      expect(task).not.toBeNull();
      expect(task.task_type).toBe('metadata_enrichment');
    });

    test('worker-level dispatch excludes classification while AI is unavailable and a recent probe exists', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority)
        VALUES
          ('classification', 'pending', '{"title":"Classification Waiting"}', 10),
          ('metadata_enrichment', 'pending', '{"title":"Enrichment Ready","itemId":123}', 5)
      `);

      queueService.aiAvailable = false;
      queueService.lastAiAvailabilityProbeAt = Date.now();

      const processTaskSpy = jest.spyOn(queueService, 'processTask').mockResolvedValue(undefined);
      const checkAIAvailabilitySpy = jest.spyOn(queueService, 'checkAIAvailability');

      const dispatched = await queueService.queueWorkerLoopService.maybeDispatchTask();
      await new Promise((resolve) => setImmediate(resolve));

      expect(dispatched).toBe(true);
      expect(checkAIAvailabilitySpy).not.toHaveBeenCalled();
      expect(processTaskSpy).toHaveBeenCalledWith(
        expect.objectContaining({ task_type: 'metadata_enrichment' })
      );

      const rows = await db.query(`
        SELECT task_type, status
        FROM task_queue
        ORDER BY CASE task_type
          WHEN 'classification' THEN 1
          WHEN 'metadata_enrichment' THEN 2
          ELSE 3
        END
      `);

      expect(rows.rows).toEqual([
        expect.objectContaining({ task_type: 'classification', status: 'pending' }),
        expect.objectContaining({ task_type: 'metadata_enrichment', status: 'processing' }),
      ]);
    });
  });

  describe('rating normalization queue service deduplication', () => {
    let serverId;
    let libraryId;

    beforeAll(async () => {
      const serverResult = await db.query(`
        INSERT INTO media_server (name, type, url, api_key)
        VALUES ('Robustness Test Server', 'plex', 'http://localhost:32400', 'testtoken')
        RETURNING id
      `);
      serverId = serverResult.rows[0].id;

      const libResult = await db.query(`
        INSERT INTO libraries (name, media_type, media_server_id, external_id)
        VALUES ('Robustness Lib', 'movie', $1, 'robust_ext1')
        RETURNING id
      `, [serverId]);
      libraryId = libResult.rows[0].id;
    });

    afterAll(async () => {
      await db.query('DELETE FROM media_server_items WHERE media_server_id = $1', [serverId]);
      await db.query('DELETE FROM libraries WHERE id = $1', [libraryId]);
      await db.query('DELETE FROM media_server WHERE id = $1', [serverId]);
    });

    beforeEach(async () => {
      await db.query('DELETE FROM task_queue');
      await db.query('DELETE FROM media_server_items WHERE media_server_id = $1', [serverId]);
    });

    test('queues items that have no existing pending/processing tasks', async () => {
      await db.query(`
        INSERT INTO media_server_items (media_server_id, library_id, external_id, title, media_type, content_rating, original_rating)
        VALUES
          ($1, $2, 'ri1', 'Film A', 'movie', '13', NULL),
          ($1, $2, 'ri2', 'Film B', 'movie', '16', NULL)
      `, [serverId, libraryId]);

      await ratingNormalizationQueueService.queueStartupBackfill();

      const result = await db.query('SELECT COUNT(*) FROM task_queue WHERE task_type = \'rating_normalization\'');
      expect(Number.parseInt(result.rows[0].count, 10)).toBe(2);
    });

    test('does NOT create duplicate tasks when pending tasks already exist', async () => {
      const itemResult = await db.query(`
        INSERT INTO media_server_items (media_server_id, library_id, external_id, title, media_type, content_rating, original_rating)
        VALUES ($1, $2, 'ri3', 'Film C', 'movie', '13', NULL)
        RETURNING id
      `, [serverId, libraryId]);
      const itemId = itemResult.rows[0].id;

      await db.query(`
        INSERT INTO task_queue (task_type, priority, payload, status)
        VALUES ('rating_normalization', 5, jsonb_build_object('media_item_id', $1::bigint), 'pending')
      `, [itemId]);

      await ratingNormalizationQueueService.queueStartupBackfill();

      const result = await db.query('SELECT COUNT(*) FROM task_queue WHERE task_type = \'rating_normalization\'');
      expect(Number.parseInt(result.rows[0].count, 10)).toBe(1);
    });

    test('does NOT create duplicate tasks when a processing task already exists', async () => {
      const itemResult = await db.query(`
        INSERT INTO media_server_items (media_server_id, library_id, external_id, title, media_type, content_rating, original_rating)
        VALUES ($1, $2, 'ri4', 'Film D', 'movie', '16', NULL)
        RETURNING id
      `, [serverId, libraryId]);
      const itemId = itemResult.rows[0].id;

      await db.query(`
        INSERT INTO task_queue (task_type, priority, payload, status, visible_at)
        VALUES ('rating_normalization', 5, jsonb_build_object('media_item_id', $1::bigint), 'processing', NOW() + INTERVAL '5 minutes')
      `, [itemId]);

      await ratingNormalizationQueueService.queueStartupBackfill();

      const result = await db.query('SELECT COUNT(*) FROM task_queue WHERE task_type = \'rating_normalization\'');
      expect(Number.parseInt(result.rows[0].count, 10)).toBe(1);
    });

    test('does re-queue items whose previous task is in a terminal state', async () => {
      const itemResult = await db.query(`
        INSERT INTO media_server_items (media_server_id, library_id, external_id, title, media_type, content_rating, original_rating)
        VALUES ($1, $2, 'ri5', 'Film E', 'movie', '13', NULL)
        RETURNING id
      `, [serverId, libraryId]);
      const itemId = itemResult.rows[0].id;

      await db.query(`
        INSERT INTO task_queue (task_type, priority, payload, status)
        VALUES ('rating_normalization', 5, jsonb_build_object('media_item_id', $1::bigint), 'failed')
      `, [itemId]);

      await ratingNormalizationQueueService.queueStartupBackfill();

      const result = await db.query(`
        SELECT status, COUNT(*) FROM task_queue
        WHERE task_type = 'rating_normalization'
        GROUP BY status ORDER BY status
      `);
      const byStatus = Object.fromEntries(result.rows.map((row) => [row.status, Number.parseInt(row.count, 10)]));
      expect(byStatus.failed).toBe(1);
      expect(byStatus.pending).toBe(1);
    });
  });

  describe('queryWithTimeout()', () => {
    test('executes a write query and returns the result via a real pool client', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload, priority)
        VALUES ('classification', 'pending', '{}', 5)
      `);

      const before = await db.query('SELECT COUNT(*) FROM task_queue');
      expect(Number.parseInt(before.rows[0].count, 10)).toBe(1);

      const result = await queryWithTimeout(
        db,
        'UPDATE task_queue SET priority = 10 WHERE task_type = \'classification\' RETURNING id',
        []
      );

      expect(result.rowCount).toBe(1);

      const after = await db.query('SELECT priority FROM task_queue LIMIT 1');
      expect(Number.parseInt(after.rows[0].priority, 10)).toBe(10);
    });

    test('rolls back and re-throws when the query itself errors', async () => {
      await expect(
        queryWithTimeout(
          db,
          'UPDATE nonexistent_table_xyz SET col = 1 WHERE id = 1',
          []
        )
      ).rejects.toThrow();
    });
  });
});
