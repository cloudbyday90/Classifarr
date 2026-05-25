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
import { NotFoundError } from '../utils/appError.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';

export function registerHistoryRoutes(router, { db }) {
  router.get('/history', asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      media_type,
      library_id,
      method,
      excludeMethod,
      search,
      date_from,
      date_to,
    } = req.query;

    const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offset = (normalizedPage - 1) * normalizedLimit;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (media_type) {
      whereConditions.push(`ch.media_type = $${paramIndex}`);
      params.push(media_type);
      paramIndex++;
    }

    if (library_id) {
      whereConditions.push(`ch.library_id = $${paramIndex}`);
      params.push(library_id);
      paramIndex++;
    }

    if (method) {
      whereConditions.push(`ch.method = $${paramIndex}`);
      params.push(method);
      paramIndex++;
    }

    if (excludeMethod) {
      whereConditions.push(`ch.method != $${paramIndex}`);
      params.push(excludeMethod);
      paramIndex++;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      whereConditions.push(`ch.title ILIKE $${paramIndex}`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (date_from) {
      whereConditions.push(`ch.created_at >= $${paramIndex}`);
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`ch.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
      params.push(date_to);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const filterParams = [...params];

    const query = `
      SELECT 
        ch.*,
        l.name as library_name,
        (SELECT COUNT(*) FROM classification_corrections WHERE classification_id = ch.id) as correction_count,
        COUNT(*) OVER() AS total_count
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      ${whereClause}
      ORDER BY ch.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(normalizedLimit, offset);
    const result = await db.query(query, params);

    let total;
    if (result.rows.length > 0) {
      total = parseInt(result.rows[0].total_count);
    } else {
      const countQuery = `
        SELECT COUNT(*) AS count
        FROM classification_history ch
        LEFT JOIN libraries l ON ch.library_id = l.id
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, filterParams);
      total = parseInt(countResult.rows[0].count);
    }

    res.json({
      data: result.rows.map((row) => {
        const { total_count: _totalCount, ...rest } = row;
        return rest;
      }),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    });
  }));

  router.get('/history/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await db.query(
      `
      SELECT 
        ch.*, 
        l.name as library_name,
        l.media_type as library_media_type
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      WHERE ch.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Classification not found');
    }

    const corrections = await db.query(
      `
      SELECT 
        cc.*,
        l.name as corrected_library_name
      FROM classification_corrections cc
      LEFT JOIN libraries l ON cc.corrected_library_id = l.id
      WHERE cc.classification_id = $1
      ORDER BY cc.created_at DESC
    `,
      [id]
    );

    res.json({
      ...result.rows[0],
      corrections: corrections.rows,
    });
  }));

  router.get('/history/:id/profile', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await db.query('SELECT profile_snapshot FROM classification_history WHERE id = $1', [id]);
    const row = result.rows[0];

    if (!row) {
      throw new NotFoundError('Classification not found');
    }

    const profileSnapshot = row.profile_snapshot;
    if (!profileSnapshot) {
      throw new NotFoundError('Classification has no stored profile snapshot');
    }

    res.json(profileSnapshot);
  }));

  router.get('/stats', asyncHandler(async (_req, res) => {
    const totalResult = await db.query("SELECT COUNT(*) as total FROM classification_history WHERE method != 'source_library'");
    const methodResult = await db.query(
      `
      SELECT method, COUNT(*) as count
      FROM classification_history
      GROUP BY method
      ORDER BY count DESC
    `
    );
    const libraryResult = await db.query(
      `
      SELECT l.name, COUNT(*) as count
      FROM classification_history ch
      JOIN libraries l ON ch.library_id = l.id
      GROUP BY l.id, l.name
      ORDER BY count DESC
      LIMIT 10
    `
    );
    const confidenceResult = await db.query(
      `
      SELECT method, AVG(confidence) as avg_confidence
      FROM classification_history
      WHERE confidence IS NOT NULL
      GROUP BY method
    `
    );
    const activityResult = await db.query(
      `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM classification_history
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `
    );

    res.json({
      total: parseInt(totalResult.rows[0].total),
      byMethod: methodResult.rows,
      byLibrary: libraryResult.rows,
      avgConfidence: confidenceResult.rows,
      recentActivity: activityResult.rows,
    });
  }));

  router.get('/live-feed', asyncHandler(async (req, res) => {
    const limit = parseIntParam(req.query.limit, 50, 1);

    const result = await db.query(
      `
      SELECT 
        ch.id,
        ch.title,
        ch.media_type,
        ch.method,
        ch.confidence,
        ch.created_at,
        l.name as library_name
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      WHERE ch.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY ch.created_at DESC
      LIMIT $1
    `,
      [limit]
    );

    res.json({
      items: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        mediaType: row.media_type,
        method: row.method,
        confidence: row.confidence,
        library: row.library_name,
        timestamp: row.created_at,
      })),
      timestamp: new Date().toISOString(),
    });
  }));
}
