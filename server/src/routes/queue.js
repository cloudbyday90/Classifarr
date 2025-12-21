/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Queue management API routes
 */

const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('QueueRoutes');

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

module.exports = router;
