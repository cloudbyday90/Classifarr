/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createRatingNormalizationRouter({
  express,
  db,
  logger,
  ratingNormalizer,
  libraryProfileService,
}) {
  const router = express.Router();

  router.get('/stats', async (_req, res) => {
    try {
      const needsSQL = await ratingNormalizer.getNeedsNormalizationSQL();

      const needsNormalization = await db.query(`
        SELECT COUNT(*) as count FROM media_server_items
        WHERE original_rating IS NULL
          AND content_rating IS NOT NULL
          AND ${needsSQL}
      `);

      const alreadyNormalized = await db.query(`
        SELECT COUNT(*) as count FROM media_server_items WHERE original_rating IS NOT NULL
      `);

      const queuedTasks = await db.query(`
        SELECT COUNT(*) as count FROM task_queue
        WHERE task_type = 'rating_normalization' AND status IN ('pending', 'processing')
      `);

      const failedTasks = await db.query(`
        SELECT COUNT(*) as count FROM task_queue
        WHERE task_type = 'rating_normalization' AND status = 'failed'
      `);

      return res.json({
        needsNormalization: Number.parseInt(needsNormalization.rows[0].count, 10),
        alreadyNormalized: Number.parseInt(alreadyNormalized.rows[0].count, 10),
        queuedTasks: Number.parseInt(queuedTasks.rows[0].count, 10),
        failedTasks: Number.parseInt(failedTasks.rows[0].count, 10),
      });
    } catch (error) {
      logger.error('Failed to get stats', { error: error.message });
      return res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  router.post('/backfill', async (_req, res) => {
    try {
      const needsSQL = await ratingNormalizer.getNeedsNormalizationSQL();

      const result = await db.query(`
        INSERT INTO task_queue (task_type, priority, payload, status)
        SELECT 'rating_normalization', 5, jsonb_build_object('media_item_id', id), 'pending'
        FROM media_server_items
        WHERE original_rating IS NULL
          AND content_rating IS NOT NULL
          AND ${needsSQL}
        ON CONFLICT DO NOTHING
        RETURNING id
      `);

      logger.info('Backfill started', { queued: result.rowCount });
      return res.json({ success: true, queued: result.rowCount });
    } catch (error) {
      logger.error('Backfill failed', { error: error.message });
      return res.status(500).json({ error: 'Failed to start backfill' });
    }
  });

  router.post('/finalize', async (_req, res) => {
    try {
      const pendingResult = await db.query(`
        SELECT COUNT(*) as count FROM task_queue
        WHERE task_type = 'rating_normalization' AND status IN ('pending', 'processing')
      `);

      const pendingCount = Number.parseInt(pendingResult.rows[0].count, 10);

      if (pendingCount > 0) {
        return res.json({
          success: false,
          message: `Still processing ${pendingCount} items.`,
          pending: pendingCount,
        });
      }

      await libraryProfileService.generateAllProfiles();

      logger.info('Normalization complete, profiles regenerated');
      return res.json({ success: true, message: 'Profiles regenerated.' });
    } catch (error) {
      logger.error('Finalize failed', { error: error.message });
      return res.status(500).json({ error: 'Failed to finalize' });
    }
  });

  return router;
}
