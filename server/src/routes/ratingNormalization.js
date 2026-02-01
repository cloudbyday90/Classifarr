/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const ratingNormalizer = require('../utils/ratingNormalizer');

const logger = createLogger('RatingNormalizationAPI');

/**
 * GET /api/rating-normalization/stats
 * Get statistics about rating normalization status
 */
router.get('/stats', async (req, res) => {
  try {
    const needsSQL = ratingNormalizer.getNeedsNormalizationSQL();
    
    // Count items needing normalization (age-based or non-standard ratings without original_rating set)
    const needsNormalization = await db.query(`
      SELECT COUNT(*) as count FROM media_server_items
      WHERE original_rating IS NULL
        AND content_rating IS NOT NULL
        AND ${needsSQL}
    `);
    
    // Count items already normalized
    const alreadyNormalized = await db.query(`
      SELECT COUNT(*) as count FROM media_server_items WHERE original_rating IS NOT NULL
    `);
    
    // Count queued tasks
    const queuedTasks = await db.query(`
      SELECT COUNT(*) as count FROM task_queue
      WHERE task_type = 'rating_normalization' AND status IN ('pending', 'processing')
    `);
    
    // Count failed tasks
    const failedTasks = await db.query(`
      SELECT COUNT(*) as count FROM task_queue
      WHERE task_type = 'rating_normalization' AND status = 'failed'
    `);
    
    res.json({
      needsNormalization: parseInt(needsNormalization.rows[0].count),
      alreadyNormalized: parseInt(alreadyNormalized.rows[0].count),
      queuedTasks: parseInt(queuedTasks.rows[0].count),
      failedTasks: parseInt(failedTasks.rows[0].count),
    });
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * POST /api/rating-normalization/backfill
 * Queue all items needing normalization
 */
router.post('/backfill', async (req, res) => {
  try {
    const needsSQL = ratingNormalizer.getNeedsNormalizationSQL();
    
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
    res.json({ success: true, queued: result.rowCount });
  } catch (error) {
    logger.error('Backfill failed', { error: error.message });
    res.status(500).json({ error: 'Failed to start backfill' });
  }
});

/**
 * POST /api/rating-normalization/finalize
 * Check if processing is complete and regenerate library profiles
 */
router.post('/finalize', async (req, res) => {
  try {
    const pendingResult = await db.query(`
      SELECT COUNT(*) as count FROM task_queue
      WHERE task_type = 'rating_normalization' AND status IN ('pending', 'processing')
    `);
    
    const pendingCount = parseInt(pendingResult.rows[0].count);
    
    if (pendingCount > 0) {
      return res.json({
        success: false,
        message: `Still processing ${pendingCount} items.`,
        pending: pendingCount
      });
    }
    
    // Regenerate all library profiles
    const libraryProfileService = require('../services/libraryProfileService');
    await libraryProfileService.generateAllProfiles();
    
    logger.info('Normalization complete, profiles regenerated');
    res.json({ success: true, message: 'Profiles regenerated.' });
  } catch (error) {
    logger.error('Finalize failed', { error: error.message });
    res.status(500).json({ error: 'Failed to finalize' });
  }
});

module.exports = router;
