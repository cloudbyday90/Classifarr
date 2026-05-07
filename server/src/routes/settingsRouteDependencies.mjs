/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import axios from 'axios';
import rateLimit from 'express-rate-limit';
import * as db from '../config/database.mjs';
import radarrServiceDefault from '../services/radarr.mjs';
import sonarrServiceDefault from '../services/sonarr.mjs';
import ollamaServiceDefault from '../services/ollama.mjs';
import tmdbServiceDefault from '../services/tmdb.mjs';
import discordBotServiceDefault from '../services/discordBot.mjs';
import tavilyServiceDefault from '../services/tavily.mjs';
import omdbServiceDefault from '../services/omdb.mjs';
import embeddingProviderDefault from '../services/embeddingProvider.mjs';
import embeddingRouterDefault from '../services/embeddingRouter.mjs';
import startupServiceDefault from '../services/startupService.mjs';
import pathTestServiceDefault from '../services/pathTestService.mjs';
import runtimeSettingsDefault from '../config/runtimeSettings.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as ragLoopConfigModule from '../utils/ragLoopConfig.mjs';
import * as encryptionModule from '../utils/encryption.mjs';
import { validateRagLoopConfigPayloadKeys } from '../utils/ragLoopPayloadValidation.mjs';
import webhookServiceDefault from '../services/webhook.mjs';
import cloudLLMServiceDefault from '../services/cloudLLM.mjs';
import aiRouterServiceDefault from '../services/aiRouter.mjs';
import schedulerServiceDefault from '../services/scheduler.mjs';
import providerLockDefault from '../services/providerLock.mjs';
import autoLearningServiceDefault from '../services/autoLearningService.mjs';
import { createArrConfigHandlers, createArrConfigStatusHandler } from './helpers/arrConfigHandlers.mjs';
import { createAiSettingsHandlers } from './helpers/aiSettingsHandlers.mjs';
import { createDiscordSettingsHandlers } from './helpers/discordSettingsHandlers.mjs';
import { createSslSettingsHandlers } from './helpers/sslSettingsHandlers.mjs';
import { createWebhookSettingsHandlers } from './helpers/webhookSettingsHandlers.mjs';
import { resolveRequestApiKey } from './helpers/providerConfigHelpers.mjs';
import { createMetadataProviderSettingsHandlers } from './helpers/metadataProviderSettingsHandlers.mjs';
import { createOllamaSettingsHandlers } from './helpers/ollamaSettingsHandlers.mjs';
import { createPathTestingHandlers } from './helpers/pathTestingHandlers.mjs';
import { createProviderLockHandlers } from './helpers/providerLockHandlers.mjs';
import { createSetupHandlers } from './helpers/setupHandlers.mjs';
import { createGeneralSettingsHandlers } from './helpers/generalSettingsHandlers.mjs';
import { createConfidenceSettingsHandlers } from './helpers/confidenceSettingsHandlers.mjs';

export function createSettingsRouteDependencies({
  database = db,
  radarrService = radarrServiceDefault,
  sonarrService = sonarrServiceDefault,
  discordBotService = discordBotServiceDefault,
  httpClient = axios,
  embeddingProvider = embeddingProviderDefault,
  embeddingRouter = embeddingRouterDefault,
  ollamaService = ollamaServiceDefault,
  tmdbService = tmdbServiceDefault,
  tavilyService = tavilyServiceDefault,
  omdbService = omdbServiceDefault,
  pathTestService = pathTestServiceDefault,
  cloudLLMService = cloudLLMServiceDefault,
  aiRouterService = aiRouterServiceDefault,
  autoLearningService = autoLearningServiceDefault,
  schedulerService = schedulerServiceDefault,
  startupService = startupServiceDefault,
  runtimeSettings = runtimeSettingsDefault,
  webhookService = webhookServiceDefault,
  providerLock = providerLockDefault,
  getRagLoopDefaultConfig = ragLoopConfigModule.getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig = ragLoopConfigModule.validateAndNormalizeRagLoopConfig,
  encryptValue = encryptionModule.encryptValue,
  formatEncryptedValue = encryptionModule.formatEncryptedValue,
  parseEncryptedValue = encryptionModule.parseEncryptedValue,
  decryptValue = encryptionModule.decryptValue,
} = {}) {
  const logger = createLogger('SettingsRoutes');

  const radarrHandlers = createArrConfigHandlers({
    db: database,
    table: 'radarr_config',
    entityLabel: 'Radarr',
    service: radarrService,
    defaultPort: 7878,
    extraColumns: ['media_server_id', 'quality_profile_id', 'minimum_availability'],
    createDefaults: {
      media_server_id: null,
      quality_profile_id: null,
      minimum_availability: 'released',
    },
  });

  const sonarrHandlers = createArrConfigHandlers({
    db: database,
    table: 'sonarr_config',
    entityLabel: 'Sonarr',
    service: sonarrService,
    defaultPort: 8989,
    extraColumns: ['media_server_id', 'quality_profile_id', 'monitor', 'series_type'],
    createDefaults: {
      media_server_id: null,
      quality_profile_id: null,
      monitor: 'all',
      series_type: 'standard',
    },
  });

  const arrConfigStatusHandler = createArrConfigStatusHandler({ db: database });

  const discordHandlers = createDiscordSettingsHandlers({
    db: database,
    discordBotService,
    logger,
  });

  const webhookHandlers = createWebhookSettingsHandlers({
    webhookService,
    httpClient,
  });

  const sslHandlers = createSslSettingsHandlers({ db: database });

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

  const pathTestingHandlers = createPathTestingHandlers({
    pathTestService,
  });

  const providerLockHandlers = createProviderLockHandlers({
    providerLock,
  });

  const setupHandlers = createSetupHandlers({
    startupService,
  });

  const generalSettingsHandlers = createGeneralSettingsHandlers({
    db: database,
    runtimeSettings,
  });

  const confidenceSettingsHandlers = createConfidenceSettingsHandlers({
    db: database,
    logger,
    autoLearningService,
  });

  const sslTestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many SSL test attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return {
    arrConfigStatusHandler,
    aiHandlers,
    confidenceSettingsHandlers,
    discordHandlers,
    generalSettingsHandlers,
    metadataProviderHandlers,
    ollamaHandlers,
    pathTestingHandlers,
    providerLockHandlers,
    radarrHandlers,
    setupHandlers,
    sonarrHandlers,
    sslHandlers,
    sslTestLimiter,
    webhookHandlers,
  };
}

export default {
  createSettingsRouteDependencies,
};
