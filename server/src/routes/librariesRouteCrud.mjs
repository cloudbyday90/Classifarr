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

export function registerCrudRoutes(router, { db }) {
    router.get('/', asyncHandler(async (req, res) => {
        const result = await db.query(`
        SELECT
          l.*,
          COALESCE(msi.item_count, 0)::int AS item_count,
          l.item_count::int AS stored_item_count,
          ms.name as media_server_name,
          ms.type as media_server_type
        FROM libraries l
        LEFT JOIN (
          SELECT library_id, COUNT(*)::int AS item_count
          FROM media_server_items
          GROUP BY library_id
        ) msi ON msi.library_id = l.id
        LEFT JOIN media_server ms ON l.media_server_id = ms.id
        ORDER BY l.priority DESC, l.name ASC
      `);
        res.json(result.rows);
    }));

    router.get('/pending-suggestions', asyncHandler(async (req, res) => {
        const query = `
        SELECT 
          lps.library_id,
          l.name as library_name,
          lps.pending_count,
          lps.detected_patterns,
          lps.last_analyzed
        FROM library_pattern_suggestions lps
        INNER JOIN libraries l ON l.id = lps.library_id
        WHERE lps.pending_count > 0 
          AND lps.notification_dismissed = false
        ORDER BY lps.pending_count DESC
      `;

        const result = await db.query(query);

        res.json({
            totalPending: result.rows.reduce((sum, r) => sum + r.pending_count, 0),
            libraries: result.rows,
        });
    }));

    router.get('/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await db.query(
            `
        SELECT l.*, 
          (SELECT COUNT(*)::int FROM media_server_items WHERE library_id = l.id) as item_count,
          (
            SELECT json_build_object(
              'status', status,
              'items_processed', items_processed,
              'items_total', items_total
            )
            FROM media_server_sync_status 
            WHERE library_id = l.id 
            ORDER BY created_at DESC 
            LIMIT 1
          ) as sync_status
        FROM libraries l 
        WHERE l.id = $1
      `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Library not found' });
        }

        res.json(result.rows[0]);
    }));

    router.put('/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { name, priority, arr_type, arr_id, root_folder, quality_profile_id, is_active } = req.body;

        const result = await db.query(
            `UPDATE libraries 
           SET name = COALESCE($1, name),
               priority = COALESCE($2, priority),
               arr_type = COALESCE($3, arr_type),
               arr_id = COALESCE($4, arr_id),
               root_folder = COALESCE($5, root_folder),
               quality_profile_id = COALESCE($6, quality_profile_id),
               is_active = COALESCE($7, is_active),
               updated_at = NOW()
           WHERE id = $8
           RETURNING *`,
            [name, priority, arr_type, arr_id, root_folder, quality_profile_id, is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Library not found' });
        }

        res.json(result.rows[0]);
    }));
}
