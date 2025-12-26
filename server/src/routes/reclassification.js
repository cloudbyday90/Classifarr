/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const express = require('express');
const reclassificationBatchService = require('../services/reclassificationBatchService');

const router = express.Router();

/**
 * @swagger
 * /api/reclassification/batch:
 *   post:
 *     summary: Create a new reclassification batch
 *     description: Create a batch of items to reclassify with optional pause-on-error
 */
router.post('/batch', async (req, res) => {
    try {
        const { items, pauseOnError = true, createdBy = 'user' } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'items array is required and must not be empty',
                expected: '[{ classificationId: number, targetLibraryId: number }, ...]'
            });
        }

        const batch = await reclassificationBatchService.createBatch(items, { pauseOnError, createdBy });
        res.status(201).json(batch);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/validate:
 *   post:
 *     summary: Validate a batch before execution
 *     description: Runs pre-flight checks on all items
 */
router.post('/batch/:id/validate', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reclassificationBatchService.validateBatch(parseInt(id));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/execute:
 *   post:
 *     summary: Execute a validated batch
 *     description: Starts executing the reclassification batch
 */
router.post('/batch/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reclassificationBatchService.executeBatch(parseInt(id));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/pause:
 *   post:
 *     summary: Pause a running batch
 */
router.post('/batch/:id/pause', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reclassificationBatchService.pauseBatch(parseInt(id));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/resume:
 *   post:
 *     summary: Resume a paused batch
 */
router.post('/batch/:id/resume', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reclassificationBatchService.resumeBatch(parseInt(id));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/cancel:
 *   post:
 *     summary: Cancel a batch and remaining items
 */
router.post('/batch/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reclassificationBatchService.cancelBatch(parseInt(id));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/item/{itemId}/skip:
 *   post:
 *     summary: Skip a failed item and continue
 */
router.post('/batch/:id/item/:itemId/skip', async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const result = await reclassificationBatchService.skipItem(parseInt(id), parseInt(itemId));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/item/{itemId}/retry:
 *   post:
 *     summary: Retry a failed item
 */
router.post('/batch/:id/item/:itemId/retry', async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const result = await reclassificationBatchService.retryItem(parseInt(id), parseInt(itemId));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}:
 *   get:
 *     summary: Get full batch status with all items
 */
router.get('/batch/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reclassificationBatchService.getBatchStatus(parseInt(id));
        res.json(result);
    } catch (error) {
        if (error.message === 'Batch not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batch/{id}/progress:
 *   get:
 *     summary: Get batch progress (lightweight for polling)
 */
router.get('/batch/:id/progress', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reclassificationBatchService.getBatchProgress(parseInt(id));
        res.json(result);
    } catch (error) {
        if (error.message === 'Batch not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/reclassification/batches:
 *   get:
 *     summary: List recent batches
 */
router.get('/batches', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const result = await reclassificationBatchService.listBatches(limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
