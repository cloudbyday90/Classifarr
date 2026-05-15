/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

export function createRatingNormalizationRouter({
  express,
  ratingNormalizationQueueService,
  libraryProfileService,
}) {
  const router = express.Router();

  router.get('/stats', asyncHandler(async (_req, res) => {
    const stats = await ratingNormalizationQueueService.getStats();
    return sendData(res, stats);
  }));

  router.post('/backfill', asyncHandler(async (_req, res) => {
    const result = await ratingNormalizationQueueService.queueBackfill();
    return res.json({ success: true, queued: result.queued });
  }));

  router.post('/finalize', asyncHandler(async (_req, res) => {
    const pendingCount = await ratingNormalizationQueueService.countQueuedTasks();

    if (pendingCount > 0) {
      return res.json({
        success: false,
        message: `Still processing ${pendingCount} items.`,
        pending: pendingCount,
      });
    }

    await libraryProfileService.generateAllProfiles();

    return res.json({ success: true, message: 'Profiles regenerated.' });
  }));

  return router;
}
