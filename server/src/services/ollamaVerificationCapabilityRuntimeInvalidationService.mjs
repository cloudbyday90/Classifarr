/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  buildOllamaVerificationCapabilityRuntimeInvalidationTarget,
} from './ollamaVerificationCapabilityRuntimeInvalidation.mjs';
import {
  markOllamaVerificationCapabilityModelChanged,
} from './ollamaVerificationCapabilityRuntimeInvalidationRepository.mjs';

/**
 * Makes an observed local-model retag actionable without turning telemetry
 * persistence into an availability dependency for classification. The
 * triggering request is already blocked by preflight; a write failure merely
 * leaves the next request to repeat that same fail-closed check.
 */
export function createOllamaVerificationCapabilityRuntimeInvalidationService({
  database = db,
  logger = createLogger('OllamaVerificationCapabilityRuntimeInvalidation'),
  buildTarget = buildOllamaVerificationCapabilityRuntimeInvalidationTarget,
  markModelChanged = markOllamaVerificationCapabilityModelChanged,
} = {}) {
  return Object.freeze({
    async invalidateFromGenerationError(observation = {}) {
      const target = buildTarget(observation);
      if (!target) return false;

      try {
        return await markModelChanged(database, target);
      } catch {
        logger.warn('Ollama verification capability runtime invalidation failed', {
          failureCode: 'persistence_unavailable',
        });
        return false;
      }
    },
  });
}

export const ollamaVerificationCapabilityRuntimeInvalidationService =
  createOllamaVerificationCapabilityRuntimeInvalidationService();
