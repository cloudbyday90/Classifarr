/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
    buildImageStatusPayload,
    resolveProviderOnline
} from './ragStatusPresentation.mjs';
import { ValidationError } from '../../utils/appError.mjs';

export function createRagStatusHelpers({
    db,
    ragLogger,
    embeddingService,
    embeddingRouter,
    embeddingProvider,
    imageEmbeddingProvider,
    getBackfillHistoryPayload,
    resolveEmbeddingAvailability,
    isEmbeddingProviderConfigured
}) {
    const getPgvectorSettings = async () => {
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
        } catch (_settingsError) {
            // settings table might not exist yet
        }

        return {
            pgvectorVariant,
            pgvectorBuild,
            cpuAvx,
            cpuAvx2
        };
    };

    const parseDetailedHours = (rawHours) => {
        if (rawHours === undefined) {
            return 24;
        }

        const parsedHours = parseInt(rawHours, 10);
        if (!Number.isNaN(parsedHours) && parsedHours > 0 && parsedHours <= 720) {
            return parsedHours;
        }

        throw new ValidationError(`Invalid hours parameter: '${rawHours}'. Must be an integer between 1 and 720.`);
    };

    const getRAGMetrics = async (hours) => {
        const operations = ['semantic_search', 'hybrid_search', 'embedding_generation', 'pattern_mining'];

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

    const getMetricsPayload = async (hours) => {
        const metrics = await getRAGMetrics(parseInt(hours, 10));
        return {
            ...metrics.operationMetrics,
            provider: metrics.providerMetrics
        };
    };

    const getFailedCount = async () => {
        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM embedding_errors
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            AND resolved = false
        `);
        return parseInt(result.rows[0]?.count) || 0;
    };

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

    const getStatusPayload = async () => {
        const [
            config,
            stats,
            circuitStatus,
            embeddingAvailability,
            hasMinimum,
            imageConfig,
            imageStats,
            pgvectorSettings
        ] = await Promise.all([
            embeddingRouter.getConfig(),
            embeddingService.getStats(),
            embeddingRouter.getCircuitStatus(),
            resolveEmbeddingAvailability(),
            embeddingService.hasMinimumEmbeddings(),
            imageEmbeddingProvider.getConfig(),
            embeddingService.getImageStats(),
            getPgvectorSettings()
        ]);

        const providerConfigured = isEmbeddingProviderConfigured(config);
        const effectiveProviderOnline = resolveProviderOnline({
            providerConfigured,
            circuitStatus,
            embeddingAvailability
        });
        const image = buildImageStatusPayload({
            config,
            imageConfig,
            imageStats,
            imageProviderConfigured: imageEmbeddingProvider.isConfigured(imageConfig),
            imageEmbeddingProvider
        });

        return {
            enabled: config?.rag_enabled || false,
            provider: config?.embedding_provider || 'auto',
            model: config?.embedding_model || null,
            providerConfigured,
            providerOnline: effectiveProviderOnline,
            embeddingAvailability,
            stats: stats || { total: 0, stale: 0, pendingRetries: 0 },
            circuitBreaker: circuitStatus,
            hasMinimumEmbeddings: hasMinimum,
            minimumRequired: config?.rag_min_history_count || 50,
            image,
            ...pgvectorSettings
        };
    };

    const getOverviewPayload = async () => {
        const [
            config,
            circuitStatus,
            embeddingAvailability,
            includeImage,
            embeddingsResult,
            failedCount,
            generationMetrics,
            activityResult
        ] = await Promise.all([
            embeddingRouter.getConfig(),
            embeddingRouter.getCircuitStatus(),
            resolveEmbeddingAvailability(),
            embeddingService.shouldIncludeImageEmbeddings(),
            db.query(`SELECT COUNT(*) as total FROM classification_embeddings`),
            getFailedCount(),
            getGenerationMetrics(),
            db.query(`
                SELECT * FROM rag_logs
                ORDER BY created_at DESC
                LIMIT 5
            `)
        ]);

        const pendingCount = await embeddingService.getPendingCount({ includeImage });
        const providerConfigured = isEmbeddingProviderConfigured(config);
        const providerOnline = resolveProviderOnline({
            providerConfigured,
            circuitStatus,
            embeddingAvailability
        });

        return {
            providerConfigured,
            providerOnline,
            embeddingAvailability,
            stats: {
                totalEmbeddings: parseInt(embeddingsResult.rows[0].total) || 0,
                pendingCount: pendingCount || 0,
                failedCount,
                avgGenerationTime: generationMetrics.avgGenerationTime,
                lastEmbeddingTime: generationMetrics.lastEmbeddingTime
            },
            config: {
                embedding_provider_mode: config.embedding_provider_mode || 'same'
            },
            currentModel: config.embedding_model || config.embedding_ollama_model || 'unknown',
            recentActivity: activityResult.rows
        };
    };

    const getDetailedPayload = async (hours) => {
        const [
            statsData,
            metricsData,
            circuitBreakerStatus,
            backfillHistoryData,
            config,
            failedCount,
            generationMetrics,
            embeddingAvailability
        ] = await Promise.all([
            embeddingService.getStats(),
            getRAGMetrics(hours),
            embeddingRouter.getCircuitStatus(),
            getBackfillHistoryPayload(),
            embeddingRouter.getConfig(),
            getFailedCount(),
            getGenerationMetrics(),
            resolveEmbeddingAvailability()
        ]);

        const stateHistory = embeddingRouter.getCircuitStateHistory(20);
        const providerConfigured = isEmbeddingProviderConfigured(config);
        const providerOnline = resolveProviderOnline({
            providerConfigured,
            circuitStatus: circuitBreakerStatus,
            embeddingAvailability
        });

        return {
            stats: {
                totalEmbeddings: statsData?.totalEmbeddings || statsData?.total || 0,
                pendingCount: statsData?.pendingCount || 0,
                failedCount,
                avgGenerationTime: generationMetrics.avgGenerationTime,
                lastEmbeddingTime: generationMetrics.lastEmbeddingTime
            },
            providerConfigured,
            providerOnline,
            operationMetrics: metricsData?.operationMetrics || {},
            providerMetrics: metricsData?.providerMetrics || {},
            embeddingAvailability,
            circuitBreaker: {
                state: circuitBreakerStatus?.state || 'unknown',
                failureCount: circuitBreakerStatus?.failureCount ?? circuitBreakerStatus?.failures ?? 0,
                lastFailureTime: circuitBreakerStatus?.lastFailureTime ?? circuitBreakerStatus?.lastFailure ?? null,
                stateHistory: stateHistory || [],
                config: circuitBreakerStatus?.config || {}
            },
            backfillHistory: backfillHistoryData?.history || [],
            config: {
                provider: config?.embedding_provider || 'unknown',
                model: config?.embedding_model || config?.embedding_ollama_model || 'unknown',
                dimensions: config?.embedding_dims || 0
            },
            timestamp: new Date().toISOString()
        };
    };

    const getCostsPayload = async () => {
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

        return {
            last30Days: result.rows.map((row) => ({
                provider: row.provider,
                tokens: parseInt(row.total_tokens) || 0,
                items: parseInt(row.total_items) || 0,
                cost: parseFloat(row.total_cost) || 0
            }))
        };
    };

    const getHealthPayload = async () => {
        const [healthSummary, recentErrors] = await Promise.all([
            ragLogger.getHealthSummary(),
            ragLogger.getRecentErrors(10)
        ]);

        return {
            health: healthSummary,
            recentErrors
        };
    };

    return {
        getCostsPayload,
        getDetailedPayload,
        getHealthPayload,
        getMetricsPayload,
        getOverviewPayload,
        getStatusPayload,
        parseDetailedHours
    };
}
