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

import rateLimit from 'express-rate-limit';
import { sslTestLimiterConfig } from '../../config/rateLimits.mjs';
import { createArrConfigHandlers, createArrConfigStatusHandler } from './arrConfigHandlers.mjs';
import { createAiSettingsHandlers } from './aiSettingsHandlers.mjs';
import { createConfidenceSettingsHandlers } from './confidenceSettingsHandlers.mjs';
import { createDiscordSettingsHandlers } from './discordSettingsHandlers.mjs';
import { createGeneralSettingsHandlers } from './generalSettingsHandlers.mjs';
import { createMetadataProviderSettingsHandlers } from './metadataProviderSettingsHandlers.mjs';
import { createOllamaSettingsHandlers } from './ollamaSettingsHandlers.mjs';
import { createPathTestingHandlers } from './pathTestingHandlers.mjs';
import { createProviderLockHandlers } from './providerLockHandlers.mjs';
import { resolveRequestApiKey } from './providerConfigHelpers.mjs';
import { createSetupHandlers } from './setupHandlers.mjs';
import { createSslSettingsHandlers } from './sslSettingsHandlers.mjs';
import { createWebhookSettingsHandlers } from './webhookSettingsHandlers.mjs';

export function createArrSettingsRouteHandlers({
  database,
  radarrService,
  sonarrService,
}) {
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

  return {
    arrConfigStatusHandler: createArrConfigStatusHandler({ db: database }),
    radarrHandlers,
    sonarrHandlers,
  };
}

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

export function createOperationalSettingsRouteHandlers({
  database,
  logger,
  discordBotService,
  webhookService,
  httpClient,
  pathTestService,
  providerLock,
  startupService,
  runtimeSettings,
}) {
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

  return {
    discordHandlers,
    generalSettingsHandlers,
    pathTestingHandlers,
    providerLockHandlers,
    setupHandlers,
    sslHandlers,
    sslTestLimiter: rateLimit(sslTestLimiterConfig),
    webhookHandlers,
  };
}
