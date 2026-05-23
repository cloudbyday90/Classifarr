/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { NotFoundError } from '../../utils/appError.mjs';

export async function getPatternsPayload({ db, patternMiningService }, { libraryId, status = 'approved' } = {}) {
    let query = `
        SELECT * FROM discovered_patterns
        WHERE status = $1
    `;
    const params = [status];

    if (libraryId) {
        query += ' AND library_id = $2';
        params.push(parseInt(libraryId, 10));
    }

    query += ' ORDER BY confidence DESC, support_count DESC LIMIT 100';

    const result = await db.query(query, params);

    return {
        patterns: result.rows,
        summary: await patternMiningService.getPatternsSummary()
    };
}

export async function approvePattern({ db }, { id, approvedBy = 'user' }) {
    const result = await db.query(`
        UPDATE discovered_patterns
        SET status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [approvedBy, id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Pattern not found');
    }

    return { pattern: result.rows[0] };
}

export async function rejectPattern({ db }, { id, rejectedBy = 'user', reason = '' }) {
    const result = await db.query(`
        UPDATE discovered_patterns
        SET status = 'rejected',
            rejected_by = $1,
            rejected_at = NOW(),
            rejection_reason = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `, [rejectedBy, reason, id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Pattern not found');
    }

    return { pattern: result.rows[0] };
}

export async function getGraphFillRatePayload({ db }) {
    const result = await db.query(`
        SELECT
            COUNT(*)                                                              AS total,
            COUNT(director_name)                                                  AS has_director,
            COUNT(primary_studio_name)                                            AS has_studio,
            COUNT(genre_names)  FILTER (WHERE array_length(genre_names,  1) > 0) AS has_genres,
            COUNT(cast_ids)     FILTER (WHERE array_length(cast_ids,     1) > 0) AS has_cast,
            COUNT(collection_id)                                                  AS has_collection
        FROM classification_history
        WHERE metadata IS NOT NULL
    `);

    const row = result.rows[0];
    const total = Number(row.total);
    const pct = (n) => total > 0 ? Math.round((Number(n) / total) * 1000) / 10 : null;

    return {
        total,
        has_director: Number(row.has_director),
        has_studio: Number(row.has_studio),
        has_genres: Number(row.has_genres),
        has_cast: Number(row.has_cast),
        has_collection: Number(row.has_collection),
        pct_director: pct(row.has_director),
        pct_studio: pct(row.has_studio),
        pct_genres: pct(row.has_genres),
        pct_cast: pct(row.has_cast),
        pct_collection: pct(row.has_collection)
    };
}
