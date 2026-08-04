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
import * as db from '../config/database.mjs';
import { classificationService } from '../services/classification.mjs';
import { classificationRetryService } from '../services/classificationRetryService.mjs';
import { clarificationService } from '../services/clarificationService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { requireReadWrite } from '../middleware/apiKeyAuth.mjs';
import { STALE_AWAITING_DECISION_DAYS } from '../constants/classificationFlow.mjs';
import { reclassificationService } from '../services/reclassificationService.mjs';
import {
  PolicyRuntimePendingQuestionCleanupInventoryService,
} from '../services/policyRuntimePendingQuestionCleanupInventoryService.mjs';
import { createClassificationRouter } from './classificationRouteShared.mjs';

const policyRuntimePendingQuestionCleanupInventoryService =
  new PolicyRuntimePendingQuestionCleanupInventoryService({ db });

export const router = createClassificationRouter({
  express,
  db,
  classificationService,
  classificationRetryService,
  clarificationService,
  createLogger,
  requireReadWrite,
  STALE_AWAITING_DECISION_DAYS,
  reclassificationService,
  policyRuntimePendingQuestionCleanupInventoryService,
});
