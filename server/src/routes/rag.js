/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const embeddingService = require('../services/embeddingService');
const embeddingRouter = require('../services/embeddingRouter');
const embeddingProvider = require('../services/embeddingProvider');
const imageEmbeddingProvider = require('../services/imageEmbeddingProvider');
const ragRetriever = require('../services/ragRetriever');
const embeddingMigrationService = require('../services/embeddingMigrationService');
const patternMiningService = require('../services/patternMiningService');
const ragLoopMetricsCollector = require('../services/ragLoopMetricsCollector');
const ragLogger = require('../utils/ragLogger');
const { createLogger } = require('../utils/logger');
const ollamaService = require('../services/ollama');
const { isMaskedToken } = require('../utils/tokenMasking');
const { getRagLoopDefaultConfig, validateAndNormalizeRagLoopConfig } = require('../utils/ragLoopConfig');

const logger = createLogger('RAG API');

const updateImageModelsCache = async ({ scope, payload }) => {
    try {
        const result = await db.query(
            'SELECT image_embedding_models_cache FROM ai_provider_config WHERE id = 1'
        );
        const current = result.rows[0]?.image_embedding_models_cache || {};
        const next = {
            ...current,
            [scope]: {
                ...payload,
                fetched_at: new Date().toISOString()
            }
        };

        await db.query(
            `UPDATE ai_provider_config
             SET image_embedding_models_cache = $1,
                 image_embedding_models_cache_updated_at = NOW()
             WHERE id = 1`,
            [next]
        );
    } catch (error) {
        logger.warn('Failed to update image models cache', { error: error.message });
    }
};

const resolveImageModelsCache = (config) => {
    const cache = config?.image_embedding_models_cache || {};
    const mode = imageEmbeddingProvider.normalizeMode(config?.image_embedding_provider_mode);

    if (mode === 'cloud') {
        const entry = cache.cloud || null;
        if (!entry) return null;
        const providerMatch = (entry.provider || '') === (config?.image_embedding_cloud_provider || '');
        const endpointMatch = (entry.api_endpoint || '') === (config?.image_embedding_cloud_api_endpoint || '');
        if (!providerMatch || !endpointMatch) return null;
        return { scope: 'cloud', entry };
    }

    if (mode === 'separate_local') {
        const entry = cache.local || null;
        if (!entry) return null;
        const hostMatch = (entry.host || '') === (config?.image_embedding_local_host || '');
        const portMatch = Number(entry.port || 8000) === Number(config?.image_embedding_local_port || 8000);
        if (!hostMatch || !portMatch) return null;
        return { scope: 'local', entry };
    }

    return null;
};

/**
 * POST /api/rag/test-connection
 * Test connection to embedding provider with supplied config
 */
router.post('/test-connection', async (req, res) => {
    try {
        const { mode, host, port, model } = req.body;
        const start = Date.now();

        // Actually test embedding generation to get dimensions
        const result = await embeddingProvider.testConnection(req.body);

        res.json({
            success: result.success,
            latency: Date.now() - start,
            dims: result.dimensions,
            provider: result.provider,
            model: result.model,
            error: result.error
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

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
        let pgvectorVariant = null;
        let pgvectorBuild = null;
        let cpuAvx = null;
        let cpuAvx2 = null;

        try {
            const settingsResult = await db.query(
                `SELECT key, value FROM settings WHERE key IN (
                    'avx_guard_pgvector_selected',
                    'avx_guard_pgvector_build',
                    'avx_guard_cpu_avx',
                    'avx_guard_cpu_avx2'
                )`
            );
            for (const row of settingsResult.rows) {
                if (row.key === 'avx_guard_pgvector_selected') pgvectorVariant = row.value;
                if (row.key === 'avx_guard_pgvector_build') pgvectorBuild = row.value;
                if (row.key === 'avx_guard_cpu_avx') cpuAvx = row.value;
                if (row.key === 'avx_guard_cpu_avx2') cpuAvx2 = row.value;
            }
        } catch (settingsError) {
            // settings table might not exist yet
        }

        // Check if provider is actually configured based on mode
        const circuitOk = circuitStatus.state !== 'OPEN';
        let providerConfigured = false;
        if (config) {
            const mode = config.embedding_provider_mode || 'same';
            if (mode === 'same') {
                // Using same as classification - check if AI provider is configured
                providerConfigured = config.primary_provider && config.primary_provider !== 'none';
            } else if (mode === 'separate_ollama') {
                // Separate Ollama - check if host is configured
                providerConfigured = !!config.embedding_ollama_host;
            } else if (mode === 'cloud') {
                // Cloud provider - check if API key is configured
                providerConfigured = !!config.embedding_cloud_api_key;
            }
        }
        const providerOnline = circuitOk && providerConfigured;

        const imageConfig = await imageEmbeddingProvider.getConfig();
        const imageStats = await embeddingService.getImageStats();
        const imageProviderConfigured = imageEmbeddingProvider.isConfigured(imageConfig);
        const rawImageMode = imageConfig?.image_embedding_provider_mode || 'disabled';
        const imageProviderMode = rawImageMode === 'local'
            ? 'separate_local'
            : (['disabled', 'separate_local', 'cloud'].includes(rawImageMode) ? rawImageMode : 'disabled');
        const imageWeight = Number(config?.rag_image_weight ?? 0);
        const imageEnabled = Number.isFinite(imageWeight) && imageWeight > 0;
        const imageModeDisabled = imageProviderMode === 'disabled';
        const imageProviderOnline = !imageModeDisabled && imageEnabled && imageProviderConfigured;
        let imageProvider = 'unknown';
        if (imageModeDisabled) {
            imageProvider = 'disabled';
        } else if (imageProviderMode === 'cloud') {
            imageProvider = imageConfig?.image_embedding_cloud_provider || 'cloud';
        } else if (imageProviderMode === 'separate_local' || imageProviderMode === 'local') {
            imageProvider = 'local';
        } else {
            imageProvider = imageConfig?.image_embedding_cloud_provider
                || (imageConfig?.image_embedding_local_host ? 'local' : 'unknown');
        }
        const imageModel = imageConfig ? imageEmbeddingProvider.getEffectiveModel(imageConfig) : null;

        res.json({
            enabled: config?.rag_enabled || false,
            provider: config?.embedding_provider || 'auto',
            model: config?.embedding_model || null,
            providerOnline: providerOnline,
            stats: stats || { total: 0, stale: 0, pendingRetries: 0 },
            circuitBreaker: circuitStatus,
            hasMinimumEmbeddings: hasMinimum,
            minimumRequired: config?.rag_min_history_count || 50,
            image: {
                enabled: imageModeDisabled ? false : imageEnabled,
                providerOnline: imageProviderOnline,
                providerConfigured: imageModeDisabled ? false : imageProviderConfigured,
                providerMode: imageProviderMode,
                provider: imageProvider,
                model: imageModel,
                stats: imageStats
            },
            pgvectorVariant,
            pgvectorBuild,
            cpuAvx,
            cpuAvx2
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
 * POST /api/rag/image-test-connection
 * Test image embedding connection with supplied config
 */
router.post('/image-test-connection', async (req, res) => {
    try {
        const {
            mode,
            local_host,
            local_port,
            local_model,
            cloud_provider,
            cloud_api_key,
            cloud_model,
            cloud_api_endpoint,
            image_size
        } = req.body || {};

        const normalizedMode = imageEmbeddingProvider.normalizeMode(mode);

        if (normalizedMode === 'disabled') {
            return res.json({ success: false, error: 'Image embeddings are disabled' });
        }

        if (normalizedMode === 'separate_local') {
            const host = (local_host || '').trim();
            const port = Number(local_port || 8000);

            if (!host) {
                return res.json({ success: false, error: 'Local host is required' });
            }

            const models = await imageEmbeddingProvider.getLocalModels({
                image_embedding_local_host: host,
                image_embedding_local_port: port
            });

            const selected = (local_model || '').trim();
            const match = models.find(model => (model.id || model.name) === selected);

            return res.json({
                success: true,
                provider: 'local',
                model: selected || match?.id || null,
                dims: match?.dims || null,
                image_size: image_size || null,
                modelsCount: models.length
            });
        }

        if (normalizedMode === 'cloud') {
            const provider = (cloud_provider || '').trim();
            if (!provider) {
                return res.json({ success: false, error: 'Cloud provider is required' });
            }

            let apiKey = cloud_api_key;
            if (!apiKey || isMaskedToken(apiKey)) {
                const storedConfig = await imageEmbeddingProvider.getConfig();
                apiKey = storedConfig?.image_embedding_cloud_api_key || '';
            }

            const models = await embeddingProvider.getEmbeddingModels({
                provider,
                api_key: apiKey,
                api_endpoint: cloud_api_endpoint
            });

            const selected = (cloud_model || '').trim();
            const match = models.find(model => (model.id || model.name) === selected);

            return res.json({
                success: true,
                provider,
                model: selected || match?.id || null,
                modelsCount: models.length
            });
        }

        return res.json({ success: false, error: 'Unsupported image embedding mode' });
    } catch (error) {
        return res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/rag/embedding-models
 * Get available embedding models for cloud providers
 */
router.post('/embedding-models', async (req, res) => {
    try {
        const { provider, api_key, api_endpoint, kind } = req.body || {};
        const config = await embeddingRouter.getConfig();

        const isImage = kind === 'image';
        const selectedProvider = provider || (isImage
            ? config?.image_embedding_cloud_provider
            : config?.embedding_cloud_provider);
        if (!selectedProvider) {
            return res.json({ models: [] });
        }

        let actualApiKey = api_key;
        if (!actualApiKey || isMaskedToken(actualApiKey)) {
            actualApiKey = isImage
                ? (config?.image_embedding_cloud_api_key || '')
                : (config?.embedding_cloud_api_key || '');
        }

        const models = await embeddingProvider.getEmbeddingModels({
            provider: selectedProvider,
            api_key: actualApiKey,
            api_endpoint
        });

        if (isImage) {
            await updateImageModelsCache({
                scope: 'cloud',
                payload: {
                    provider: selectedProvider,
                    api_endpoint: api_endpoint || '',
                    models
                }
            });
        }

        res.json({ models });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/image-models
 * Get available local image embedding models
 */
router.get('/image-models', async (req, res) => {
    try {
        const { host, port } = req.query || {};
        const config = await imageEmbeddingProvider.getConfig();

        const localHost = host || config?.image_embedding_local_host || '';
        const localPort = Number(port || config?.image_embedding_local_port || 8000);

        if (!localHost) {
            return res.json({ models: [] });
        }

        const models = await imageEmbeddingProvider.getLocalModels({
            image_embedding_local_host: localHost,
            image_embedding_local_port: localPort
        });

        await updateImageModelsCache({
            scope: 'local',
            payload: {
                host: localHost,
                port: localPort,
                models
            }
        });

        res.json({ models });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/test
 * Test embedding generation (bypasses rag_enabled check)
 */
router.post('/test', async (req, res) => {
    try {
        const { text } = req.body;
        const testText = text || 'Test embedding for Classifarr';

        const startTime = Date.now();

        // Use embeddingProvider directly to bypass rag_enabled check
        // This allows testing the connection before RAG is fully enabled
        const result = await embeddingProvider.getEmbedding(testText);
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
        const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
        const pending = await embeddingService.getPendingEmbeddings({
            limit,
            includeImage
        });

        let processed = 0;
        let failed = 0;

        for (const row of pending) {
            try {
                const metadata = row.metadata || {};
                if (row.needsText) {
                    await embeddingService.generateAndStore(row.id, {
                        ...metadata,
                        title: row.title,
                        media_type: row.media_type,
                        library_name: row.library_name
                    });
                } else if (row.needsImage) {
                    await embeddingService.generateImageEmbedding(row.id, {
                        ...metadata,
                        title: row.title,
                        media_type: row.media_type,
                        library_name: row.library_name
                    });
                }
                processed++;
            } catch (error) {
                failed++;
            }
        }

        res.json({
            success: true,
            processed,
            failed,
            remaining: pending.length - processed
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
 * GET /api/rag/detailed
 * Get consolidated detailed RAG statistics (single source of truth)
 * This endpoint aggregates all RAG-related metrics in one call
 */
router.get('/detailed', async (req, res) => {
    try {
        // Validate and parse hours parameter
        let hours = 24; // default
        if (req.query.hours !== undefined) {
            const parsedHours = parseInt(req.query.hours, 10);
            if (!isNaN(parsedHours) && parsedHours > 0 && parsedHours <= 720) { // Max 30 days
                hours = parsedHours;
            } else {
                return res.status(400).json({ error: `Invalid hours parameter: '${req.query.hours}'. Must be an integer between 1 and 720.` });
            }
        }

        // Helper function to get operation metrics (parallelized for performance)
        const getRAGMetrics = async (hours) => {
            const operations = ['semantic_search', 'hybrid_search', 'embedding_generation', 'pattern_mining'];
            
            // Fetch all operation metrics in parallel to reduce overall latency
            const metricsResults = await Promise.all(
                operations.map((operation) => ragLogger.getMetricsByOperation(operation, hours))
            );

            const operationMetrics = {};
            operations.forEach((operation, index) => {
                operationMetrics[operation] = metricsResults[index];
            });

            return {
                operationMetrics,
                providerMetrics: embeddingProvider.getMetrics()
            };
        };

        // Helper function to get backfill history
        const getBackfillHistory = async () => {
            const history = await db.query(`
                SELECT * FROM backfill_runs 
                ORDER BY created_at DESC 
                LIMIT 20
            `);
            return history.rows;
        };

        // Helper function to get failed count (last 24 hours)
        const getFailedCount = async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM embedding_errors
                WHERE created_at >= NOW() - INTERVAL '24 hours'
                AND resolved = false
            `);
            return parseInt(result.rows[0]?.count) || 0;
        };

        // Helper function to get average generation time and last embedding time
        const getGenerationMetrics = async () => {
            const result = await db.query(`
                SELECT 
                    AVG(duration_ms) as avg_time,
                    MAX(period_start) as last_time
                FROM rag_metrics
                WHERE operation = 'embedding_generation'
                AND period_start >= NOW() - INTERVAL '24 hours'
            `);
            return {
                avgGenerationTime: Math.round(parseFloat(result.rows[0]?.avg_time) || 0),
                lastEmbeddingTime: result.rows[0]?.last_time || null
            };
        };

        // Parallel fetch all required data
        const [
            statsData,
            metricsData,
            circuitBreakerStatus,
            backfillHistoryData,
            config,
            failedCount,
            generationMetrics
        ] = await Promise.all([
            embeddingService.getStats(),
            getRAGMetrics(hours),
            embeddingProvider.circuitBreaker.getStatus(),
            getBackfillHistory(),
            embeddingRouter.getConfig(),
            getFailedCount(),
            getGenerationMetrics()
        ]);

        // Get circuit breaker state history (synchronous in-memory call; safe to run after Promise.all)
        const stateHistory = embeddingProvider.circuitBreaker.getStateHistory(20);

        res.json({
            stats: {
                totalEmbeddings: statsData?.totalEmbeddings || statsData?.total || 0,
                pendingCount: statsData?.pendingCount || 0,
                failedCount: failedCount,
                avgGenerationTime: generationMetrics.avgGenerationTime,
                lastEmbeddingTime: generationMetrics.lastEmbeddingTime
            },
            providerOnline: circuitBreakerStatus?.state === 'CLOSED',
            operationMetrics: metricsData?.operationMetrics || {},
            providerMetrics: metricsData?.providerMetrics || {},
            circuitBreaker: {
                state: circuitBreakerStatus?.state || 'unknown',
                failureCount: circuitBreakerStatus?.failures || 0,
                lastFailureTime: circuitBreakerStatus?.lastFailure || null,
                stateHistory: stateHistory || [],
                config: circuitBreakerStatus?.config || {}
            },
            backfillHistory: backfillHistoryData || [],
            config: {
                provider: config?.embedding_provider || 'unknown',
                model: config?.embedding_model || config?.embedding_ollama_model || 'unknown',
                dimensions: config?.embedding_dims || 0
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get detailed RAG stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/metrics
 * Get detailed metrics by operation type and provider metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const { hours = 24 } = req.query;

        const operations = ['semantic_search', 'hybrid_search', 'embedding_generation', 'pattern_mining'];
        const metrics = {};

        for (const operation of operations) {
            metrics[operation] = await ragLogger.getMetricsByOperation(operation, parseInt(hours));
        }

        // Add embedding provider metrics
        metrics.provider = embeddingProvider.getMetrics();

        res.json(metrics);
    } catch (error) {
        logger.error('Failed to get RAG metrics', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/loop/latest-fallback-incident
 * Returns the latest sanitized automatic fallback incident payload for operator reporting.
 */
router.get('/loop/latest-fallback-incident', async (req, res) => {
    try {
        const defaults = getRagLoopDefaultConfig();
        let configRow = {};

        try {
            const result = await db.query(`
                SELECT
                    rag_loop_rollout_mode,
                    rag_loop_auto_fallback_enabled,
                    rag_loop_auto_fallback_min_apply_samples,
                    rag_loop_auto_fallback_consecutive_breaches,
                    rag_loop_auto_fallback_cooldown_ms,
                    rag_loop_auto_recover_enabled,
                    rag_loop_auto_fallback_breach_count,
                    rag_loop_auto_fallback_last_breach_at,
                    rag_loop_auto_fallback_last_triggered_at,
                    rag_loop_auto_fallback_cooldown_until,
                    rag_loop_auto_fallback_last_incident_id,
                    rag_loop_auto_fallback_last_incident_payload,
                    rag_loop_auto_fallback_last_version,
                    rag_loop_auto_recover_last_attempt_version,
                    rag_loop_auto_recover_last_attempt_at
                FROM ai_provider_config
                WHERE id = 1
            `);
            configRow = result.rows[0] || {};
        } catch (configError) {
            if (!['42P01', '42703'].includes(configError.code)) {
                throw configError;
            }
            configRow = {};
        }

        const { normalizedConfig } = validateAndNormalizeRagLoopConfig(
            { ...defaults, ...configRow },
            { ...defaults, ...configRow }
        );

        let incident = null;
        if (
            configRow.rag_loop_auto_fallback_last_incident_payload &&
            typeof configRow.rag_loop_auto_fallback_last_incident_payload === 'object' &&
            !Array.isArray(configRow.rag_loop_auto_fallback_last_incident_payload)
        ) {
            incident = {
                ...configRow.rag_loop_auto_fallback_last_incident_payload
            };
        }

        if (incident) {
            if (!incident.incident_id && configRow.rag_loop_auto_fallback_last_incident_id) {
                incident.incident_id = configRow.rag_loop_auto_fallback_last_incident_id;
            }
            if (!incident.triggered_at && configRow.rag_loop_auto_fallback_last_triggered_at) {
                incident.triggered_at = configRow.rag_loop_auto_fallback_last_triggered_at;
            }
        }

        res.json({
            incident,
            rollout_mode: normalizedConfig.rag_loop_rollout_mode,
            fallback_state: {
                auto_fallback_enabled: normalizedConfig.rag_loop_auto_fallback_enabled,
                auto_recover_enabled: normalizedConfig.rag_loop_auto_recover_enabled,
                breach_count: Math.max(0, Number(configRow.rag_loop_auto_fallback_breach_count || 0)),
                cooldown_until: configRow.rag_loop_auto_fallback_cooldown_until || null,
                last_triggered_at: configRow.rag_loop_auto_fallback_last_triggered_at || null,
                last_fallback_version: configRow.rag_loop_auto_fallback_last_version || null,
                last_recover_attempt_version: configRow.rag_loop_auto_recover_last_attempt_version || null,
                last_recover_attempt_at: configRow.rag_loop_auto_recover_last_attempt_at || null
            },
            checked_at: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get rag loop latest fallback incident', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/loop/promotion-readiness
 * Read-only shadow promotion metrics and gate thresholds for Issue 275 rollout.
 */
router.get('/loop/promotion-readiness', async (req, res) => {
    try {
        const defaults = getRagLoopDefaultConfig();
        let configRow = {};

        try {
            const result = await db.query(`
                SELECT
                    rag_loop_shadow_min_samples,
                    rag_loop_shadow_max_error_rate_delta,
                    rag_loop_shadow_max_p95_latency_delta_ms
                FROM ai_provider_config
                WHERE id = 1
            `);
            configRow = result.rows[0] || {};
        } catch (configError) {
            // Compatibility fallback for environments that have not applied Issue 275 schema.
            if (!['42P01', '42703'].includes(configError.code)) {
                throw configError;
            }
            configRow = {};
        }

        const { normalizedConfig } = validateAndNormalizeRagLoopConfig(
            { ...defaults, ...configRow },
            { ...defaults, ...configRow }
        );
        const readiness = ragLoopMetricsCollector.canPromote(normalizedConfig);

        res.json({
            ready: readiness.ready,
            metrics: readiness.metrics,
            gates: {
                min_samples: normalizedConfig.rag_loop_shadow_min_samples,
                max_error_rate_delta: normalizedConfig.rag_loop_shadow_max_error_rate_delta,
                max_p95_latency_delta_ms: normalizedConfig.rag_loop_shadow_max_p95_latency_delta_ms
            },
            checked_at: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get rag loop promotion readiness', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/circuit-breaker
 * Get circuit breaker status
 */
router.get('/circuit-breaker', async (req, res) => {
    try {
        const status = embeddingProvider.circuitBreaker.getStatus();
        const stateHistory = embeddingProvider.circuitBreaker.getStateHistory(20);

        res.json({
            ...status,
            stateHistory
        });
    } catch (error) {
        logger.error('Failed to get circuit breaker status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/circuit-breaker/reset
 * Manually reset circuit breaker
 */
router.post('/circuit-breaker/reset', async (req, res) => {
    try {
        embeddingProvider.circuitBreaker.reset();

        res.json({
            success: true,
            message: 'Circuit breaker reset successfully',
            status: embeddingProvider.circuitBreaker.getStatus()
        });
    } catch (error) {
        logger.error('Failed to reset circuit breaker', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/warmup
 * Trigger model warmup
 */
router.post('/warmup', async (req, res) => {
    try {
        const result = await embeddingProvider.warmup();

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('Model warmup failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
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

/**
 * Backfill API Endpoints
 */
const manualBackfillService = require('../services/manualBackfillService');
const scheduledBackfillService = require('../services/scheduledBackfillService');
const idleBackfillService = require('../services/idleBackfillService');
const { parseDaysConfig, formatDaysConfig } = require('../utils/backfillHelpers');

/**
 * POST /api/rag/backfill/manual/start
 * Start manual backfill
 */
router.post('/backfill/manual/start', async (req, res) => {
    try {
        const { batchSize } = req.body;
        await manualBackfillService.start({ batchSize });
        res.json({ success: true, status: await manualBackfillService.getStatus() });
    } catch (error) {
        logger.error('Failed to start manual backfill', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/rag/backfill/manual/pause
 * Pause manual backfill
 */
router.post('/backfill/manual/pause', async (req, res) => {
    try {
        manualBackfillService.pause();
        res.json({ success: true, status: await manualBackfillService.getStatus() });
    } catch (error) {
        logger.error('Failed to pause manual backfill', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/backfill/manual/resume
 * Resume manual backfill
 */
router.post('/backfill/manual/resume', async (req, res) => {
    try {
        await manualBackfillService.resume();
        res.json({ success: true, status: await manualBackfillService.getStatus() });
    } catch (error) {
        logger.error('Failed to resume manual backfill', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/backfill/manual/clear
 * Clear manual backfill state
 */
router.post('/backfill/manual/clear', async (req, res) => {
    try {
        await manualBackfillService.clear();
        res.json({ success: true, status: await manualBackfillService.getStatus() });
    } catch (error) {
        logger.error('Failed to clear manual backfill', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/backfill/status
 * Get backfill status for all modes
 */
router.get('/backfill/status', async (req, res) => {
    try {
        const pending = await manualBackfillService.getPendingCount();
        const manualStatus = await manualBackfillService.getStatus();
        const idleStatus = idleBackfillService.getStatus();
        const scheduleConfig = scheduledBackfillService.getSchedule();
        const pendingBreakdown = await embeddingService.getPendingBreakdown();

        res.json({
            manual: manualStatus,
            idle: idleStatus,
            scheduled: scheduleConfig,
            pending,
            pendingBreakdown
        });
    } catch (error) {
        logger.error('Failed to get backfill status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/backfill/schedule
 * Get scheduled backfill configuration
 */
router.get('/backfill/schedule', async (req, res) => {
    try {
        const config = await db.query(`
            SELECT 
                scheduled_backfill_enabled,
                scheduled_backfill_time,
                scheduled_backfill_days,
                scheduled_backfill_batch_size,
                scheduled_backfill_max_duration
            FROM ai_provider_config WHERE id = 1
        `);

        if (config.rows.length === 0) {
            return res.json({
                scheduled_backfill_enabled: true,
                scheduled_backfill_time: '02:00',
                scheduled_backfill_days: '0,1,2,3,4,5,6',
                scheduled_backfill_batch_size: 100,
                scheduled_backfill_max_duration: 3600000
            });
        }

        res.json(config.rows[0]);
    } catch (error) {
        logger.error('Failed to get schedule config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/rag/backfill/schedule
 * Update scheduled backfill configuration
 */
router.put('/backfill/schedule', async (req, res) => {
    try {
        const {
            enabled,
            time,
            days,
            batchSize,
            maxDuration
        } = req.body;

        await db.query(`
            UPDATE ai_provider_config SET
                scheduled_backfill_enabled = $1,
                scheduled_backfill_time = $2,
                scheduled_backfill_days = $3,
                scheduled_backfill_batch_size = $4,
                scheduled_backfill_max_duration = $5
            WHERE id = 1
        `, [enabled, time, formatDaysConfig(days), batchSize, maxDuration]);

        // Update the service with new schedule
        scheduledBackfillService.updateSchedule({
            enabled,
            time,
            days: parseDaysConfig(days),
            batchSize,
            maxDuration
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to update schedule config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/backfill/idle
 * Get idle backfill configuration
 */
router.get('/backfill/idle', async (req, res) => {
    try {
        const config = await db.query(`
            SELECT 
                idle_backfill_enabled,
                idle_threshold,
                idle_batch_size
            FROM ai_provider_config WHERE id = 1
        `);

        if (config.rows.length === 0) {
            return res.json({
                idle_backfill_enabled: true,
                idle_threshold: 30000,
                idle_batch_size: 10
            });
        }

        res.json(config.rows[0]);
    } catch (error) {
        logger.error('Failed to get idle config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/rag/backfill/idle
 * Update idle backfill configuration
 */
router.put('/backfill/idle', async (req, res) => {
    try {
        const { enabled, threshold, batchSize } = req.body;

        await db.query(`
            UPDATE ai_provider_config SET
                idle_backfill_enabled = $1,
                idle_threshold = $2,
                idle_batch_size = $3
            WHERE id = 1
        `, [enabled, threshold, batchSize]);

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to update idle config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/backfill/realtime
 * Get real-time embedding configuration
 */
router.get('/backfill/realtime', async (req, res) => {
    try {
        const config = await db.query(`
            SELECT realtime_embedding_enabled
            FROM ai_provider_config WHERE id = 1
        `);

        if (config.rows.length === 0) {
            return res.json({ realtime_embedding_enabled: true });
        }

        res.json(config.rows[0]);
    } catch (error) {
        logger.error('Failed to get realtime config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/rag/backfill/realtime
 * Update real-time embedding configuration
 */
router.put('/backfill/realtime', async (req, res) => {
    try {
        const { enabled } = req.body;

        await db.query(`
            UPDATE ai_provider_config SET
                realtime_embedding_enabled = $1
            WHERE id = 1
        `, [enabled]);

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to update realtime config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/backfill/history
 * Get backfill run history
 */
router.get('/backfill/history', async (req, res) => {
    try {
        const history = await db.query(`
            SELECT * FROM backfill_runs 
            ORDER BY created_at DESC 
            LIMIT 20
        `);

        res.json({ history: history.rows });
    } catch (error) {
        logger.error('Failed to get backfill history', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/overview
 * Get overview stats for RAG dashboard
 */
router.get('/overview', async (req, res) => {
    try {
        // Get provider status
        const config = await embeddingRouter.getConfig();
        const circuitOk = embeddingRouter.getCircuitStatus().state !== 'OPEN';

        // Check if provider is actually configured based on mode
        let providerConfigured = false;
        if (config) {
            const mode = config.embedding_provider_mode || 'same';
            if (mode === 'same') {
                // Using same as classification - check if AI provider is configured
                providerConfigured = config.primary_provider && config.primary_provider !== 'none';
            } else if (mode === 'separate_ollama') {
                // Separate Ollama - check if host is configured
                providerConfigured = !!config.embedding_ollama_host;
            } else if (mode === 'cloud') {
                // Cloud provider - check if API key is configured
                providerConfigured = !!config.embedding_cloud_api_key;
            }
        }

        const providerOnline = circuitOk && providerConfigured;

        // Get total embeddings count
        const embeddingsResult = await db.query(`
            SELECT COUNT(*) as total FROM classification_embeddings
        `);

        const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
        const pendingCount = await embeddingService.getPendingCount({ includeImage });

        // Get failed count (last 24 hours)
        const failedResult = await db.query(`
            SELECT COUNT(*) as count
            FROM embedding_errors
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            AND resolved = false
        `);

        // Get average generation time and last embedding time
        const metricsResult = await db.query(`
            SELECT 
                AVG(duration_ms) as avg_time,
                MAX(period_start) as last_time
            FROM rag_metrics
            WHERE operation = 'embedding_generation'
            AND period_start >= NOW() - INTERVAL '24 hours'
        `);

        // Get recent activity
        const activityResult = await db.query(`
            SELECT * FROM rag_logs
            ORDER BY created_at DESC
            LIMIT 5
        `);

        res.json({
            providerOnline,
            stats: {
                totalEmbeddings: parseInt(embeddingsResult.rows[0].total) || 0,
                pendingCount: pendingCount || 0,
                failedCount: parseInt(failedResult.rows[0].count) || 0,
                avgGenerationTime: Math.round(parseFloat(metricsResult.rows[0]?.avg_time) || 0),
                lastEmbeddingTime: metricsResult.rows[0]?.last_time || null
            },
            config: {
                embedding_provider_mode: config.embedding_provider_mode || 'same'
            },
            currentModel: config.embedding_model || config.embedding_ollama_model || 'unknown',
            recentActivity: activityResult.rows
        });
    } catch (error) {
        logger.error('Failed to get overview', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/logs
 * Get RAG logs with filtering
 */
router.get('/logs', async (req, res) => {
    try {
        const { level, type, limit = 100, offset = 0 } = req.query;

        let query = 'SELECT * FROM rag_logs WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (level && level !== 'all') {
            query += ` AND level = $${paramCount}`;
            params.push(level);
            paramCount++;
        }

        if (type && type !== 'all') {
            query += ` AND type = $${paramCount}`;
            params.push(type);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        res.json({ logs: result.rows });
    } catch (error) {
        logger.error('Failed to get logs', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/rag/logs
 * Clear RAG logs
 */
router.delete('/logs', async (req, res) => {
    try {
        await db.query('DELETE FROM rag_logs');
        res.json({ success: true, message: 'Logs cleared' });
    } catch (error) {
        logger.error('Failed to clear logs', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/advanced
 * Get advanced configuration
 */
router.get('/advanced', async (req, res) => {
    try {
        const config = await db.query(`
            SELECT 
                max_retries, retry_delay, request_timeout,
                cache_enabled, cache_ttl,
                verbose_logging, log_embedding_content
            FROM ai_provider_config WHERE id = 1
        `);

        if (config.rows.length === 0) {
            return res.json({
                max_retries: 3,
                retry_delay: 1000,
                request_timeout: 30000,
                cache_enabled: false,
                cache_ttl: 24,
                verbose_logging: false,
                log_embedding_content: false
            });
        }

        res.json(config.rows[0]);
    } catch (error) {
        logger.error('Failed to get advanced config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/rag/advanced
 * Update advanced configuration
 */
router.put('/advanced', async (req, res) => {
    try {
        const {
            max_retries, retry_delay, request_timeout,
            cache_enabled, cache_ttl,
            verbose_logging, log_embedding_content
        } = req.body;

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

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to update advanced config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/settings/embedding/retry
 * Get retry configuration
 */
router.get('/settings/embedding/retry', async (req, res) => {
    try {
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
            return res.json({
                request_timeout: 30000,
                warmup_timeout: 120000,
                max_retries: 3,
                retry_delay: 1000,
                retry_backoff_multiplier: 2,
                jitter_factor: 0.3
            });
        }

        res.json(config.rows[0]);
    } catch (error) {
        logger.error('Failed to get retry config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/settings/embedding/retry
 * Update retry configuration
 */
router.put('/settings/embedding/retry', async (req, res) => {
    try {
        const {
            request_timeout,
            warmup_timeout,
            max_retries,
            retry_delay,
            retry_backoff_multiplier,
            jitter_factor
        } = req.body;

        // Validate input ranges
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
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

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

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to update retry config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/export/config
 * Export RAG configuration
 */
router.post('/export/config', async (req, res) => {
    try {
        const config = await db.query(`
            SELECT * FROM ai_provider_config WHERE id = 1
        `);

        res.json(config.rows[0] || {});
    } catch (error) {
        logger.error('Failed to export config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/export/logs
 * Export RAG logs
 */
router.post('/export/logs', async (req, res) => {
    try {
        const logs = await db.query(`
            SELECT * FROM rag_logs ORDER BY created_at DESC LIMIT 1000
        `);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=rag-logs.json');
        res.json({ logs: logs.rows });
    } catch (error) {
        logger.error('Failed to export logs', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/export/metrics
 * Export RAG metrics (uses existing rag_metrics table from migration 039)
 */
router.post('/export/metrics', async (req, res) => {
    try {
        const metrics = await db.query(`
            SELECT * FROM rag_metrics 
            WHERE operation = 'embedding_generation'
            ORDER BY period_start DESC 
            LIMIT 1000
        `);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=rag-metrics.json');
        res.json({ metrics: metrics.rows });
    } catch (error) {
        logger.error('Failed to export metrics', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/clear-embeddings
 * Clear all embeddings (danger zone)
 */
router.post('/clear-embeddings', async (req, res) => {
    try {
        await db.query('DELETE FROM classification_embeddings');

        await db.query(`
            INSERT INTO rag_logs (level, type, message)
            VALUES ('warning', 'system', 'All embeddings cleared by user')
        `);

        res.json({ success: true, message: 'All embeddings cleared' });
    } catch (error) {
        logger.error('Failed to clear embeddings', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/image-models-cache
 * Get cached image embedding models for the active config (if any)
 */
router.get('/image-models-cache', async (req, res) => {
    try {
        const config = await imageEmbeddingProvider.getConfig();
        if (!config) {
            return res.json({ models: [], fetchedAt: null, cacheHit: false });
        }

        const match = resolveImageModelsCache(config);
        if (!match) {
            return res.json({ models: [], fetchedAt: null, cacheHit: false });
        }

        return res.json({
            models: match.entry.models || [],
            fetchedAt: match.entry.fetched_at || null,
            cacheHit: true,
            scope: match.scope
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/reembed-images
 * Clear image embeddings only to force re-embedding
 */
router.post('/reembed-images', async (req, res) => {
    try {
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

        res.json({ success: true, cleared: result.rowCount });
    } catch (error) {
        logger.error('Failed to clear image embeddings', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/rag/reset-config
 * Reset RAG configuration to defaults (danger zone)
 */
router.post('/reset-config', async (req, res) => {
    try {
        await db.query(`
            UPDATE ai_provider_config SET
                embedding_provider_mode = 'same',
                embedding_ollama_host = NULL,
                embedding_ollama_port = 11434,
                embedding_ollama_model = NULL,
                embedding_cloud_provider = NULL,
                embedding_cloud_api_key = NULL,
                embedding_cloud_model = NULL,
                realtime_embedding_enabled = true,
                idle_backfill_enabled = true,
                idle_threshold = 30000,
                idle_batch_size = 10,
                scheduled_backfill_enabled = true,
                scheduled_backfill_time = '02:00',
                scheduled_backfill_days = '0,1,2,3,4,5,6',
                scheduled_backfill_batch_size = 100,
                scheduled_backfill_max_duration = 3600000,
                manual_backfill_batch_size = 50,
                max_retries = 3,
                retry_delay = 1000,
                request_timeout = 30000,
                cache_enabled = false,
                cache_ttl = 24,
                verbose_logging = false,
                log_embedding_content = false
            WHERE id = 1
        `);

        await db.query(`
            INSERT INTO rag_logs (level, type, message)
            VALUES ('warning', 'system', 'RAG configuration reset to defaults by user')
        `);

        res.json({ success: true, message: 'Configuration reset to defaults' });
    } catch (error) {
        logger.error('Failed to reset config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/rag/graph/fill-rate
 * Graph relationship column fill-rate diagnostic (Phase 5 backfill readiness).
 * Returns row counts and percentages for each relationship column so operators
 * can verify the backfill script has been run before enabling rag_graph_enabled.
 */
router.get('/graph/fill-rate', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                COUNT(*)                                                              AS total,
                COUNT(director_name)                                                  AS has_director,
                COUNT(primary_studio_name)                                            AS has_studio,
                COUNT(genre_names)  FILTER (WHERE array_length(genre_names,  1) > 0) AS has_genres,
                COUNT(cast_ids)     FILTER (WHERE array_length(cast_ids,     1) > 0) AS has_cast,
                COUNT(collection_id)                                                  AS has_collection
            FROM classification_history
            WHERE metadata IS NOT NULL
        `);

        const row = result.rows[0];
        const total = Number(row.total);
        const pct = (n) => total > 0 ? Math.round((Number(n) / total) * 1000) / 10 : null;

        res.json({
            total,
            has_director:   Number(row.has_director),
            has_studio:     Number(row.has_studio),
            has_genres:     Number(row.has_genres),
            has_cast:       Number(row.has_cast),
            has_collection: Number(row.has_collection),
            pct_director:   pct(row.has_director),
            pct_studio:     pct(row.has_studio),
            pct_genres:     pct(row.has_genres),
            pct_cast:       pct(row.has_cast),
            pct_collection: pct(row.has_collection)
        });
    } catch (error) {
        logger.error('Failed to get graph fill-rate', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
