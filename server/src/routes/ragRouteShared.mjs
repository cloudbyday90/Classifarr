/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createRagRouter({
    express,
    db,
    embeddingService,
    embeddingRouter,
    embeddingProvider,
    imageEmbeddingProvider,
    embeddingMigrationService,
    patternMiningService,
    ragLoopMetricsCollector,
    manualBackfillService,
    scheduledBackfillService,
    idleBackfillService,
    ragLogger,
    isMaskedToken,
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig,
    presentEmbeddingAvailability,
    presentManualBackfillStatus,
    presentIdleBackfillStatus,
    presentScheduledBackfillStatus,
    createRagBackfillHelpers,
    registerRagBackfillRoutes,
    createRagModelMetadataHelpers,
    createRagStatusHelpers,
    createRagOperationsHelpers,
    registerRagOperationsRoutes,
    createRagDiagnosticsHelpers,
    registerRagDiagnosticsRoutes,
    createRagCoreHelpers,
    registerRagCoreRoutes,
    logger
}) {
const router = express.Router();

const isEmbeddingProviderConfigured = (config) => {
    if (!config) {
        return false;
    }

    const mode = config.embedding_provider_mode || 'same';
    if (mode === 'same') {
        return !!(config.primary_provider && config.primary_provider !== 'none');
    }

    if (mode === 'separate_ollama') {
        return !!config.embedding_ollama_host;
    }

    if (mode === 'cloud') {
        return !!config.embedding_cloud_api_key;
    }

    return false;
};

const ragBackfillHelpers = createRagBackfillHelpers({
    db,
    embeddingService,
    manualBackfillService,
    scheduledBackfillService,
    idleBackfillService,
    presentEmbeddingAvailability,
    presentManualBackfillStatus,
    presentIdleBackfillStatus,
    presentScheduledBackfillStatus
});
const {
    resolveEmbeddingAvailability
} = ragBackfillHelpers;
registerRagBackfillRoutes({
    router,
    logger,
    embeddingService,
    manualBackfillService,
    presentManualBackfillStatus,
    helpers: ragBackfillHelpers
});
const {
    resolveImageModelMetadata,
    resolveTextModelMetadata
} = createRagModelMetadataHelpers({
    db,
    logger,
    isMaskedToken,
    embeddingRouter,
    embeddingProvider,
    imageEmbeddingProvider
});
const {
    getCostsPayload,
    getDetailedPayload,
    getHealthPayload,
    getMetricsPayload,
    getOverviewPayload,
    getStatusPayload,
    parseDetailedHours
} = createRagStatusHelpers({
    db,
    ragLogger,
    embeddingService,
    embeddingRouter,
    embeddingProvider,
    imageEmbeddingProvider,
    getBackfillHistoryPayload: ragBackfillHelpers.getBackfillHistoryPayload,
    resolveEmbeddingAvailability,
    isEmbeddingProviderConfigured
});
const ragOperationsHelpers = createRagOperationsHelpers({ db });
registerRagOperationsRoutes({
    router,
    logger,
    helpers: ragOperationsHelpers
});
const ragDiagnosticsHelpers = createRagDiagnosticsHelpers({
    db,
    logger,
    embeddingRouter,
    embeddingProvider,
    embeddingMigrationService,
    patternMiningService,
    ragLoopMetricsCollector,
    ragLogger,
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig
});
registerRagDiagnosticsRoutes({
    router,
    logger,
    helpers: ragDiagnosticsHelpers
});
const ragCoreHelpers = createRagCoreHelpers({
    isMaskedToken,
    embeddingProvider,
    imageEmbeddingProvider,
    resolveImageModelMetadata,
    resolveTextModelMetadata,
    getStatusPayload,
    getOverviewPayload,
    getHealthPayload,
    getCostsPayload,
    getDetailedPayload,
    getMetricsPayload,
    parseDetailedHours
});
registerRagCoreRoutes({
    router,
    logger,
    helpers: ragCoreHelpers
});

return router;
}
