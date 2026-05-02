/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import classificationUtilsService from './classificationUtilsService.shared.js';

export const {
  resolveRagLoopTimeout,
  withTimeout,
  sleep,
  withRetryableDbConflict,
  isAiTransientAvailabilityError,
  buildParseDiagnostics,
  resolveRetryReason,
  buildPendingRetryResult,
  RAG_LOOP_MIN_TIMEOUT_MS,
  RAG_LOOP_MAX_TIMEOUT_MS,
  RETRY_DELAY_MS,
  AI_PARSE_CONTRACT_VERSION,
} = classificationUtilsService;

export default classificationUtilsService;
