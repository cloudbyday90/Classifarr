/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ollamaVerificationRuntimeMismatchSummaryLimiterConfig } from '../config/rateLimits.mjs';
import {
  createOllamaVerificationRuntimeMismatchSummaryService,
} from '../services/ollamaVerificationRuntimeMismatchSummaryService.mjs';

/**
 * Registers a parameter-free, administrator-authorized runtime observation.
 * It neither calls an AI provider nor exposes stored model identity or event
 * history.
 */
export function registerOllamaVerificationRuntimeMismatchSummaryRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createSummaryService = createOllamaVerificationRuntimeMismatchSummaryService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Ollama runtime mismatch summary requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Ollama runtime mismatch summary requires a rate-limit factory.');
  }

  const summaryService = createSummaryService({ database: db });
  const summaryLimiter = rateLimit(ollamaVerificationRuntimeMismatchSummaryLimiterConfig);

  router.get('/ollama-verification-runtime-mismatch-summary', requireAdmin, summaryLimiter, asyncHandler(async (_req, res) => {
    const summary = await summaryService.getSummary();
    return sendData(res, summary);
  }));
}
