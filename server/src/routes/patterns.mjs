/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import * as db from '../config/database.mjs';
import patternMiningService from '../services/patternMiningService.mjs';
import patternReinforcementService from '../services/patternReinforcementService.mjs';
import embeddingRouter from '../services/embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createPatternsRouter } from './patternsRouteShared.mjs';

const logger = createLogger('PatternsRoute');

const router = createPatternsRouter({
    express,
    db,
    logger,
    patternMiningService,
    patternReinforcementService,
    embeddingRouter,
});

export default router;
