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
import { queueService } from '../services/queueService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { authenticateTokenOrApiKey, requireReadWrite } from '../middleware/apiKeyAuth.mjs';
import { createQueueRouter } from './queueRouteShared.mjs';
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
});
