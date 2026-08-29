/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ollamaVerificationCapabilityOutcomeHistoryLimiterConfig } from '../config/rateLimits.mjs';
import {
  createOllamaVerificationCapabilityOutcomeHistoryService,
} from '../services/ollamaVerificationCapabilityOutcomeHistoryService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers an administrator-only, parameter-free aggregate. It never calls
 * Ollama and exposes no individual test event or provider configuration.
 */
export function registerOllamaVerificationCapabilityOutcomeHistoryRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createHistoryService = createOllamaVerificationCapabilityOutcomeHistoryService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Ollama verification outcome history requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Ollama verification outcome history requires a rate-limit factory.');
  }

  const historyService = createHistoryService({ database: db });
  const historyLimiter = rateLimit(ollamaVerificationCapabilityOutcomeHistoryLimiterConfig);

  router.get('/ollama-verification-capability-outcomes', requireAdmin, historyLimiter, asyncHandler(async (_req, res) => {
    return sendData(res, await historyService.getHistory());
  }));
}
