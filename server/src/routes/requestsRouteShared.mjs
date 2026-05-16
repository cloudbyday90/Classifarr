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

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess } from '../utils/responseHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('Requests');

export function createRequestsRouter({
  express,
  tmdbService,
  queueService,
  db,
}) {
  const router = express.Router();

  router.get('/search', asyncHandler(async (req, res) => {
    const { q, type = 'multi' } = req.query;

    if (!q || q.trim().length < 2) {
      throw new ValidationError('Query must be at least 2 characters');
    }

    const results = await tmdbService.search(q.trim(), type);
    return sendData(res, results);
  }));

  router.post('/submit', asyncHandler(async (req, res) => {
    const { tmdbId, mediaType, title } = req.body;

    if (!tmdbId || !mediaType) {
      throw new ValidationError('tmdbId and mediaType are required');
    }

    if (!['movie', 'tv'].includes(mediaType)) {
      throw new ValidationError('mediaType must be movie or tv');
    }

    const details = mediaType === 'movie'
      ? await tmdbService.getMovieDetails(tmdbId)
      : await tmdbService.getTVDetails(tmdbId);

    const payload = {
      notification_type: 'MANUAL_REQUEST',
      media: {
        media_type: mediaType,
        tmdbId,
        tvdbId: details.external_ids?.tvdb_id || null,
      },
      subject: title || details.title || details.name,
      request: {
        request_id: `manual-${Date.now()}`,
      },
    };

    const logResult = await db.query(
      `INSERT INTO webhook_log (
        webhook_type, notification_type, event_name, payload,
        media_title, media_type, tmdb_id, processing_status, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id`,
      [
        'manual',
        'MANUAL_REQUEST',
        'Manual Submission',
        JSON.stringify(payload),
        title || details.title || details.name,
        mediaType,
        tmdbId,
        'queued',
      ]
    );

    const logId = logResult.rows[0].id;

    const taskId = await queueService.enqueue('classification', payload, {
      webhookLogId: logId,
      source: 'manual',
      priority: 2,
    });

    logger.info('Manual request submitted', {
      tmdbId,
      mediaType,
      title: title || details.title || details.name,
      taskId,
    });

    return sendSuccess(res, {
      queued: true,
      taskId,
      logId,
      title: title || details.title || details.name,
      message: 'Request queued for classification',
    }, 202);
  }));

  router.get('/recent', asyncHandler(async (req, res) => {
    const limit = Number.parseInt(req.query.limit, 10) || 10;

    const result = await db.query(
      `SELECT id, media_title, media_type, tmdb_id, processing_status, 
              routed_to_library, received_at, processing_time_ms
       FROM webhook_log
       WHERE webhook_type = 'manual'
       ORDER BY received_at DESC
       LIMIT $1`,
      [limit]
    );

    return sendData(res, result.rows);
  }));

  return router;
}
