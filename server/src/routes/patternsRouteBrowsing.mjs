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
import { parseFloatParam, parseIntParam } from './patternsRouteHelpers.mjs';

export function registerBrowsingRoutes(router, { db, patternReinforcementService }) {
  router.get('/summary', asyncHandler(async (req, res) => {
    const result = await db.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'discovered') as discovered,
            COUNT(*) FILTER (WHERE status = 'approved') as approved,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
            COUNT(*) FILTER (WHERE status = 'decayed') as decayed,
            AVG(confidence) as avg_confidence,
            SUM(sample_size) as total_samples
        FROM discovered_patterns
    `);

    const conflictResult = await db.query(`
        SELECT COUNT(*) as conflicts
        FROM (
            SELECT pattern_type, pattern_value
            FROM discovered_patterns
            WHERE status IN ('discovered', 'approved')
            GROUP BY pattern_type, pattern_value
            HAVING COUNT(*) > 1
        ) conflicts
    `);

    const typeResult = await db.query(`
        SELECT 
            pattern_type,
            COUNT(*) as count,
            AVG(confidence) as avg_confidence
        FROM discovered_patterns
        WHERE status IN ('discovered', 'approved')
        GROUP BY pattern_type
        ORDER BY count DESC
    `);

    const summary = {
      ...result.rows[0],
      conflicts: Number.parseInt(conflictResult.rows[0].conflicts, 10),
      by_type: typeResult.rows,
    };

    res.json(summary);
  }));

  router.get('/cost-summary', asyncHandler(async (req, res) => {
    const result = await db.query(`
        SELECT 
            COUNT(*) FILTER (WHERE method IN ('ai_verified', 'ai_analysis')) as calls_made,
            COUNT(*) FILTER (WHERE method IN ('learned_pattern', 'rule_match', 'exact_match', 'custom_rule')) as calls_avoided
        FROM classification_history
        WHERE created_at >= DATE_TRUNC('month', NOW())
    `);
    
    const data = result.rows[0];
    const callsMade = Number.parseInt(data.calls_made || 0, 10);
    const callsAvoided = Number.parseInt(data.calls_avoided || 0, 10);
    const totalCalls = callsMade + callsAvoided;
    const savingsPercent = totalCalls > 0 
        ? Math.round((callsAvoided / totalCalls) * 100) 
        : 0;
    
    res.json({
      callsMade,
      callsAvoided,
      savingsPercent,
      totalCalls,
    });
  }));

  router.get('/library/:libraryId', asyncHandler(async (req, res) => {
    const libraryId = parseIntParam(req.params.libraryId, null, 1);
    if (libraryId === null) {
      throw new ValidationError('Invalid library ID');
    }

    const result = await db.query(`
        SELECT 
            dp.*,
            l.name as library_name,
            COUNT(pml.id) as match_count
        FROM discovered_patterns dp
        LEFT JOIN libraries l ON l.id = dp.library_id
        LEFT JOIN pattern_match_log pml ON pml.pattern_id = dp.id
        WHERE dp.library_id = $1
        GROUP BY dp.id, l.name
        ORDER BY dp.confidence DESC, dp.created_at DESC
    `, [libraryId]);

    res.json({ patterns: result.rows });
  }));

  router.get('/', asyncHandler(async (req, res) => {
    const {
      status,
      type,
      libraryId,
      min_confidence,
      search,
      page = 1,
      per_page = 30,
    } = req.query;

    const validatedPage = parseIntParam(page, 1, 1);
    const validatedPerPage = parseIntParam(per_page, 30, 1, 100);
    
    let validatedMinConfidence = null;
    if (min_confidence !== undefined && min_confidence !== '') {
      validatedMinConfidence = parseFloatParam(min_confidence, null, 0, 100);
      if (validatedMinConfidence === null) {
        throw new ValidationError('min_confidence must be a number between 0 and 100');
      }
    }

    let validatedLibraryId = null;
    if (libraryId !== undefined && libraryId !== '') {
      validatedLibraryId = parseIntParam(libraryId, null, 1);
      if (validatedLibraryId === null) {
        throw new ValidationError('libraryId must be a valid integer');
      }
    }

    let query = `
        SELECT 
            dp.*,
            l.name as library_name,
            COUNT(pml.id) as match_count
        FROM discovered_patterns dp
        LEFT JOIN libraries l ON l.id = dp.library_id
        LEFT JOIN pattern_match_log pml ON pml.pattern_id = dp.id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND dp.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      query += ` AND dp.pattern_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (validatedLibraryId !== null) {
      query += ` AND dp.library_id = $${paramIndex}`;
      params.push(validatedLibraryId);
      paramIndex++;
    }

    if (validatedMinConfidence !== null) {
      query += ` AND dp.confidence >= $${paramIndex}`;
      params.push(validatedMinConfidence);
      paramIndex++;
    }

    if (search) {
      query += ` AND dp.pattern_value ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += `
        GROUP BY dp.id, l.name
        ORDER BY dp.confidence DESC, dp.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(validatedPerPage);
    params.push((validatedPage - 1) * validatedPerPage);

    const result = await db.query(query, params);

    let countQuery = 'SELECT COUNT(DISTINCT dp.id) FROM discovered_patterns dp WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND dp.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    if (type) {
      countQuery += ` AND dp.pattern_type = $${countParamIndex}`;
      countParams.push(type);
      countParamIndex++;
    }
    if (validatedLibraryId !== null) {
      countQuery += ` AND dp.library_id = $${countParamIndex}`;
      countParams.push(validatedLibraryId);
      countParamIndex++;
    }
    if (validatedMinConfidence !== null) {
      countQuery += ` AND dp.confidence >= $${countParamIndex}`;
      countParams.push(validatedMinConfidence);
      countParamIndex++;
    }
    if (search) {
      countQuery += ` AND dp.pattern_value ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await db.query(countQuery, countParams);
    const total = Number.parseInt(countResult.rows[0].count, 10);

    res.json({
      patterns: result.rows,
      pagination: {
        page: validatedPage,
        per_page: validatedPerPage,
        total,
        total_pages: Math.ceil(total / validatedPerPage),
      },
    });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, null, 1);
    if (id === null) {
      throw new ValidationError('Invalid pattern ID');
    }

    const patternResult = await db.query(`
        SELECT 
            dp.*,
            l.name as library_name
        FROM discovered_patterns dp
        LEFT JOIN libraries l ON l.id = dp.library_id
        WHERE dp.id = $1
    `, [id]);

    if (patternResult.rows.length === 0) {
      throw new NotFoundError('Pattern not found');
    }

    const pattern = patternResult.rows[0];
    const accuracy = await patternReinforcementService.getPatternAccuracy(id);
    const historyResult = await db.query(`
        SELECT 
            pml.*,
            ch.title,
            ch.library_name,
            ch.created_at as classification_date
        FROM pattern_match_log pml
        JOIN classification_history ch ON ch.id = pml.classification_id
        WHERE pml.pattern_id = $1
        ORDER BY pml.created_at DESC
        LIMIT 20
    `, [id]);

    res.json({
      pattern,
      accuracy,
      recent_matches: historyResult.rows,
    });
  }));
}
