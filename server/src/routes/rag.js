/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const embeddingService = require('../services/embeddingService');
const embeddingRouter = require('../services/embeddingRouter');
const ragRetriever = require('../services/ragRetriever');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RAG API');

/**
 * GET /api/rag/status
 * Get RAG status and statistics
 */
router.get('/status', async (req, res) => {
    try {
        const config = await embeddingRouter.getConfig();
        const stats = await embeddingService.getStats();
        const circuitStatus = embeddingRouter.getCircuitStatus();
        const hasMinimum = await embeddingService.hasMinimumEmbeddings();

        res.json({
            enabled: config?.rag_enabled || false,
            provider: config?.embedding_provider || 'auto',
            model: config?.embedding_model || null,
            stats: stats || { total: 0, stale: 0, pendingRetries: 0 },
            circuitBreaker: circuitStatus,
            hasMinimumEmbeddings: hasMinimum,
            minimumRequired: config?.rag_min_history_count || 50
        });
    } catch (error) {
        logger.error('Failed to get RAG status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/models
 * Get recommended embedding models
 */
router.get('/models', async (req, res) => {
    try {
        const models = embeddingRouter.getRecommendedModels();
        res.json(models);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/test
 * Test embedding generation
 */
router.post('/test', async (req, res) => {
    try {
        const { text } = req.body;
        const testText = text || 'Test embedding for Classifarr';

        const startTime = Date.now();
        const result = await embeddingRouter.embed(testText);
        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            provider: result.provider,
            model: result.model,
            dims: result.dims,
            cost: result.cost,
            elapsedMs: elapsed
        });
    } catch (error) {
        logger.error('Embedding test failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/rag/backfill/start
 * Start backfilling embeddings for existing classifications
 */
router.post('/backfill/start', async (req, res) => {
    try {
        const { limit = 100 } = req.body;

        // Get classifications without embeddings
        const result = await db.query(`
            SELECT ch.id, ch.title, ch.media_type, ch.library_name, ch.metadata
            FROM classification_history ch
            LEFT JOIN classification_embeddings ce ON ch.id = ce.classification_id
            WHERE ce.id IS NULL
            AND ch.library_id IS NOT NULL
            LIMIT $1
        `, [limit]);

        let processed = 0;
        let failed = 0;

        for (const row of result.rows) {
            try {
                const metadata = typeof row.metadata === 'string'
                    ? JSON.parse(row.metadata)
                    : row.metadata;

                await embeddingService.generateAndStore(row.id, {
                    ...metadata,
                    title: row.title,
                    media_type: row.media_type,
                    library_name: row.library_name
                });
                processed++;
            } catch (error) {
                failed++;
            }
        }

        res.json({
            success: true,
            processed,
            failed,
            remaining: result.rows.length - processed
        });
    } catch (error) {
        logger.error('Backfill failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/rag/costs
 * Get embedding cost summary
 */
router.get('/costs', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                provider,
                SUM(tokens) as total_tokens,
                SUM(items_embedded) as total_items,
                SUM(cost_usd) as total_cost
            FROM embedding_costs
            WHERE period_start >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY provider
        `);

        res.json({
            last30Days: result.rows.map(r => ({
                provider: r.provider,
                tokens: parseInt(r.total_tokens) || 0,
                items: parseInt(r.total_items) || 0,
                cost: parseFloat(r.total_cost) || 0
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
