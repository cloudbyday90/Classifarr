/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getRagResetConfigDefaults } from './ragConfigDefaults.mjs';

export function createRagOperationsHelpers({
    db
}) {
    const DEFAULT_ADVANCED_CONFIG = {
        max_retries: 3,
        retry_delay: 1000,
        request_timeout: 30000,
        cache_enabled: false,
        cache_ttl: 24,
        verbose_logging: false,
        log_embedding_content: false
    };

    const DEFAULT_RETRY_CONFIG = {
        request_timeout: 30000,
        warmup_timeout: 120000,
        max_retries: 3,
        retry_delay: 1000,
        retry_backoff_multiplier: 2,
        jitter_factor: 0.3
    };

    const getLogsPayload = async ({ level, type, limit = 100, offset = 0 } = {}) => {
        let query = 'SELECT * FROM rag_logs WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (level && level !== 'all') {
            query += ` AND level = $${paramCount}`;
            params.push(level);
            paramCount += 1;
        }

        if (type && type !== 'all') {
            query += ` AND type = $${paramCount}`;
            params.push(type);
            paramCount += 1;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const result = await db.query(query, params);
        return { logs: result.rows };
    };

    const clearLogs = async () => {
        await db.query('DELETE FROM rag_logs');
        return { success: true, message: 'Logs cleared' };
    };

    const getAdvancedConfig = async () => {
        const config = await db.query(`
            SELECT
                max_retries, retry_delay, request_timeout,
                cache_enabled, cache_ttl,
                verbose_logging, log_embedding_content
            FROM ai_provider_config WHERE id = 1
        `);

        if (config.rows.length === 0) {
            return { ...DEFAULT_ADVANCED_CONFIG };
        }

        return config.rows[0];
    };

    const updateAdvancedConfig = async (payload = {}) => {
        const {
            max_retries, retry_delay, request_timeout,
            cache_enabled, cache_ttl,
            verbose_logging, log_embedding_content
        } = payload;

        await db.query(`
            UPDATE ai_provider_config SET
                max_retries = $1,
                retry_delay = $2,
                request_timeout = $3,
                cache_enabled = $4,
                cache_ttl = $5,
                verbose_logging = $6,
                log_embedding_content = $7
            WHERE id = 1
        `, [max_retries, retry_delay, request_timeout, cache_enabled, cache_ttl, verbose_logging, log_embedding_content]);

        return { success: true };
    };

    const getRetryConfig = async () => {
        const config = await db.query(`
            SELECT
                request_timeout,
                warmup_timeout,
                max_retries,
                retry_delay,
                retry_backoff_multiplier,
                jitter_factor
            FROM ai_provider_config WHERE id = 1
        `);

        if (config.rows.length === 0) {
            return { ...DEFAULT_RETRY_CONFIG };
        }

        return config.rows[0];
    };

    const validateRetryConfig = (payload = {}) => {
        const {
            request_timeout,
            warmup_timeout,
            max_retries,
            retry_delay,
            retry_backoff_multiplier,
            jitter_factor
        } = payload;

        const errors = [];

        if (request_timeout !== undefined && (request_timeout < 5000 || request_timeout > 300000)) {
            errors.push('request_timeout must be between 5000 and 300000 (5s-300s)');
        }

        if (warmup_timeout !== undefined && (warmup_timeout < 10000 || warmup_timeout > 600000)) {
            errors.push('warmup_timeout must be between 10000 and 600000 (10s-600s)');
        }

        if (max_retries !== undefined && (max_retries < 0 || max_retries > 10)) {
            errors.push('max_retries must be between 0 and 10');
        }

        if (retry_delay !== undefined && (retry_delay < 100 || retry_delay > 10000)) {
            errors.push('retry_delay must be between 100 and 10000 (100ms-10s)');
        }

        if (retry_backoff_multiplier !== undefined && (retry_backoff_multiplier < 1 || retry_backoff_multiplier > 5)) {
            errors.push('retry_backoff_multiplier must be between 1 and 5');
        }

        if (jitter_factor !== undefined && (jitter_factor < 0 || jitter_factor > 1)) {
            errors.push('jitter_factor must be between 0 and 1');
        }

        if (errors.length > 0) {
            const error = new Error('Validation failed');
            error.status = 400;
            error.details = errors;
            throw error;
        }
    };

    const updateRetryConfig = async (payload = {}) => {
        validateRetryConfig(payload);

        const {
            request_timeout,
            warmup_timeout,
            max_retries,
            retry_delay,
            retry_backoff_multiplier,
            jitter_factor
        } = payload;

        await db.query(`
            UPDATE ai_provider_config SET
                request_timeout = $1,
                warmup_timeout = $2,
                max_retries = $3,
                retry_delay = $4,
                retry_backoff_multiplier = $5,
                jitter_factor = $6
            WHERE id = 1
        `, [request_timeout, warmup_timeout, max_retries, retry_delay, retry_backoff_multiplier, jitter_factor]);

        return { success: true };
    };

    const exportConfig = async () => {
        const config = await db.query(`
            SELECT * FROM ai_provider_config WHERE id = 1
        `);

        return config.rows[0] || {};
    };

    const exportLogs = async () => {
        const logs = await db.query(`
            SELECT * FROM rag_logs ORDER BY created_at DESC LIMIT 1000
        `);

        return { logs: logs.rows };
    };

    const exportMetrics = async () => {
        const metrics = await db.query(`
            SELECT * FROM rag_metrics
            WHERE operation = 'embedding_generation'
            ORDER BY period_start DESC
            LIMIT 1000
        `);

        return { metrics: metrics.rows };
    };

    const clearEmbeddings = async () => {
        await db.query('DELETE FROM classification_embeddings');

        await db.query(`
            INSERT INTO rag_logs (level, type, message)
            VALUES ('warning', 'system', 'All embeddings cleared by user')
        `);

        return { success: true, message: 'All embeddings cleared' };
    };

    const reembedImages = async () => {
        const result = await db.query(`
            UPDATE classification_embeddings
            SET image_embedding = NULL,
                image_embedding_dims = NULL,
                image_provider = NULL,
                image_model = NULL,
                image_embedding_hash = NULL,
                image_embedding_size = NULL,
                image_embedding_source_url = NULL,
                updated_at = NOW()
        `);

        await db.query(`
            INSERT INTO rag_logs (level, type, message)
            VALUES ('warning', 'system', 'Image embeddings cleared by user for re-embedding')
        `);

        return { success: true, cleared: result.rowCount };
    };

    const resetConfig = async () => {
        const defaults = getRagResetConfigDefaults();
        await db.query(`
            UPDATE ai_provider_config SET
                embedding_provider_mode = $1,
                embedding_ollama_host = $2,
                embedding_ollama_port = $3,
                embedding_ollama_model = $4,
                embedding_cloud_provider = $5,
                embedding_cloud_api_key = $6,
                embedding_cloud_model = $7,
                image_embedding_provider_mode = $8,
                image_embedding_local_host = $9,
                image_embedding_local_port = $10,
                image_embedding_local_model = $11,
                image_embedding_cloud_provider = $12,
                image_embedding_cloud_api_key = $13,
                image_embedding_cloud_model = $14,
                image_embedding_cloud_api_endpoint = $15,
                realtime_embedding_enabled = $16,
                idle_backfill_enabled = $17,
                idle_threshold = $18,
                idle_batch_size = $19,
                scheduled_backfill_enabled = $20,
                scheduled_backfill_time = $21,
                scheduled_backfill_days = $22,
                scheduled_backfill_batch_size = $23,
                scheduled_backfill_max_duration = $24,
                manual_backfill_batch_size = $25,
                max_retries = $26,
                retry_delay = $27,
                request_timeout = $28,
                cache_enabled = $29,
                cache_ttl = $30,
                verbose_logging = $31,
                log_embedding_content = $32
            WHERE id = 1
        `, [
            defaults.embedding_provider_mode,
            defaults.embedding_ollama_host,
            defaults.embedding_ollama_port,
            defaults.embedding_ollama_model,
            defaults.embedding_cloud_provider,
            defaults.embedding_cloud_api_key,
            defaults.embedding_cloud_model,
            defaults.image_embedding_provider_mode,
            defaults.image_embedding_local_host,
            defaults.image_embedding_local_port,
            defaults.image_embedding_local_model,
            defaults.image_embedding_cloud_provider,
            defaults.image_embedding_cloud_api_key,
            defaults.image_embedding_cloud_model,
            defaults.image_embedding_cloud_api_endpoint,
            defaults.realtime_embedding_enabled,
            defaults.idle_backfill_enabled,
            defaults.idle_threshold,
            defaults.idle_batch_size,
            defaults.scheduled_backfill_enabled,
            defaults.scheduled_backfill_time,
            defaults.scheduled_backfill_days,
            defaults.scheduled_backfill_batch_size,
            defaults.scheduled_backfill_max_duration,
            defaults.manual_backfill_batch_size,
            defaults.max_retries,
            defaults.retry_delay,
            defaults.request_timeout,
            defaults.cache_enabled,
            defaults.cache_ttl,
            defaults.verbose_logging,
            defaults.log_embedding_content
        ]);

        await db.query(`
            INSERT INTO rag_logs (level, type, message)
            VALUES ('warning', 'system', 'RAG configuration reset to defaults by user')
        `);

        return { success: true, message: 'Configuration reset to defaults' };
    };

    return {
        clearEmbeddings,
        clearLogs,
        exportConfig,
        exportLogs,
        exportMetrics,
        getAdvancedConfig,
        getLogsPayload,
        getRetryConfig,
        reembedImages,
        resetConfig,
        updateAdvancedConfig,
        updateRetryConfig
    };
}

export function registerRagOperationsRoutes({
    router,
    logger,
    helpers
}) {
    const {
        clearEmbeddings,
        clearLogs,
        exportConfig,
        exportLogs,
        exportMetrics,
        getAdvancedConfig,
        getLogsPayload,
        getRetryConfig,
        reembedImages,
        resetConfig,
        updateAdvancedConfig,
        updateRetryConfig
    } = helpers;

    router.get('/logs', async (req, res) => {
        try {
            res.json(await getLogsPayload(req.query));
        } catch (error) {
            logger.error('Failed to get logs', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/logs', async (req, res) => {
        try {
            res.json(await clearLogs());
        } catch (error) {
            logger.error('Failed to clear logs', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/advanced', async (req, res) => {
        try {
            res.json(await getAdvancedConfig());
        } catch (error) {
            logger.error('Failed to get advanced config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/advanced', async (req, res) => {
        try {
            res.json(await updateAdvancedConfig(req.body));
        } catch (error) {
            logger.error('Failed to update advanced config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/settings/embedding/retry', async (req, res) => {
        try {
            res.json(await getRetryConfig());
        } catch (error) {
            logger.error('Failed to get retry config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/settings/embedding/retry', async (req, res) => {
        try {
            res.json(await updateRetryConfig(req.body));
        } catch (error) {
            if (error.status) {
                return res.status(error.status).json({ error: error.message, details: error.details });
            }
            logger.error('Failed to update retry config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/export/config', async (req, res) => {
        try {
            res.json(await exportConfig());
        } catch (error) {
            logger.error('Failed to export config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/export/logs', async (req, res) => {
        try {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=rag-logs.json');
            res.json(await exportLogs());
        } catch (error) {
            logger.error('Failed to export logs', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/export/metrics', async (req, res) => {
        try {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=rag-metrics.json');
            res.json(await exportMetrics());
        } catch (error) {
            logger.error('Failed to export metrics', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/clear-embeddings', async (req, res) => {
        try {
            res.json(await clearEmbeddings());
        } catch (error) {
            logger.error('Failed to clear embeddings', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/reembed-images', async (req, res) => {
        try {
            res.json(await reembedImages());
        } catch (error) {
            logger.error('Failed to clear image embeddings', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/reset-config', async (req, res) => {
        try {
            res.json(await resetConfig());
        } catch (error) {
            logger.error('Failed to reset config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });
}
