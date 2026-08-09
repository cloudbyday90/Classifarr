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

const historyIdentitySql = (alias) => `
  CASE
    WHEN ${alias}.tmdb_id IS NOT NULL
      THEN 'tmdb:' || ${alias}.media_type || ':' || ${alias}.tmdb_id::text
    ELSE
      'title:' || ${alias}.media_type || ':' || LOWER(TRIM(${alias}.title)) || ':' || COALESCE(${alias}.year::text, '')
  END
`;

const historyOutcomePrioritySql = (alias) => `
  CASE
    WHEN ${alias}.method != 'source_library'
      AND ${alias}.status IN ('completed', 'corrected', 'verified', 'routed') THEN 0
    WHEN ${alias}.method != 'source_library'
      AND ${alias}.status IN ('awaiting_decision', 'pending', 'pending_retry') THEN 1
    WHEN ${alias}.method != 'source_library' THEN 2
    ELSE 3
  END
`;

const canonicalHistoryCte = `
  WITH canonical_ids AS (
    SELECT DISTINCT ON (${historyIdentitySql('source_row')})
      source_row.id,
      ${historyIdentitySql('source_row')} AS history_identity
    FROM classification_history source_row
    ORDER BY
      ${historyIdentitySql('source_row')},
      ${historyOutcomePrioritySql('source_row')},
      source_row.created_at DESC,
      source_row.id DESC
  ),
  canonical_history AS (
    SELECT
      source_row.*,
      canonical_ids.history_identity
    FROM canonical_ids
    JOIN classification_history source_row ON source_row.id = canonical_ids.id
  )
`;

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
      ${canonicalHistoryCte},
      filtered_history AS (
        SELECT
          ch.*,
          COALESCE(l.name, ch.library_name) AS resolved_library_name
        FROM canonical_history ch
        LEFT JOIN libraries l ON ch.library_id = l.id
        ${whereClause}
      ),
      paged_history AS (
        SELECT
          filtered_history.*,
          COUNT(*) OVER() AS total_count
        FROM filtered_history
        ORDER BY created_at DESC, id DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      ),
      paged_identities AS (
        SELECT history_identity, id AS final_id
        FROM paged_history
      ),
      lifecycle_events AS (
        SELECT
          ${historyIdentitySql('event')} AS history_identity,
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', event.id,
              'method', event.method,
              'status', event.status,
              'confidence', event.confidence,
              'library_id', event.library_id,
              'library_name', COALESCE(event_library.name, event.library_name),
              'reason', event.reason,
              'created_at', event.created_at,
              'is_final', event.id = page_identity.final_id,
              'outcome', event.metadata->'classification_details'->'outcome_link'
            )
            ORDER BY event.created_at ASC, event.id ASC
          ) AS history_events,
          COUNT(*)::int AS history_event_count
        FROM classification_history event
        JOIN paged_identities page_identity
          ON page_identity.history_identity = ${historyIdentitySql('event')}
        LEFT JOIN libraries event_library ON event.library_id = event_library.id
        GROUP BY ${historyIdentitySql('event')}, page_identity.final_id
      )
      SELECT
        ch.*,
        ch.resolved_library_name AS library_name,
        (SELECT COUNT(*) FROM classification_corrections WHERE classification_id = ch.id) as correction_count,
        lifecycle.history_events,
        lifecycle.history_event_count
      FROM paged_history ch
      LEFT JOIN lifecycle_events lifecycle ON lifecycle.history_identity = ch.history_identity
      ORDER BY ch.created_at DESC, ch.id DESC
    `;

    params.push(normalizedLimit, offset);
    const result = await db.query(query, params);

    let total;
    if (result.rows.length > 0) {
      total = parseInt(result.rows[0].total_count);
    } else {
      const countQuery = `
        ${canonicalHistoryCte}
        SELECT COUNT(*) AS count
        FROM canonical_history ch
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, filterParams);
      total = parseInt(countResult.rows[0].count);
    }

    res.json({
      data: result.rows.map((row) => {
        const {
          total_count: _totalCount,
          history_identity: _historyIdentity,
          outcome_rank: _outcomeRank,
          resolved_library_name: _resolvedLibraryName,
          ...rest
        } = row;
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
