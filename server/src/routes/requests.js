/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Manual request submission routes
 */

const express = require('express');
const router = express.Router();
const tmdbService = require('../services/tmdb');
const queueService = require('../services/queueService');
const classificationService = require('../services/classification');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RequestsRoutes');

/**
 * @swagger
 * /api/requests/search:
 *   get:
 *     summary: Search TMDB for movies and TV shows
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [multi, movie, tv]
 */
router.get('/search', async (req, res) => {
    try {
        const { q, type = 'multi' } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }

        const results = await tmdbService.search(q.trim(), type);
        res.json(results);
    } catch (error) {
        logger.error('TMDB search failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/requests/submit:
 *   post:
 *     summary: Submit a manual classification request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tmdbId
 *               - mediaType
 *             properties:
 *               tmdbId:
 *                 type: integer
 *               mediaType:
 *                 type: string
 *                 enum: [movie, tv]
 */
router.post('/submit', async (req, res) => {
    try {
        const { tmdbId, mediaType, title } = req.body;

        if (!tmdbId || !mediaType) {
            return res.status(400).json({ error: 'tmdbId and mediaType are required' });
        }

        if (!['movie', 'tv'].includes(mediaType)) {
            return res.status(400).json({ error: 'mediaType must be movie or tv' });
        }

        // Get details from TMDB
        const details = mediaType === 'movie'
            ? await tmdbService.getMovieDetails(tmdbId)
            : await tmdbService.getTVDetails(tmdbId);

        // Create a synthetic webhook payload for the classification engine
        const payload = {
            notification_type: 'MANUAL_REQUEST',
            media: {
                media_type: mediaType,
                tmdbId: tmdbId,
                tvdbId: details.external_ids?.tvdb_id || null,
            },
            subject: title || details.title || details.name,
            request: {
                request_id: `manual-${Date.now()}`
            }
        };

        // Log the manual request
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
                'queued'
            ]
        );

        const logId = logResult.rows[0].id;

        // Enqueue for classification
        const taskId = await queueService.enqueue('classification', payload, {
            webhookLogId: logId,
            source: 'manual',
            priority: 2  // Higher priority than webhooks
        });

        logger.info('Manual request submitted', {
            tmdbId,
            mediaType,
            title: title || details.title || details.name,
            taskId
        });

        res.status(202).json({
            success: true,
            queued: true,
            taskId,
            logId,
            title: title || details.title || details.name,
            message: 'Request queued for classification'
        });
    } catch (error) {
        logger.error('Manual request failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/requests/recent:
 *   get:
 *     summary: Get recent manual requests
 */
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const result = await db.query(
            `SELECT id, media_title, media_type, tmdb_id, processing_status, 
              routed_to_library, received_at, processing_time_ms
       FROM webhook_log
       WHERE webhook_type = 'manual'
       ORDER BY received_at DESC
       LIMIT $1`,
            [limit]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to get recent requests', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
