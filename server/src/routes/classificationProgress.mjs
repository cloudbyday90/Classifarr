/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import { classificationPhaseService } from '../services/classificationPhaseService.mjs';
import loggerModule from '../utils/logger.mjs';
import { createClassificationProgressRouter } from './classificationProgressRouteShared.mjs';

const { createLogger } = loggerModule;
const logger = createLogger('ClassificationProgressRoute');

const router = createClassificationProgressRouter({
  express,
  classificationPhaseService,
  logger,
});

export default router;
