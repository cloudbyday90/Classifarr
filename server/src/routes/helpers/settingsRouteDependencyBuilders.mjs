/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { defaultHttpClient } from '../../utils/httpClient.mjs';
import { query } from '../../config/database.mjs';
import * as databaseModule from '../../config/database.mjs';
import { radarrService as radarrServiceDefault } from '../../services/radarr.mjs';
import { sonarrService as sonarrServiceDefault } from '../../services/sonarr.mjs';
import { ollamaService as ollamaServiceDefault } from '../../services/ollama.mjs';
import { tmdbService as tmdbServiceDefault } from '../../services/tmdb.mjs';
import { discordBotService as discordBotServiceDefault } from '../../services/discordBot.mjs';
import { tavilyService as tavilyServiceDefault } from '../../services/tavily.mjs';
import { omdbService as omdbServiceDefault } from '../../services/omdb.mjs';
import { embeddingProvider as embeddingProviderDefault } from '../../services/embeddingProvider.mjs';
import { embeddingRouter as embeddingRouterDefault } from '../../services/embeddingRouter.mjs';
import { startupService as startupServiceDefault } from '../../services/startupService.mjs';
import { pathTestService as pathTestServiceDefault } from '../../services/pathTestService.mjs';
import { refreshFromDatabase } from '../../config/runtimeSettings.mjs';
import {
  getRagLoopDefaultConfig as getRagLoopDefaultConfigDefault,
  validateAndNormalizeRagLoopConfig as validateAndNormalizeRagLoopConfigDefault,
} from '../../utils/ragLoopConfig.mjs';
import {
  decryptValue as decryptValueDefault,
  encryptValue as encryptValueDefault,
  formatEncryptedValue as formatEncryptedValueDefault,
  parseEncryptedValue as parseEncryptedValueDefault,
} from '../../utils/encryption.mjs';
import {
  validateRagLoopConfigPayloadKeys as validateRagLoopConfigPayloadKeysDefault,
} from '../../utils/ragLoopPayloadValidation.mjs';
import { webhookService as webhookServiceDefault } from '../../services/webhook.mjs';
import { cloudLLMService as cloudLLMServiceDefault } from '../../services/cloudLLM.mjs';
import { aiRouterService as aiRouterServiceDefault } from '../../services/aiRouter.mjs';
import { schedulerService as schedulerServiceDefault } from '../../services/scheduler.mjs';
import { providerLock as providerLockDefault } from '../../services/providerLock.mjs';
import { autoLearningService as autoLearningServiceDefault } from '../../services/autoLearningService.mjs';
import { backfillOrchestrator as backfillOrchestratorDefault } from '../../services/backfillOrchestrator.mjs';
import { webSearchProviderStorage as webSearchProviderStorageDefault } from '../../services/webSearchProviderStorage.mjs';
import { webSearchProviderRegistry as webSearchProviderRegistryDefault } from '../../services/webSearchProviderRegistry.mjs';
import { webSearchProviderRouter as webSearchProviderRouterDefault } from '../../services/webSearchProviderRouter.mjs';

export const defaultDatabase = { query, withTransaction: databaseModule.withTransaction };
export const defaultRuntimeSettings = { refreshFromDatabase };

export function createArrSettingsDependencies({
  database = defaultDatabase,
  radarrService = radarrServiceDefault,
  sonarrService = sonarrServiceDefault,
} = {}) {
  return {
    database,
    radarrService,
    sonarrService,
  };
}

export function createAiSettingsDependencies({
  database = defaultDatabase,
  logger,
  embeddingProvider = embeddingProviderDefault,
  embeddingRouter = embeddingRouterDefault,
  ollamaService = ollamaServiceDefault,
  tmdbService = tmdbServiceDefault,
  tavilyService = tavilyServiceDefault,
  omdbService = omdbServiceDefault,
  cloudLLMService = cloudLLMServiceDefault,
  aiRouterService = aiRouterServiceDefault,
  autoLearningService = autoLearningServiceDefault,
  backfillOrchestratorService = backfillOrchestratorDefault,
  schedulerService = schedulerServiceDefault,
  getRagLoopDefaultConfig = getRagLoopDefaultConfigDefault,
  validateAndNormalizeRagLoopConfig = validateAndNormalizeRagLoopConfigDefault,
  encryptValue = encryptValueDefault,
  formatEncryptedValue = formatEncryptedValueDefault,
  parseEncryptedValue = parseEncryptedValueDefault,
  decryptValue = decryptValueDefault,
  validateRagLoopConfigPayloadKeys = validateRagLoopConfigPayloadKeysDefault,
  webSearchProviderStorage = webSearchProviderStorageDefault,
  webSearchProviderRegistry = webSearchProviderRegistryDefault,
  webSearchProviderRouter = null,
} = {}) {
  const routeDiagnosticsRouter = webSearchProviderRouter
    || webSearchProviderRouterDefault.withDependencies({
      storage: webSearchProviderStorage,
      registry: webSearchProviderRegistry,
    });

  return {
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
    backfillOrchestratorService,
    encryptValue,
    formatEncryptedValue,
    parseEncryptedValue,
    decryptValue,
    webSearchProviderStorage,
    webSearchProviderRegistry,
    webSearchProviderRouter: routeDiagnosticsRouter,
  };
}

export function createOperationalSettingsDependencies({
  database = defaultDatabase,
  logger,
  discordBotService = discordBotServiceDefault,
  httpClient = defaultHttpClient,
  pathTestService = pathTestServiceDefault,
  startupService = startupServiceDefault,
  runtimeSettings = defaultRuntimeSettings,
  webhookService = webhookServiceDefault,
  providerLock = providerLockDefault,
} = {}) {
  return {
    database,
    logger,
    discordBotService,
    webhookService,
    httpClient,
    pathTestService,
    providerLock,
    startupService,
    runtimeSettings,
  };
}
