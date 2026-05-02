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
import plexOAuth from '../services/plexOAuth.mjs';
import db from '../config/database.mjs';
import authModule from '../middleware/auth.mjs';
import loggerModule from '../utils/logger.mjs';
import { createPlexOAuthRouter } from './plexOAuthRouteShared.mjs';

const { authenticateToken } = authModule;
const { createLogger } = loggerModule;

const logger = createLogger('plexOAuth');

const router = createPlexOAuthRouter({
  express,
  plexOAuth,
  db,
  authenticateToken,
  logger,
});

export default router;
