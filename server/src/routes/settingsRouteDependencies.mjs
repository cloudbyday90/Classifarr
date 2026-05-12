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

import { defaultHttpClient } from '../utils/httpClient.mjs';
import * as db from '../config/database.mjs';
import { radarrService as radarrServiceDefault } from '../services/radarr.mjs';
import { sonarrService as sonarrServiceDefault } from '../services/sonarr.mjs';
import { ollamaService as ollamaServiceDefault } from '../services/ollama.mjs';
import { tmdbService as tmdbServiceDefault } from '../services/tmdb.mjs';
import { discordBotService as discordBotServiceDefault } from '../services/discordBot.mjs';
import { tavilyService as tavilyServiceDefault } from '../services/tavily.mjs';
import { omdbService as omdbServiceDefault } from '../services/omdb.mjs';
import { embeddingProvider as embeddingProviderDefault } from '../services/embeddingProvider.mjs';
import { embeddingRouter as embeddingRouterDefault } from '../services/embeddingRouter.mjs';
import { startupService as startupServiceDefault } from '../services/startupService.mjs';
import { pathTestService as pathTestServiceDefault } from '../services/pathTestService.mjs';
import * as runtimeSettingsDefault from '../config/runtimeSettings.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as ragLoopConfigModule from '../utils/ragLoopConfig.mjs';
import * as encryptionModule from '../utils/encryption.mjs';
import { validateRagLoopConfigPayloadKeys } from '../utils/ragLoopPayloadValidation.mjs';
import { webhookService as webhookServiceDefault } from '../services/webhook.mjs';
import { cloudLLMService as cloudLLMServiceDefault } from '../services/cloudLLM.mjs';
import { aiRouterService as aiRouterServiceDefault } from '../services/aiRouter.mjs';
import { schedulerService as schedulerServiceDefault } from '../services/scheduler.mjs';
import { providerLock as providerLockDefault } from '../services/providerLock.mjs';
import { autoLearningService as autoLearningServiceDefault } from '../services/autoLearningService.mjs';
import {
  createAiSettingsRouteHandlers,
  createArrSettingsRouteHandlers,
  createOperationalSettingsRouteHandlers,
} from './helpers/settingsRouteHandlerGroups.mjs';

export function createSettingsRouteDependencies({
  database = db,
  radarrService = radarrServiceDefault,
  sonarrService = sonarrServiceDefault,
  discordBotService = discordBotServiceDefault,
  httpClient = defaultHttpClient,
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

  return {
    ...createArrSettingsRouteHandlers({
      database,
      radarrService,
      sonarrService,
    }),
    ...createAiSettingsRouteHandlers({
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
    }),
    ...createOperationalSettingsRouteHandlers({
      database,
      logger,
      discordBotService,
      webhookService,
      httpClient,
      pathTestService,
      providerLock,
      startupService,
      runtimeSettings,
    }),
  };
}
