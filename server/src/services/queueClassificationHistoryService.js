/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

class QueueClassificationHistoryService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
    }

    async libraryExists(libraryId) {
        const result = await this.db.query(
            `SELECT 1 FROM libraries WHERE id = $1 LIMIT 1`,
            [libraryId]
        );
        return result.rows.length > 0;
    }

    async historyEntryExists(tmdbId, title, libraryId) {
        if (tmdbId) {
            const result = await this.db.query(
                `SELECT 1 FROM classification_history 
                 WHERE tmdb_id = $1 AND library_id = $2 AND method = 'source_library' LIMIT 1`,
                [tmdbId, libraryId]
            );
            return result.rows.length > 0;
        }

        const result = await this.db.query(
            `SELECT 1 FROM classification_history 
             WHERE title = $1 AND library_id = $2 AND method = 'source_library' AND tmdb_id IS NULL LIMIT 1`,
            [title, libraryId]
        );
        return result.rows.length > 0;
    }

    buildReason(tmdbId, sourceLibraryName) {
        return tmdbId
            ? `Already in library: ${sourceLibraryName}`
            : `Already in library: ${sourceLibraryName} (no TMDB match)`;
    }

    async insertHistoryEntry(payload, tmdbId, sourceLibraryId, sourceLibraryName) {
        const ragGraphExtractor = require('./ragGraphExtractor');
        const graphRel = ragGraphExtractor.extract(payload);

        await this.db.query(
            `INSERT INTO classification_history (
                tmdb_id, media_type, title, year, library_id, status, 
                confidence, method, reason, metadata,
                director_name, primary_studio_name, genre_names, cast_ids, cast_names
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                tmdbId || null,
                payload.media?.media_type || 'movie',
                payload.title,
                payload.year,
                sourceLibraryId,
                'completed',
                100,
                'source_library',
                this.buildReason(tmdbId, sourceLibraryName),
                JSON.stringify(payload),
                graphRel.director_name,
                graphRel.primary_studio_name,
                graphRel.genre_names,
                graphRel.cast_ids,
                graphRel.cast_names
            ]
        );
    }

    async persist(payload, tmdbId, sourceLibraryId, sourceLibraryName, taskId) {
        if (!sourceLibraryId) {
            return;
        }

        const exists = await this.libraryExists(sourceLibraryId);
        if (!exists) {
            this.logger.warn('Library deleted during task processing, skipping classification_history insert', {
                libraryId: sourceLibraryId,
                taskId,
                title: payload.title
            });
            return;
        }

        const duplicateExists = await this.historyEntryExists(tmdbId, payload.title, sourceLibraryId);
        if (duplicateExists) {
            return;
        }

        await this.insertHistoryEntry(payload, tmdbId, sourceLibraryId, sourceLibraryName);
    }
}

module.exports = { QueueClassificationHistoryService };
