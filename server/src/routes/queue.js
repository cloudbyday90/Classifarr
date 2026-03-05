/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Queue management API routes
 */

const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');
const ollamaService = require('../services/ollama');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const { authenticateTokenOrApiKey, requireReadWrite } = require('../middleware/apiKeyAuth');

const logger = createLogger('QueueRoutes');

// Apply authentication to all queue routes
router.use(authenticateTokenOrApiKey);

/**
 * @swagger
 * /api/queue/ollama-status:
 *   get:
 *     summary: Get current Ollama generation status
 *     responses:
 *       200:
 *         description: Current AI generation status including model, tokens, and item being processed
 */
router.get('/ollama-status', async (req, res) => {
    try {
        const status = ollamaService.getGenerationStatus();
        res.json(status);
    } catch (error) {
        logger.error('Failed to get ollama status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/stats:
 *   get:
 *     summary: Get queue statistics
 *     responses:
 *       200:
 *         description: Queue statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await queueService.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get queue stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/gap-analysis-stats:
 *   get:
 *     summary: Get gap analysis progress stats
 *     responses:
 *       200:
 *         description: Gap analysis statistics including unprocessed items
 */
router.get('/gap-analysis-stats', async (req, res) => {
    try {
        const stats = await queueService.getGapAnalysisStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get gap analysis stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/live-stats:
 *   get:
 *     summary: Get combined live stats for dashboard
 *     responses:
 *       200:
 *         description: Combined queue, gap analysis, and system health stats
 */
router.get('/live-stats', async (req, res) => {
    try {
        const [queueStats, gapStats, todayResult, enrichmentResult, enrichmentQueueResult] = await Promise.all([
            queueService.getStats(),
            queueService.getGapAnalysisStats(),
            // Today's classification counts:
            // - new_classified: excludes source_library (new classifications only - for Dashboard)
            // - all_classified: includes source_library (all activity - for Activity page)
            db.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE method != 'source_library') as new_classified,
                    COUNT(*) as all_classified,
                    AVG(confidence) FILTER (WHERE method != 'source_library') as new_avg_confidence,
                    AVG(confidence) as all_avg_confidence
                FROM classification_history 
                WHERE created_at >= CURRENT_DATE
            `),
            db.query(`
                SELECT 
                    COUNT(*) as total_items,
                    COUNT(*) FILTER (WHERE metadata->'omdb' IS NOT NULL OR metadata->'tavily_imdb' IS NOT NULL OR metadata->'tavily_advisory' IS NOT NULL) as enriched,
                    COUNT(*) FILTER (WHERE metadata->'tavily_imdb' IS NOT NULL OR metadata->'tavily_advisory' IS NOT NULL) as tavily_enriched,
                    COUNT(*) FILTER (WHERE metadata->'omdb' IS NOT NULL) as omdb_enriched
                FROM media_server_items
            `),
            db.query(`
                SELECT COUNT(*) as pending FROM task_queue 
                WHERE task_type = 'metadata_enrichment' AND status = 'pending'
            `)
        ]);
        const enrichmentPending = parseInt(enrichmentQueueResult.rows[0]?.pending) || 0;

        const totalItems = parseInt(enrichmentResult.rows[0]?.total_items) || 0;
        const enrichedItems = parseInt(enrichmentResult.rows[0]?.enriched) || 0;
        const tavilyEnrichedItems = parseInt(enrichmentResult.rows[0]?.tavily_enriched) || 0;
        const omdbEnrichedItems = parseInt(enrichmentResult.rows[0]?.omdb_enriched) || 0;
        const enrichmentProgress = totalItems > 0 ? Math.round((enrichedItems / totalItems) * 100) : 0;

        const newClassifiedToday = parseInt(todayResult.rows[0]?.new_classified) || 0;
        const allClassifiedToday = parseInt(todayResult.rows[0]?.all_classified) || 0;
        const newAvgConfidence = parseFloat(todayResult.rows[0]?.new_avg_confidence) || 0;
        const allAvgConfidence = parseFloat(todayResult.rows[0]?.all_avg_confidence) || 0;

        // Get retry queue stats
        let retryQueueStats = { tavily: { pending: 0 }, total: { pending: 0 } };
        try {
            const enrichmentRetryService = require('../services/enrichmentRetryService');
            retryQueueStats = await enrichmentRetryService.getStats();
        } catch (e) {
            // Retry queue table may not exist yet
        }

        res.json({
            queue: queueStats,
            gapAnalysis: gapStats,
            today: {
                // New classifications only (excludes source_library) - for Dashboard
                classified: newClassifiedToday,
                avgConfidence: Math.round(newAvgConfidence),
                // All activity including enrichments - for Activity page
                allClassified: allClassifiedToday,
                allAvgConfidence: Math.round(allAvgConfidence)
            },
            enrichment: {
                totalItems,
                enriched: enrichedItems,
                tavilyEnriched: tavilyEnrichedItems,
                omdbEnriched: omdbEnrichedItems,
                progress: enrichmentProgress,
                pending: enrichmentPending,
                retryQueue: retryQueueStats
            },
            health: {
                ai: queueStats?.aiAvailable ?? false,
                worker: queueStats?.workerRunning ?? false,
                database: true
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get live stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/pending:
 *   get:
 *     summary: Get pending tasks
 *     responses:
 *       200:
 *         description: List of pending tasks
 */
router.get('/pending', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const tasks = await queueService.getPendingTasks(limit);
        res.json(tasks);
    } catch (error) {
        logger.error('Failed to get pending tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/failed:
 *   get:
 *     summary: Get failed tasks
 *     responses:
 *       200:
 *         description: List of failed tasks
 */
router.get('/failed', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const tasks = await queueService.getFailedTasks(limit);
        res.json(tasks);
    } catch (error) {
        logger.error('Failed to get failed tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/task/{id}/retry:
 *   post:
 *     summary: Retry a failed task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/task/:id/retry', requireReadWrite, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const success = await queueService.retryTask(taskId);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to retry task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/task/{id}/dismiss:
 *   post:
 *     summary: Dismiss a failed task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/task/:id/dismiss', requireReadWrite, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const success = await queueService.dismissFailedTask(taskId);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to dismiss task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/task/{id}/cancel:
 *   post:
 *     summary: Cancel a pending task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/task/:id/cancel', requireReadWrite, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const success = await queueService.cancelTask(taskId);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to cancel task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/clear-completed:
 *   post:
 *     summary: Clear all completed tasks
 */
router.post('/clear-completed', requireReadWrite, async (req, res) => {
    try {
        const count = await queueService.clearCompletedTasks();
        logger.info('Cleared completed tasks', { count });
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Failed to clear completed tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/clear-failed:
 *   post:
 *     summary: Clear all failed tasks
 */
router.post('/clear-failed', requireReadWrite, async (req, res) => {
    try {
        const count = await queueService.clearFailedTasks();
        logger.info('Cleared failed tasks', { count });
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Failed to clear failed tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/retry-all-failed:
 *   post:
 *     summary: Retry all failed tasks
 */
router.post('/retry-all-failed', requireReadWrite, async (req, res) => {
    try {
        const count = await queueService.retryAllFailedTasks();
        logger.info('Queued all failed tasks for retry', { count });
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Failed to retry all tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/cancel-all-pending:
 *   post:
 *     summary: Cancel all pending tasks
 */
router.post('/cancel-all-pending', requireReadWrite, async (req, res) => {
    try {
        const count = await queueService.cancelAllPendingTasks();
        logger.info('Cancelled all pending tasks', { count });
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Failed to cancel all tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/reprocess-completed:
 *   post:
 *     summary: Re-queue all completed classifications for reprocessing
 */
router.post('/reprocess-completed', requireReadWrite, async (req, res) => {
    try {
        const count = await queueService.reprocessCompleted();
        logger.info('Queued completed items for reprocessing', { count });
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Failed to reprocess completed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/clear-and-resync:
 *   post:
 *     summary: Clear all queue data and trigger fresh library sync
 */
router.post('/clear-and-resync', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.clearAndResync();
        logger.info('Cleared queue and triggered resync', result);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Failed to clear and resync', {
            error: error.message,
            code: error.code || null,
            details: error.details || null
        });
        res.status(500).json({
            error: error.message,
            code: error.code || 'CARSA_RESET_FAILED',
            details: error.details || null
        });
    }
});

/**
 * @swagger
 * /api/queue/tasks/{id}/classify:
 *   post:
 *     summary: Manually classify a pending task, bypassing AI
 *     description: Admin can pick a task from the pending queue and assign it to a library directly
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/tasks/:id/classify', requireReadWrite, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const { library_id, resolved_by = 'admin' } = req.body;

        if (!library_id) {
            return res.status(400).json({ error: 'library_id is required' });
        }

        // Get the task details
        const taskResult = await db.query(
            'SELECT * FROM task_queue WHERE id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];
        const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;

        // Get library details
        const libResult = await db.query('SELECT * FROM libraries WHERE id = $1', [library_id]);
        if (libResult.rows.length === 0) {
            return res.status(404).json({ error: 'Library not found' });
        }
        const library = libResult.rows[0];

        // Extract metadata from task payload
        const metadata = payload.media || payload.metadata || payload;
        const title = metadata.title || payload.title || 'Unknown';
        const year = metadata.year || payload.year;
        const tmdbId = metadata.tmdb_id || payload.tmdb_id;
        const mediaType = metadata.media_type || library.media_type || 'movie';

        // Create classification history entry with manual_classification method
        const insertResult = await db.query(
            `INSERT INTO classification_history 
             (tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
                tmdbId,
                mediaType,
                title,
                year,
                library_id,
                library.name,
                100, // Manual = 100% confidence
                'manual_classification',
                `Manually classified by ${resolved_by}`,
                JSON.stringify(metadata),
                'completed'
            ]
        );

        const classificationId = insertResult.rows[0].id;

        // Mark the task as completed
        await db.query(
            `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
            [taskId]
        );

        // Route to Radarr/Sonarr
        const classificationService = require('../services/classification');
        await classificationService.routeToArr(metadata, library);

        // Store learning pattern for this tmdb_id
        if (tmdbId) {
            await db.query(
                `INSERT INTO learning_patterns 
                 (tmdb_id, media_type, library_id, pattern_type, confidence, metadata, created_by)
                 VALUES ($1, $2, $3, 'exact_match', 100, $4, $5)
                 ON CONFLICT (tmdb_id, media_type, pattern_type) 
                 DO UPDATE SET library_id = $3, confidence = 100, metadata = $4, created_by = $5, updated_at = NOW()`,
                [tmdbId, mediaType, library_id, JSON.stringify({ title, resolved_by }), resolved_by]
            );
        }

        logger.info('Manually classified task', { taskId, classificationId, libraryId: library_id, title });

        res.json({
            success: true,
            classificationId,
            libraryId: library_id,
            libraryName: library.name,
            message: `Classified "${title}" to ${library.name}`
        });
    } catch (error) {
        logger.error('Failed to manually classify task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ========== ENRICHMENT RETRY QUEUE ENDPOINTS ==========

/**
 * @swagger
 * /api/queue/retry-stats:
 *   get:
 *     summary: Get enrichment retry queue statistics
 *     responses:
 *       200:
 *         description: Retry queue statistics by type and status
 */
router.get('/retry-stats', async (req, res) => {
    try {
        const enrichmentRetryService = require('../services/enrichmentRetryService');
        const stats = await enrichmentRetryService.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get retry stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/retry-process:
 *   post:
 *     summary: Process pending items in the retry queue
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 50
 *               enrichmentType:
 *                 type: string
 *                 default: tavily
 *     responses:
 *       200:
 *         description: Processing result
 */
router.post('/retry-process', requireReadWrite, async (req, res) => {
    try {
        const { limit = 50, enrichmentType = 'tavily' } = req.body;
        const enrichmentRetryService = require('../services/enrichmentRetryService');
        const result = await enrichmentRetryService.processRetryQueue(limit, enrichmentType);
        res.json(result);
    } catch (error) {
        logger.error('Failed to process retry queue', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/retry-backfill:
 *   post:
 *     summary: Backfill retry queue with items missing OMDb data
 *     responses:
 *       200:
 *         description: Number of items queued
 */
router.post('/retry-backfill', requireReadWrite, async (req, res) => {
    try {
        const enrichmentRetryService = require('../services/enrichmentRetryService');
        const result = await enrichmentRetryService.backfillRetryQueue();
        res.json(result);
    } catch (error) {
        logger.error('Failed to backfill retry queue', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

