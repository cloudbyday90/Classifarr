/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createAiSettingsHandlers } from './aiSettingsHandlers.mjs';
import { createConfidenceSettingsHandlers } from './confidenceSettingsHandlers.mjs';
import { createMetadataProviderSettingsHandlers } from './metadataProviderSettingsHandlers.mjs';
import { createOllamaSettingsHandlers } from './ollamaSettingsHandlers.mjs';
import { resolveRequestApiKey } from './providerConfigHelpers.mjs';

export function createAiSettingsRouteHandlers({
  database,
  logger,
  cloudLLMService,
  aiRouterService,
  ollamaService,
  embeddingProvider,
  embeddingRouter,
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
  validateRagLoopConfigPayloadKeys,
  tmdbService,
  tavilyService,
  omdbService,
  schedulerService,
  autoLearningService,
  encryptValue,
  formatEncryptedValue,
  parseEncryptedValue,
  decryptValue,
}) {
  const ollamaHandlers = createOllamaSettingsHandlers({
    db: database,
    ollamaService,
  });

  const aiHandlers = createAiSettingsHandlers({
    db: database,
    logger,
    cloudLLMService,
    aiRouterService,
    ollamaService,
    embeddingProvider,
    embeddingRouter,
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig,
    validateRagLoopConfigPayloadKeys,
    resolveRequestApiKey,
    encryptValue,
    formatEncryptedValue,
    parseEncryptedValue,
    decryptValue,
  });

  const metadataProviderHandlers = createMetadataProviderSettingsHandlers({
    db: database,
    logger,
    tmdbService,
    tavilyService,
    omdbService,
    schedulerService,
  });

  const confidenceSettingsHandlers = createConfidenceSettingsHandlers({
    db: database,
    logger,
    autoLearningService,
  });

  return {
    aiHandlers,
    confidenceSettingsHandlers,
    metadataProviderHandlers,
    ollamaHandlers,
  };
}