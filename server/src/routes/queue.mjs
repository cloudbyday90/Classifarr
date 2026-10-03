/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { registerManualRoutingCheckRoute } from './queueRouteManualRoutingCheck.mjs';
import { createManualRoutingCheckCoordinator } from '../services/manualRoutingCheckCoordinator.mjs';
import { registerRetryReadinessRoute } from './queueRouteRetryReadiness.mjs';
import { createRetryReadinessService } from '../services/retryReadinessService.mjs';
import { queueService } from '../services/queueService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { authenticateTokenOrApiKey, requireReadWrite } from '../middleware/apiKeyAuth.mjs';
import { createQueueRouter } from './queueRouteShared.mjs';
import { classificationPolicyPathService } from '../services/classificationPolicyPathService.mjs';
import {
  classificationQueueDecisionWitnessReadService,
} from '../services/classificationQueueDecisionWitnessReadService.mjs';

const logger = createLogger('QueueRoutes');

export const router = createQueueRouter({
  express,
  queueService,
  logger,
  authenticateTokenOrApiKey,
  requireReadWrite,
  decisionWitnessReadService: classificationQueueDecisionWitnessReadService,
  readLibraryEvaluationStatus: () => classificationPolicyPathService.readLibraryEvaluationStatus(),
});

registerRetryReadinessRoute(router, {
  requireAdmin,
  limiter: rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }),
  service: createRetryReadinessService(),
  omdbService: createRetryReadinessService({ scope: 'omdb' }),
});

registerManualRoutingCheckRoute(router, {
  requireAdmin,
  limiter: rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }),
  service: createManualRoutingCheckCoordinator(),
});
