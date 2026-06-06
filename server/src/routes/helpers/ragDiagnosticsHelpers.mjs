/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createRagRoute } from './ragRouteResponseSupport.mjs';
import {
    getLatestFallbackIncidentPayload,
    getPromotionReadinessPayload,
} from './ragDiagnosticsLoop.mjs';
import {
    getPatternsPayload,
    approvePattern,
    rejectPattern,
    getGraphFillRatePayload,
} from './ragDiagnosticsPatterns.mjs';

export function createRagDiagnosticsHelpers({
    db,
    logger,
    embeddingRouter,
    embeddingProvider,
    embeddingMigrationService,
    patternMiningService,
    ragLoopMetricsCollector,
    pgvectorRecallAuditService,
    ragLogger,
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig
}) {
    const loopDeps = {
        db,
        getRagLoopDefaultConfig,
        validateAndNormalizeRagLoopConfig,
        ragLoopMetricsCollector
    };

    const patternDeps = { db, patternMiningService };

    return {
        approvePattern: (params) => approvePattern(patternDeps, params),
        discoverPatterns: () => patternMiningService.discoverPatterns(),
        getCircuitBreakerPayload: () => {
            const status = embeddingRouter.getCircuitStatus();
            const stateHistory = embeddingRouter.getCircuitStateHistory(20);
            return { ...status, stateHistory };
        },
        getErrorsPayload: (options) => ragLogger.getRecentErrors(
            parseInt(options?.limit ?? 50, 10),
            options?.operation || null
        ).then((errors) => ({ errors })),
        getGraphFillRatePayload: () => getGraphFillRatePayload({ db }),
        getLatestFallbackIncidentPayload: () => getLatestFallbackIncidentPayload(loopDeps),
        getMigrationStatus: () => embeddingMigrationService.getProgress(),
        getPatternsPayload: (options) => getPatternsPayload(patternDeps, options),
        getPromotionReadinessPayload: () => getPromotionReadinessPayload(loopDeps),
        getRecallAuditPayload: (options) => pgvectorRecallAuditService.runAudit(options),
        rejectPattern: (params) => rejectPattern({ db }, params),
        resetCircuitBreaker: () => {
            embeddingRouter.resetCircuit();
            return {
                success: true,
                message: 'Circuit breaker reset successfully',
                status: embeddingRouter.getCircuitStatus()
            };
        },
        startMigration: async ({ markAllStale = false } = {}) => {
            if (markAllStale) {
                await embeddingMigrationService.markAllForReembedding();
            }
            embeddingMigrationService.startBackgroundMigration().catch((error) => {
                logger.error('Background migration error', { error: error.message });
            });
            return {
                success: true,
                message: 'Migration started in background',
                progress: embeddingMigrationService.getProgress()
            };
        },
        warmup: async () => {
            const result = await embeddingProvider.warmup();
            return { success: true, ...result };
        }
    };
}

export function registerRagDiagnosticsRoutes({
    router,
    logger,
    helpers
}) {
    const {
        approvePattern,
        discoverPatterns,
        getCircuitBreakerPayload,
        getErrorsPayload,
        getGraphFillRatePayload,
        getLatestFallbackIncidentPayload,
        getMigrationStatus,
        getPatternsPayload,
        getPromotionReadinessPayload,
        getRecallAuditPayload,
        rejectPattern,
        resetCircuitBreaker,
        startMigration,
        warmup
    } = helpers;

    router.get('/loop/latest-fallback-incident', createRagRoute(
        async () => getLatestFallbackIncidentPayload(),
        {
            logger,
            logMessage: 'Failed to get rag loop latest fallback incident'
        }
    ));

    router.get('/loop/promotion-readiness', createRagRoute(
        async () => getPromotionReadinessPayload(),
        {
            logger,
            logMessage: 'Failed to get rag loop promotion readiness'
        }
    ));

    router.get('/circuit-breaker', createRagRoute(
        async () => getCircuitBreakerPayload(),
        {
            logger,
            logMessage: 'Failed to get circuit breaker status'
        }
    ));

    router.post('/circuit-breaker/reset', createRagRoute(
        async () => resetCircuitBreaker(),
        {
            logger,
            logMessage: 'Failed to reset circuit breaker'
        }
    ));

    router.post('/warmup', createRagRoute(
        async () => warmup(),
        {
            logger,
            logMessage: 'Model warmup failed',
            resolveErrorResponse: (error) => ({
                status: 500,
                body: {
                    success: false,
                    error: error.message
                }
            })
        }
    ));

    router.get('/errors', createRagRoute(
        async (req) => getErrorsPayload(req.query),
        {
            logger,
            logMessage: 'Failed to get RAG errors'
        }
    ));

    router.get('/migration/status', createRagRoute(
        async () => getMigrationStatus(),
        {
            logger,
            logMessage: 'Failed to get migration status'
        }
    ));

    router.post('/migration/start', createRagRoute(
        async (req) => startMigration(req.body || {}),
        {
            logger,
            logMessage: 'Failed to start migration'
        }
    ));

    router.get('/patterns', createRagRoute(
        async (req) => getPatternsPayload(req.query),
        {
            logger,
            logMessage: 'Failed to get patterns'
        }
    ));

    router.post('/patterns/discover', createRagRoute(
        async () => discoverPatterns()
    ));

    router.put('/patterns/:id/approve', createRagRoute(
        async (req) => approvePattern({
                id: req.params.id,
                approvedBy: req.body?.approvedBy
            }),
        {
            logger,
            logMessage: 'Failed to approve pattern'
        }
    ));

    router.put('/patterns/:id/reject', createRagRoute(
        async (req) => rejectPattern({
                id: req.params.id,
                rejectedBy: req.body?.rejectedBy,
                reason: req.body?.reason
            }),
        {
            logger,
            logMessage: 'Failed to reject pattern'
        }
    ));

    router.get('/graph/fill-rate', createRagRoute(
        async () => getGraphFillRatePayload(),
        {
            logger,
            logMessage: 'Failed to get graph fill-rate'
        }
    ));

    router.get('/retrieval/recall-audit', createRagRoute(
        async (req) => getRecallAuditPayload(req.query),
        {
            logger,
            logMessage: 'Failed to get pgvector recall audit'
        }
    ));
}
