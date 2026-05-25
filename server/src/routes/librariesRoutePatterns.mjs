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
import { ValidationError } from '../utils/appError.mjs';

export function registerPatternRoutes(router, { db, mediaPatternAnalyzer, requireReadWrite, logger }) {
  router.get('/:id/rule-suggestions/:contentType', asyncHandler(async (req, res) => {
      const { id, contentType } = req.params;

      logger.info('Fetching media server pattern suggestions', { libraryId: id, contentType });

      const result = await mediaPatternAnalyzer.analyzeGroup(parseInt(id), contentType);

      res.json(result);
  }));

  router.get('/:id/available-patterns', asyncHandler(async (req, res) => {
      const { id } = req.params;

      logger.info('Fetching available patterns from library metadata', { libraryId: id });

      const result = await mediaPatternAnalyzer.analyzeLibrary(parseInt(id));

      res.json(result);
  }));

  router.post('/:id/dismiss-suggestions', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;

      await db.query(
        `UPDATE library_pattern_suggestions 
       SET notification_dismissed = true, updated_at = NOW() 
       WHERE library_id = $1`,
        [id]
      );

      res.json({ success: true });
  }));

  router.post('/:id/refresh-patterns', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;

      logger.info('Refreshing patterns for library', { libraryId: id });

      const result = await mediaPatternAnalyzer.analyzeLibrary(parseInt(id));

      await db.query(
        `INSERT INTO library_pattern_suggestions (library_id, detected_patterns, pending_count, last_analyzed, notification_dismissed, updated_at)
       VALUES ($1, $2, $3, NOW(), false, NOW())
       ON CONFLICT (library_id) 
       DO UPDATE SET 
         detected_patterns = $2, 
         pending_count = $3, 
         last_analyzed = NOW(),
         notification_dismissed = false,
         updated_at = NOW()`,
        [id, JSON.stringify(result.patterns), result.patterns.length]
      );

      res.json(result);
  }));

  router.get('/:id/dismissed-patterns', asyncHandler(async (req, res) => {
      const { id } = req.params;

      const result = await db.query(
        `SELECT id, pattern_type, pattern_value, dismissed_at 
       FROM dismissed_patterns 
       WHERE library_id = $1 
       ORDER BY dismissed_at DESC`,
        [id]
      );

      res.json(result.rows);
  }));

  router.post('/:id/dismiss-pattern', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { patternType, patternValue } = req.body;

      if (!patternType || !patternValue) {
        throw new ValidationError('patternType and patternValue are required');
      }

      await db.query(
        `INSERT INTO dismissed_patterns (library_id, pattern_type, pattern_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (library_id, pattern_type, pattern_value) DO NOTHING`,
        [id, patternType, patternValue]
      );

      await db.query(
        `UPDATE library_pattern_suggestions 
       SET pending_count = GREATEST(pending_count - 1, 0), updated_at = NOW()
       WHERE library_id = $1`,
        [id]
      );

      res.json({ success: true, message: 'Pattern dismissed' });
  }));

  router.post('/:id/restore-pattern', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { patternType, patternValue } = req.body;

      if (!patternType || !patternValue) {
        throw new ValidationError('patternType and patternValue are required');
      }

      await db.query(
        `DELETE FROM dismissed_patterns 
       WHERE library_id = $1 AND pattern_type = $2 AND pattern_value = $3`,
        [id, patternType, patternValue]
      );

      await db.query(
        `UPDATE library_pattern_suggestions 
       SET pending_count = pending_count + 1, updated_at = NOW()
       WHERE library_id = $1`,
        [id]
      );

      res.json({ success: true, message: 'Pattern restored' });
  }));
}
