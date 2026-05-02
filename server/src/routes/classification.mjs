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
import classificationService from '../services/classification.mjs';
import classificationRetryService from '../services/classificationRetryService.mjs';
import classificationOutcomeService from '../services/classificationOutcomeService.mjs';
import clarificationService from '../services/clarificationService.mjs';
import classificationEvidenceService from '../services/classificationEvidenceService.mjs';
import classificationEvidenceReinforcementService from '../services/classificationEvidenceReinforcementService.mjs';
import signalCollectorModule from '../services/signalCollector.mjs';
import loggerModule from '../utils/logger.mjs';
import apiKeyAuthModule from '../middleware/apiKeyAuth.mjs';
import classificationFlowConstants from '../constants/classificationFlow.shared.js';
import reclassificationService from '../services/reclassificationService.mjs';
import { createClassificationRouter } from './classificationRouteShared.mjs';

const { PATTERN_SIGNAL_TYPES } = signalCollectorModule;
const { createLogger } = loggerModule;
const { requireReadWrite } = apiKeyAuthModule;
const { STALE_AWAITING_DECISION_DAYS } = classificationFlowConstants;

const router = createClassificationRouter({
  express,
  db,
  classificationService,
  classificationRetryService,
  classificationOutcomeService,
  clarificationService,
  classificationEvidenceService,
  classificationEvidenceReinforcementService,
  PATTERN_SIGNAL_TYPES,
  createLogger,
  requireReadWrite,
  STALE_AWAITING_DECISION_DAYS,
  loadReclassificationService: () => reclassificationService,
});

export default router;
