/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Queue management API routes
 */

const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');
const ollamaService = require('../services/ollama');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('QueueRoutes');

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
        const [queueStats, gapStats] = await Promise.all([
            queueService.getStats(),
            queueService.getGapAnalysisStats()
        ]);

        // Get today's classification count (excluding source_library enrichments)
        const todayResult = await db.query(`
            SELECT COUNT(*) as count, AVG(confidence) as avg_confidence
            FROM classification_history 
            WHERE created_at >= CURRENT_DATE
              AND method != 'source_library'
        `);

        // Get enrichment progress stats
        const enrichmentResult = await db.query(`
            SELECT 
                COUNT(*) as total_items,
                COUNT(*) FILTER (WHERE metadata->'omdb' IS NOT NULL OR metadata->'tavily_imdb' IS NOT NULL OR metadata->'tavily_advisory' IS NOT NULL) as enriched,
                COUNT(*) FILTER (WHERE metadata->'tavily_imdb' IS NOT NULL OR metadata->'tavily_advisory' IS NOT NULL) as tavily_enriched,
                COUNT(*) FILTER (WHERE metadata->'omdb' IS NOT NULL) as omdb_enriched
            FROM media_server_items
        `);

        const totalItems = parseInt(enrichmentResult.rows[0]?.total_items) || 0;
        const enrichedItems = parseInt(enrichmentResult.rows[0]?.enriched) || 0;
        const tavilyEnrichedItems = parseInt(enrichmentResult.rows[0]?.tavily_enriched) || 0;
        const omdbEnrichedItems = parseInt(enrichmentResult.rows[0]?.omdb_enriched) || 0;
        const enrichmentProgress = totalItems > 0 ? Math.round((enrichedItems / totalItems) * 100) : 0;

        const classifiedToday = parseInt(todayResult.rows[0]?.count) || 0;
        const avgConfidence = parseFloat(todayResult.rows[0]?.avg_confidence) || 0;

        res.json({
            queue: queueStats,
            gapAnalysis: gapStats,
            today: {
                classified: classifiedToday,
                avgConfidence: Math.round(avgConfidence)
            },
            enrichment: {
                totalItems,
                enriched: enrichedItems,
                tavilyEnriched: tavilyEnrichedItems,
                omdbEnriched: omdbEnrichedItems,
                progress: enrichmentProgress
            },
            health: {
                ollama: queueStats?.ollamaAvailable ?? false,
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
router.post('/task/:id/retry', async (req, res) => {
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
router.post('/task/:id/cancel', async (req, res) => {
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
router.post('/clear-completed', async (req, res) => {
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
router.post('/clear-failed', async (req, res) => {
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
router.post('/retry-all-failed', async (req, res) => {
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
router.post('/cancel-all-pending', async (req, res) => {
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
router.post('/reprocess-completed', async (req, res) => {
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
router.post('/clear-and-resync', async (req, res) => {
    try {
        const result = await queueService.clearAndResync();
        logger.info('Cleared queue and triggered resync', result);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Failed to clear and resync', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
