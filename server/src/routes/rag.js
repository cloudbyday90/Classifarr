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
const embeddingMigrationService = require('../services/embeddingMigrationService');
const patternMiningService = require('../services/patternMiningService');
const ragLogger = require('../utils/ragLogger');
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

/**
 * GET /api/rag/health
 * Get RAG health summary with recent errors
 */
router.get('/health', async (req, res) => {
    try {
        const healthSummary = await ragLogger.getHealthSummary();
        const recentErrors = await ragLogger.getRecentErrors(10);

        res.json({
            health: healthSummary,
            recentErrors
        });
    } catch (error) {
        logger.error('Failed to get RAG health', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/metrics
 * Get detailed metrics by operation type
 */
router.get('/metrics', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        
        const operations = ['semantic_search', 'hybrid_search', 'embedding_generation', 'pattern_mining'];
        const metrics = {};

        for (const operation of operations) {
            metrics[operation] = await ragLogger.getMetricsByOperation(operation, parseInt(hours));
        }

        res.json(metrics);
    } catch (error) {
        logger.error('Failed to get RAG metrics', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/errors
 * Get RAG error log
 */
router.get('/errors', async (req, res) => {
    try {
        const { limit = 50, operation } = req.query;
        
        const errors = await ragLogger.getRecentErrors(
            parseInt(limit),
            operation || null
        );

        res.json({ errors });
    } catch (error) {
        logger.error('Failed to get RAG errors', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/migration/status
 * Get migration progress status
 */
router.get('/migration/status', async (req, res) => {
    try {
        const progress = embeddingMigrationService.getProgress();
        res.json(progress);
    } catch (error) {
        logger.error('Failed to get migration status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/migration/start
 * Manually trigger embedding migration
 */
router.post('/migration/start', async (req, res) => {
    try {
        const { markAllStale = false } = req.body;

        if (markAllStale) {
            await embeddingMigrationService.markAllForReembedding();
        }

        // Start in background
        embeddingMigrationService.startBackgroundMigration().catch(error => {
            logger.error('Background migration error', { error: error.message });
        });

        res.json({
            success: true,
            message: 'Migration started in background',
            progress: embeddingMigrationService.getProgress()
        });
    } catch (error) {
        logger.error('Failed to start migration', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/patterns
 * Get discovered patterns
 */
router.get('/patterns', async (req, res) => {
    try {
        const { libraryId, status = 'approved' } = req.query;

        let query = `
            SELECT * FROM discovered_patterns
            WHERE status = $1
        `;
        const params = [status];

        if (libraryId) {
            query += ' AND library_id = $2';
            params.push(parseInt(libraryId));
        }

        query += ' ORDER BY confidence DESC, support_count DESC LIMIT 100';

        const result = await db.query(query, params);

        res.json({
            patterns: result.rows,
            summary: await patternMiningService.getPatternsSummary()
        });
    } catch (error) {
        logger.error('Failed to get patterns', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/patterns/discover
 * Trigger pattern discovery
 */
router.post('/patterns/discover', async (req, res) => {
    try {
        const result = await patternMiningService.discoverPatterns();
        res.json(result);
    } catch (error) {
        logger.error('Pattern discovery failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/rag/patterns/:id/approve
 * Approve a discovered pattern
 */
router.put('/patterns/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { approvedBy = 'user' } = req.body;

        const result = await db.query(`
            UPDATE discovered_patterns
            SET status = 'approved',
                approved_by = $1,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [approvedBy, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pattern not found' });
        }

        res.json({ pattern: result.rows[0] });
    } catch (error) {
        logger.error('Failed to approve pattern', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/rag/patterns/:id/reject
 * Reject a discovered pattern
 */
router.put('/patterns/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectedBy = 'user', reason = '' } = req.body;

        const result = await db.query(`
            UPDATE discovered_patterns
            SET status = 'rejected',
                rejected_by = $1,
                rejected_at = NOW(),
                rejection_reason = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [rejectedBy, reason, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pattern not found' });
        }

        res.json({ pattern: result.rows[0] });
    } catch (error) {
        logger.error('Failed to reject pattern', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
