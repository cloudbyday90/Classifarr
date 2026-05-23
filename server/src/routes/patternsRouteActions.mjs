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
import { ValidationError, NotFoundError } from '../utils/appError.mjs';
import { parseIntParam } from './patternsRouteHelpers.mjs';

export function registerActionRoutes(router, { db, patternMiningService, patternReinforcementService, logger }) {
  router.post('/resolve-conflicts', asyncHandler(async (req, res) => {
    const result = await patternReinforcementService.resolveConflicts();
    logger.info('Conflicts resolved', result);
    res.json(result);
  }));

  router.post('/discover', asyncHandler(async (req, res) => {
    const result = await patternMiningService.discoverPatterns();
    logger.info('Pattern discovery triggered', result);
    res.json(result);
  }));

  router.post('/discover/:libraryId', asyncHandler(async (req, res) => {
    const libraryId = parseIntParam(req.params.libraryId, null, 1);
    if (libraryId === null) {
      throw new ValidationError('Invalid library ID');
    }

    const result = await patternMiningService.discoverPatterns({ libraryId });
    logger.info('Library-specific pattern discovery triggered', { libraryId, result });
    res.json(result);
  }));

  router.put('/:id/approve', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
      throw new ValidationError('Invalid pattern ID');
    }

    const { approved_by = 'user' } = req.body;

    const result = await db.query(`
        UPDATE discovered_patterns
        SET 
            status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [approved_by, id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Pattern not found');
    }

    logger.info('Pattern approved', { id, approved_by });
    res.json(result.rows[0]);
  }));

  router.put('/:id/reject', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
      throw new ValidationError('Invalid pattern ID');
    }

    const { rejected_by = 'user', rejection_reason } = req.body;

    const result = await db.query(`
        UPDATE discovered_patterns
        SET 
            status = 'rejected',
            rejected_by = $1,
            rejected_at = NOW(),
            rejection_reason = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `, [rejected_by, rejection_reason, id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Pattern not found');
    }

    logger.info('Pattern rejected', { id, rejected_by, reason: rejection_reason });
    res.json(result.rows[0]);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
      throw new ValidationError('Invalid pattern ID');
    }

    const result = await db.query(`
        DELETE FROM discovered_patterns
        WHERE id = $1
        RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Pattern not found');
    }

    logger.info('Pattern deleted', { id });
    res.json({ success: true, pattern: result.rows[0] });
  }));
}
