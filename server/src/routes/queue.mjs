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
import queueService from '../services/queueService.mjs';
import { createLogger } from '../utils/logger.mjs';
import apiKeyAuthModule from '../middleware/apiKeyAuth.mjs';
import { createQueueRouter } from './queueRouteShared.mjs';

const { authenticateTokenOrApiKey, requireReadWrite } = apiKeyAuthModule;

const logger = createLogger('QueueRoutes');

const router = createQueueRouter({
  express,
  queueService,
  logger,
  authenticateTokenOrApiKey,
  requireReadWrite,
});

export default router;
