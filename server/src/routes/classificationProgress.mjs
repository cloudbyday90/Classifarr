/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import { classificationPhaseService } from '../services/classificationPhaseService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createClassificationProgressRouter } from './classificationProgressRouteShared.mjs';

const logger = createLogger('ClassificationProgressRoute');

export const router = createClassificationProgressRouter({
  express,
  classificationPhaseService,
  logger,
});
