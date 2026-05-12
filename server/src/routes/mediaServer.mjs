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
import { query, withTransaction } from '../config/database.mjs';
import { mediaSyncService } from '../services/mediaSync.mjs';
import { queueService } from '../services/queueService.mjs';
import { isMaskedToken, maskToken } from '../utils/tokenMasking.mjs';
import { createLogger } from '../utils/logger.mjs';
import { getMediaServerService } from '../services/mediaServers/index.mjs';
import { createMediaServerRouter } from './mediaServerRouteShared.mjs';

const logger = createLogger('mediaServer');

export { createMediaServerRouter };

export const router = createMediaServerRouter({
  express,
  db: { query, withTransaction },
  mediaSyncService,
  queueService,
  getMediaServerServiceByType: getMediaServerService,
  maskTokenValue: maskToken,
  isMaskedTokenValue: isMaskedToken,
  logger,
});
