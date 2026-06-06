/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import * as db from '../config/database.mjs';
import { embeddingService } from '../services/embeddingService.mjs';
import { embeddingRouter } from '../services/embeddingRouter.mjs';
import { embeddingProvider } from '../services/embeddingProvider.mjs';
import { imageEmbeddingProvider } from '../services/imageEmbeddingProvider.mjs';
import { embeddingMigrationService } from '../services/embeddingMigrationService.mjs';
import { patternMiningService } from '../services/patternMiningService.mjs';
import { ragLoopMetricsCollector } from '../services/ragLoopMetricsCollector.mjs';
import { manualBackfillService } from '../services/manualBackfillService.mjs';
import { scheduledBackfillService } from '../services/scheduledBackfillService.mjs';
import { idleBackfillService } from '../services/idleBackfillService.mjs';
import { pgvectorRecallAuditService } from '../services/pgvectorRecallAuditService.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';
import { createLogger } from '../utils/logger.mjs';
import { isMaskedToken } from '../utils/tokenMasking.mjs';
import { getRagLoopDefaultConfig, validateAndNormalizeRagLoopConfig } from '../utils/ragLoopConfig.mjs';
import { presentEmbeddingAvailability } from '../utils/embeddingAvailabilityPresenter.mjs';
import {
    presentManualBackfillStatus,
    presentIdleBackfillStatus,
    presentScheduledBackfillStatus
} from '../utils/backfillStatusPresenter.mjs';
import {
    createRagBackfillHelpers,
    registerRagBackfillRoutes
} from './helpers/ragBackfillHelpers.mjs';
import { createRagModelMetadataHelpers } from './helpers/ragModelMetadataHelpers.mjs';
import { createRagStatusHelpers } from './helpers/ragStatusHelpers.mjs';
import {
    createRagOperationsHelpers,
    registerRagOperationsRoutes
} from './helpers/ragOperationsHelpers.mjs';
import {
    createRagDiagnosticsHelpers,
    registerRagDiagnosticsRoutes
} from './helpers/ragDiagnosticsHelpers.mjs';
import {
    createRagCoreHelpers,
    registerRagCoreRoutes
} from './helpers/ragCoreHelpers.mjs';
import { createRagRouter } from './ragRouteShared.mjs';

const logger = createLogger('RAG API');

export const router = createRagRouter({
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
    pgvectorRecallAuditService,
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
});
