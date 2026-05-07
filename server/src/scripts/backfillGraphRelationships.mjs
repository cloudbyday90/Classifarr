/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Backfill Graph Relationship Columns
 *
 * Issue 286: Populates the five new graph relationship columns
 * (director_name, primary_studio_name, genre_names, cast_ids, cast_names) on existing
 * classification_history rows that were written before Phase 2 deployed.
 *
 * TWO PASSES:
 *
 *   Pass 1 — fast, no network I/O
 *   ─────────────────────────────
 *   Reads rows where (cast_ids IS NULL OR primary_studio_name IS NULL OR genre_names IS NULL)
 *   AND metadata IS NOT NULL. Calls ragGraphExtractor.extract(row.metadata) and writes
 *   cast_ids, cast_names, primary_studio_name, genre_names. Completes in seconds for any
 *   reasonable table size.
 *
 *   Pass 2 — slow, TMDB API calls (director only)
 *   ───────────────────────────────────────────────
 *   Reads rows where director_name IS NULL AND tmdb_id IS NOT NULL. For each row, calls
 *   the TMDB movie or TV endpoint (branched on media_type) to retrieve the director/creator
 *   name and writes director_name.
 *
 *   Rate limit: ≤20 req/s (conservative; TMDB current ceiling ~40 req/s).
 *   HTTP 429 → exponential backoff, up to 3 retries.
 *   Rows where tmdb_id IS NULL remain director_name = null (acceptable).
 *
 * SAFETY PRINCIPLES (ref: stripe.com/blog/online-migrations):
 *   1. Batching: processes 500 rows at a time to limit memory and lock duration.
 *   2. Throttling: sleep between batches / per-request to respect DB and TMDB limits.
 *   3. Outside a transaction: no BEGIN/COMMIT wrapping — rows may be partially updated if
 *      the script is interrupted, but the IS NULL guards make it fully resumable.
 *
 * USAGE:
 *   # Both passes:
 *   node server/src/scripts/backfillGraphRelationships.mjs
 *
 *   # Pass 1 only (fast, no TMDB):
 *   node server/src/scripts/backfillGraphRelationships.mjs --pass1
 *
 *   # Pass 2 only (TMDB director):
 *   node server/src/scripts/backfillGraphRelationships.mjs --pass2
 */

import path from 'node:path';
import * as db from '../config/database.mjs';
import ragGraphExtractor from '../services/ragGraphExtractor.mjs';
import { createLogger } from '../utils/logger.mjs';


const logger = createLogger('BackfillGraphRelationships');

const BATCH_SIZE = 500;
const PASS2_MAX_RPS = 20;
const _PASS2_BATCH_SLEEP_MS = Math.ceil(1000 / PASS2_MAX_RPS) * BATCH_SIZE;
const PASS2_MAX_RETRIES = 3;
const INTER_BATCH_SLEEP_MS = 50;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function backoffMs(attempt) {
    return 1000 * Math.pow(2, attempt);
}

async function fetchTmdbWithRetry(url, tmdbApiKey) {
    for (let attempt = 0; attempt <= PASS2_MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${tmdbApiKey}` }
            });

            if (res.status === 429) {
                if (attempt === PASS2_MAX_RETRIES) {
                    logger.warn('TMDB 429 — max retries exceeded, skipping row', { url, attempt });
                    return null;
                }
                const wait = backoffMs(attempt);
                logger.warn(`TMDB 429 — backing off ${wait}ms`, { url, attempt });
                await sleep(wait);
                continue;
            }

            if (!res.ok) {
                logger.warn('TMDB non-200 response, skipping row', { url, status: res.status });
                return null;
            }

            return await res.json();
        } catch (err) {
            if (attempt === PASS2_MAX_RETRIES) {
                logger.error('TMDB fetch failed — max retries exceeded', { url, error: err.message });
                return null;
            }
            const wait = backoffMs(attempt);
            logger.warn(`TMDB fetch error — retrying in ${wait}ms`, { url, error: err.message, attempt });
            await sleep(wait);
        }
    }
    return null;
}

async function runPass1() {
    logger.info('=== Pass 1: metadata extraction (no API calls) ===');
    let totalProcessed = 0;
    let totalUpdated = 0;
    let offset = 0;

    while (true) {
        const { rows } = await db.query(
            `SELECT id, metadata
             FROM classification_history
             WHERE (cast_ids IS NULL OR primary_studio_name IS NULL OR genre_names IS NULL)
               AND metadata IS NOT NULL
             ORDER BY id
             LIMIT $1 OFFSET $2`,
            [BATCH_SIZE, offset]
        );

        if (rows.length === 0) break;

        let batchUpdated = 0;
        for (const row of rows) {
            let metadata;
            try {
                metadata = typeof row.metadata === 'string'
                    ? JSON.parse(row.metadata)
                    : row.metadata;
            } catch {
                logger.warn('Failed to parse metadata JSON, skipping row', { id: row.id });
                continue;
            }

            const rel = ragGraphExtractor.extract(metadata);

            await db.query(
                `UPDATE classification_history
                 SET primary_studio_name = COALESCE(primary_studio_name, $2),
                     genre_names         = COALESCE(genre_names, $3),
                     cast_ids            = COALESCE(cast_ids, $4),
                     cast_names          = COALESCE(cast_names, $5)
                 WHERE id = $1`,
                [
                    row.id,
                    rel.primary_studio_name,
                    rel.genre_names.length > 0 ? rel.genre_names : null,
                    rel.cast_ids.length > 0 ? rel.cast_ids : null,
                    rel.cast_names.length > 0 ? rel.cast_names : null
                ]
            );
            batchUpdated++;
        }

        totalProcessed += rows.length;
        totalUpdated += batchUpdated;
        logger.info('Pass 1 batch complete', {
            batchSize: rows.length,
            batchUpdated,
            totalProcessed,
            totalUpdated
        });

        if (rows.length < BATCH_SIZE) break;

        offset += BATCH_SIZE;
        await sleep(INTER_BATCH_SLEEP_MS);
    }

    logger.info('=== Pass 1 complete ===', { totalProcessed, totalUpdated });
}

async function runPass2(tmdbApiKey) {
    if (!tmdbApiKey) {
        logger.error('TMDB_API_KEY not set — cannot run Pass 2. Set TMDB_API_KEY environment variable.');
        process.exitCode = 1;
        return;
    }

    logger.info('=== Pass 2: TMDB director backfill ===');
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    while (true) {
        const { rows } = await db.query(
            `SELECT id, tmdb_id, metadata->>'media_type' AS media_type
             FROM classification_history
             WHERE director_name IS NULL
               AND tmdb_id IS NOT NULL
             ORDER BY id
             LIMIT $1`,
            [BATCH_SIZE]
        );

        if (rows.length === 0) break;

        const batchStartMs = Date.now();

        let batchUpdated = 0;
        for (const row of rows) {
            const mediaType = row.media_type;
            if (!mediaType) {
                logger.warn('Row has NULL media_type, skipping director backfill', { id: row.id });
                totalSkipped++;
                continue;
            }

            const TMDB_API_BASE = process.env.TMDB_API_BASE || 'https://api.themoviedb.org/3';
            let url;
            if (mediaType === 'movie') {
                url = `${TMDB_API_BASE}/movie/${row.tmdb_id}?append_to_response=credits`;
            } else {
                url = `${TMDB_API_BASE}/tv/${row.tmdb_id}`;
            }

            const data = await fetchTmdbWithRetry(url, tmdbApiKey);
            if (!data) {
                totalSkipped++;
                continue;
            }

            let directorName = null;
            if (mediaType === 'movie') {
                const director = Array.isArray(data.credits?.crew)
                    ? data.credits.crew.find((crewMember) => crewMember.job === 'Director')
                    : null;
                directorName = director?.name || null;
            } else {
                directorName = Array.isArray(data.created_by) && data.created_by.length > 0
                    ? data.created_by[0].name || null
                    : null;
            }

            if (directorName) {
                directorName = directorName.toLowerCase().trim().slice(0, 255);
            }

            await db.query(
                `UPDATE classification_history SET director_name = $2 WHERE id = $1`,
                [row.id, directorName]
            );
            batchUpdated++;
        }

        totalProcessed += rows.length;
        totalUpdated += batchUpdated;
        logger.info('Pass 2 batch complete', {
            batchSize: rows.length,
            batchUpdated,
            totalSkipped,
            totalProcessed,
            totalUpdated
        });

        if (rows.length < BATCH_SIZE) break;

        const elapsed = Date.now() - batchStartMs;
        const minBatchMs = Math.ceil((BATCH_SIZE / PASS2_MAX_RPS) * 1000);
        if (elapsed < minBatchMs) {
            await sleep(minBatchMs - elapsed);
        }
    }

    logger.info('=== Pass 2 complete ===', { totalProcessed, totalUpdated, totalSkipped });
}

async function main() {
    const args = process.argv.slice(2);
    const pass1Only = args.includes('--pass1');
    const pass2Only = args.includes('--pass2');
    const runBoth = !pass1Only && !pass2Only;

    const tmdbApiKey = process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN;

    try {
        if (runBoth || pass1Only) {
            await runPass1();
        }

        if (runBoth || pass2Only) {
            await runPass2(tmdbApiKey);
        }

        logger.info('Backfill complete');
    } catch (err) {
        logger.error('Backfill failed with unexpected error', { error: err.message, stack: err.stack });
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
    await main();
}

export { runPass1, runPass2 };
