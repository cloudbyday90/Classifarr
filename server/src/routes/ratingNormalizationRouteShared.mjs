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
  logger,
  ratingNormalizationQueueService,
  libraryProfileService,
}) {
  const router = express.Router();

  router.get('/stats', async (_req, res) => {
    try {
      const stats = await ratingNormalizationQueueService.getStats();
      return res.json(stats);
    } catch (error) {
      logger.error('Failed to get stats', { error: error.message });
      return res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  router.post('/backfill', async (_req, res) => {
    try {
      const result = await ratingNormalizationQueueService.queueBackfill();

      logger.info('Backfill started', { queued: result.queued });
      return res.json({ success: true, queued: result.queued });
    } catch (error) {
      logger.error('Backfill failed', { error: error.message });
      return res.status(500).json({ error: 'Failed to start backfill' });
    }
  });

  router.post('/finalize', async (_req, res) => {
    try {
      const pendingCount = await ratingNormalizationQueueService.countQueuedTasks();

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
