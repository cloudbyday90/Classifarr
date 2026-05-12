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
import { sslTestLimiterConfig } from '../config/rateLimits.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  createAiSettingsDependencies,
  createArrSettingsDependencies,
  createOperationalSettingsDependencies,
} from './helpers/settingsRouteDependencyBuilders.mjs';
import { createAiSettingsHandlers } from './helpers/aiSettingsHandlers.mjs';
import { createArrSettingsRouteHandlers } from './helpers/arrSettingsRouteHandlers.mjs';
import { createConfidenceSettingsHandlers } from './helpers/confidenceSettingsHandlers.mjs';
import { createDiscordSettingsHandlers } from './helpers/discordSettingsHandlers.mjs';
import { createGeneralSettingsHandlers } from './helpers/generalSettingsHandlers.mjs';
import { createMetadataProviderSettingsHandlers } from './helpers/metadataProviderSettingsHandlers.mjs';
import { createOllamaSettingsHandlers } from './helpers/ollamaSettingsHandlers.mjs';
import { createPathTestingHandlers } from './helpers/pathTestingHandlers.mjs';
import { createProviderLockHandlers } from './helpers/providerLockHandlers.mjs';
import { resolveRequestApiKey } from './helpers/providerConfigHelpers.mjs';
import { createSetupHandlers } from './helpers/setupHandlers.mjs';
import { createSslSettingsHandlers } from './helpers/sslSettingsHandlers.mjs';
import { createWebhookSettingsHandlers } from './helpers/webhookSettingsHandlers.mjs';

function createAiHandlerGroups(aiSettingsDependencies, logger) {
  const {
    autoLearningService,
    database: db,
    ollamaService,
    omdbService,
    schedulerService,
    tavilyService,
    tmdbService,
  } = aiSettingsDependencies;
  const sharedHandlerDependencies = { db, logger };

  return {
    aiHandlers: createAiSettingsHandlers({
      ...aiSettingsDependencies,
      db,
      resolveRequestApiKey,
    }),
    confidenceSettingsHandlers: createConfidenceSettingsHandlers({
      ...sharedHandlerDependencies,
      autoLearningService,
    }),
    metadataProviderHandlers: createMetadataProviderSettingsHandlers({
      ...sharedHandlerDependencies,
      tmdbService,
      tavilyService,
      omdbService,
      schedulerService,
    }),
    ollamaHandlers: createOllamaSettingsHandlers({
      db,
      ollamaService,
    }),
  };
}

function createOperationalHandlerGroups(operationalSettingsDependencies) {
  const {
    database: db,
    discordBotService,
    httpClient,
    logger,
    pathTestService,
    providerLock,
    runtimeSettings,
    startupService,
    webhookService,
  } = operationalSettingsDependencies;
  const sharedHandlerDependencies = { db };

  return {
    discordHandlers: createDiscordSettingsHandlers({
      ...sharedHandlerDependencies,
      discordBotService,
      logger,
    }),
    generalSettingsHandlers: createGeneralSettingsHandlers({
      ...sharedHandlerDependencies,
      runtimeSettings,
    }),
    pathTestingHandlers: createPathTestingHandlers({
      pathTestService,
    }),
    providerLockHandlers: createProviderLockHandlers({
      providerLock,
    }),
    setupHandlers: createSetupHandlers({
      startupService,
    }),
    sslHandlers: createSslSettingsHandlers({
      ...sharedHandlerDependencies,
    }),
    sslTestLimiter: rateLimit(sslTestLimiterConfig),
    webhookHandlers: createWebhookSettingsHandlers({
      webhookService,
      httpClient,
    }),
  };
}

export function createSettingsRouteDependencies({
  ...dependencyOverrides
} = {}) {
  const logger = createLogger('SettingsRoutes');
  const aiSettingsDependencies = createAiSettingsDependencies({
    ...dependencyOverrides,
    logger,
  });
  const operationalSettingsDependencies = createOperationalSettingsDependencies({
    ...dependencyOverrides,
    logger,
  });

  return {
    ...createArrSettingsRouteHandlers(
      createArrSettingsDependencies(dependencyOverrides),
    ),
    ...createAiHandlerGroups(aiSettingsDependencies, logger),
    ...createOperationalHandlerGroups(operationalSettingsDependencies),
  };
}
