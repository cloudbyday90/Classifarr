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
import db from '../config/database.mjs';
import loggerModule from '../utils/logger.mjs';
import apiKeyAuthModule from '../middleware/apiKeyAuth.mjs';
import { createStatsRouter } from './statsRouteShared.mjs';

const { createLogger } = loggerModule;
const { authenticateTokenOrApiKey } = apiKeyAuthModule;

const logger = createLogger('StatsRoutes');

const router = createStatsRouter({
  express,
  db,
  logger,
  authenticateTokenOrApiKey,
});

export default router;
