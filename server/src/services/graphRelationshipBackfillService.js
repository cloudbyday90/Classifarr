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

'use strict';

/**
 * graphRelationshipBackfillService
 *
 * Called once at startup to automatically backfill graph relationship columns
 * (director_name, primary_studio_name, genre_names, cast_ids, cast_names) for
 * classification_history rows written before Issue 286 (v0.43.7) deployed.
 *
 * New rows are populated inline at write-time by classification.js and
 * queueService.js — this service only fires for pre-existing rows.
 *
 * Two passes (both run non-blocking in the background):
 *   Pass 1 — metadata extraction, no API calls, completes in seconds.
 *   Pass 2 — TMDB director lookup, rate-limited; only runs when TMDB_API_KEY
 *             is set. Skipped silently if no key is available.
 *
 * Both passes are fully idempotent (use COALESCE / IS NULL guards) so it is
 * safe to restart the server mid-backfill or run multiple times.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('GraphRelationshipBackfill');

// Simple guards to prevent double-starting if checkAndBackfill is called twice.
let pass1Running = false;
let pass2Running = false;

/**
 * Check whether any rows need backfilling and start the relevant passes in the
 * background (non-blocking). Safe to fire-and-forget from startup code.
 */
async function checkAndBackfill() {
    // --- Pass 1: cast/studio/genre from stored metadata (no external calls) ---
    try {
        const { rows: p1 } = await db.query(
            `SELECT COUNT(*) AS cnt
             FROM classification_history
             WHERE (cast_ids IS NULL OR primary_studio_name IS NULL OR genre_names IS NULL)
               AND metadata IS NOT NULL`
        );
        const p1Count = parseInt(p1[0].cnt, 10);

        if (p1Count > 0 && !pass1Running) {
            logger.info(`Graph relationship backfill: ${p1Count} rows need Pass 1 — starting background job`);
            pass1Running = true;
            const { runPass1 } = require('../scripts/backfillGraphRelationships');
            runPass1()
                .then(() => logger.info('Graph relationship backfill Pass 1 complete'))
                .catch(err => logger.error('Graph relationship backfill Pass 1 failed', { error: err.message }))
                .finally(() => { pass1Running = false; });
        }
    } catch (err) {
        logger.warn('Graph relationship backfill Pass 1 check failed', { error: err.message });
    }

    // --- Pass 2: TMDB director lookup (only when API key is available) ---
    const tmdbApiKey = process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN;
    if (!tmdbApiKey) return;   // No key — skip silently

    try {
        const { rows: p2 } = await db.query(
            `SELECT COUNT(*) AS cnt
             FROM classification_history
             WHERE director_name IS NULL
               AND tmdb_id IS NOT NULL`
        );
        const p2Count = parseInt(p2[0].cnt, 10);

        if (p2Count > 0 && !pass2Running) {
            logger.info(`Graph relationship backfill: ${p2Count} rows need Pass 2 (TMDB director) — starting background job`);
            pass2Running = true;
            const { runPass2 } = require('../scripts/backfillGraphRelationships');
            runPass2(tmdbApiKey)
                .then(() => logger.info('Graph relationship backfill Pass 2 complete'))
                .catch(err => logger.error('Graph relationship backfill Pass 2 failed', { error: err.message }))
                .finally(() => { pass2Running = false; });
        }
    } catch (err) {
        logger.warn('Graph relationship backfill Pass 2 check failed', { error: err.message });
    }
}

module.exports = { checkAndBackfill };
