/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import defaultDb from '../config/database.mjs';
import defaultClassificationService from './classification.mjs';
import classificationEvidenceService from './classificationEvidenceService.mjs';
import ragGraphExtractor from './ragGraphExtractor.mjs';
import { parsePayload as sharedParsePayload } from '../utils/queueHelpers.mjs';

class QueueAdminService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger;
        this.classificationService = deps.classificationService || defaultClassificationService;
        this.ragGraphExtractor = deps.ragGraphExtractor || ragGraphExtractor;
        this.evidenceService = deps.evidenceService || classificationEvidenceService;
    }

    async manualClassifyTask(taskId, libraryId, resolvedBy = 'admin') {
        return this.db.withTransaction(async (client) => {
            const taskResult = await client.query(
                'SELECT * FROM task_queue WHERE id = $1 FOR UPDATE',
                [taskId]
            );

            if (taskResult.rows.length === 0) {
                return { success: false, code: 'task_not_found' };
            }

            const task = taskResult.rows[0];
            if (task.task_type !== 'classification') {
                return {
                    success: false,
                    code: 'invalid_task_type',
                    taskType: task.task_type,
                };
            }

            if (task.status !== 'pending') {
                return {
                    success: false,
                    code: 'invalid_state',
                    currentStatus: task.status,
                };
            }

            const libraryResult = await client.query(
                'SELECT * FROM libraries WHERE id = $1',
                [libraryId]
            );

            if (libraryResult.rows.length === 0) {
                return { success: false, code: 'library_not_found' };
            }

            const library = libraryResult.rows[0];
            const payload = this.parsePayload(task.payload);
            const metadata = payload.media || payload.metadata || payload;
            const title = metadata.title || payload.title || 'Unknown';
            const year = metadata.year || payload.year || null;
            const tmdbId = metadata.tmdb_id || payload.tmdb_id || null;
            const mediaType = metadata.media_type || library.media_type || 'movie';
            const graphRel = this.ragGraphExtractor.extract(metadata);

            await this.classificationService.routeToArr(metadata, library);

            const insertResult = await client.query(
                `INSERT INTO classification_history
                 (tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status, director_name, primary_studio_name, genre_names, cast_ids, cast_names)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 RETURNING id`,
                [
                    tmdbId,
                    mediaType,
                    title,
                    year,
                    libraryId,
                    library.name,
                    100,
                    'manual_classification',
                    `Manually classified by ${resolvedBy}`,
                    JSON.stringify(metadata),
                    'completed',
                    graphRel.director_name,
                    graphRel.primary_studio_name,
                    graphRel.genre_names,
                    graphRel.cast_ids,
                    graphRel.cast_names,
                ]
            );

            await client.query(
                `UPDATE task_queue
                 SET status = 'completed', completed_at = NOW()
                 WHERE id = $1`,
                [taskId]
            );

            if (tmdbId) {
                await this.evidenceService.rememberExactMatch({
                    tmdbId,
                    mediaType,
                    libraryId,
                    payload: { title, resolved_by: resolvedBy },
                    createdBy: resolvedBy,
                    client,
                    payloadColumn: 'metadata',
                    conflictMode: 'update_metadata'
                });
            }

            const classificationId = insertResult.rows[0].id;
            this.logger.info('Manually classified task', {
                taskId,
                classificationId,
                libraryId,
                title,
            });

            return {
                success: true,
                classificationId,
                libraryId,
                libraryName: library.name,
                message: `Classified "${title}" to ${library.name}`,
            };
        });
    }

    parsePayload(payload) {
        return sharedParsePayload(payload);
    }
}

export { QueueAdminService };
export default { QueueAdminService };
