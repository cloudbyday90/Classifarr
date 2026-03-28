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
const embeddingMigrationService = require('../services/embeddingMigrationService');
const patternMiningService = require('../services/patternMiningService');
const ragLoopMetricsCollector = require('../services/ragLoopMetricsCollector');
const manualBackfillService = require('../services/manualBackfillService');
const scheduledBackfillService = require('../services/scheduledBackfillService');
const idleBackfillService = require('../services/idleBackfillService');
const ragLogger = require('../utils/ragLogger');
const { createLogger } = require('../utils/logger');
const { isMaskedToken } = require('../utils/tokenMasking');
const { getRagLoopDefaultConfig, validateAndNormalizeRagLoopConfig } = require('../utils/ragLoopConfig');
const { presentEmbeddingAvailability } = require('../utils/embeddingAvailabilityPresenter');
const {
    presentManualBackfillStatus,
    presentIdleBackfillStatus,
    presentScheduledBackfillStatus
} = require('../utils/backfillStatusPresenter');
const { createRagBackfillHelpers, registerRagBackfillRoutes } = require('./helpers/ragBackfillHelpers');
const { createRagModelMetadataHelpers } = require('./helpers/ragModelMetadataHelpers');
const { createRagStatusHelpers } = require('./helpers/ragStatusHelpers');
const { createRagOperationsHelpers, registerRagOperationsRoutes } = require('./helpers/ragOperationsHelpers');
const { createRagDiagnosticsHelpers, registerRagDiagnosticsRoutes } = require('./helpers/ragDiagnosticsHelpers');
const { createRagCoreHelpers, registerRagCoreRoutes } = require('./helpers/ragCoreHelpers');

const logger = createLogger('RAG API');

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

module.exports = router;
