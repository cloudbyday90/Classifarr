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

export function createAiHandlerDescriptors(aiSettingsDependencies, logger) {
  const {
    autoLearningService,
    database: db,
    ollamaService,
    omdbService,
    schedulerService,
    tavilyService,
    tmdbService,
  } = aiSettingsDependencies;

  return [
    {
      key: 'aiHandlers',
      create: () => createAiSettingsHandlers({
        ...aiSettingsDependencies,
        db,
        resolveRequestApiKey,
      }),
    },
    {
      key: 'confidenceSettingsHandlers',
      create: () => createConfidenceSettingsHandlers({
        db,
        logger,
        autoLearningService,
      }),
    },
    {
      key: 'metadataProviderHandlers',
      create: () => createMetadataProviderSettingsHandlers({
        db,
        logger,
        tmdbService,
        tavilyService,
        omdbService,
        schedulerService,
      }),
    },
    {
      key: 'ollamaHandlers',
      create: () => createOllamaSettingsHandlers({
        db,
        ollamaService,
      }),
    },
  ];
}

export function createOperationalHandlerDescriptors(operationalSettingsDependencies) {
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

  return [
    {
      key: 'discordHandlers',
      create: () => createDiscordSettingsHandlers({
        db,
        discordBotService,
        logger,
      }),
    },
    {
      key: 'generalSettingsHandlers',
      create: () => createGeneralSettingsHandlers({
        db,
        runtimeSettings,
      }),
    },
    {
      key: 'pathTestingHandlers',
      create: () => createPathTestingHandlers({
        pathTestService,
      }),
    },
    {
      key: 'providerLockHandlers',
      create: () => createProviderLockHandlers({
        providerLock,
      }),
    },
    {
      key: 'setupHandlers',
      create: () => createSetupHandlers({
        startupService,
      }),
    },
    {
      key: 'sslHandlers',
      create: () => createSslSettingsHandlers({
        db,
      }),
    },
    {
      key: 'sslTestLimiter',
      create: () => rateLimit(sslTestLimiterConfig),
    },
    {
      key: 'webhookHandlers',
      create: () => createWebhookSettingsHandlers({
        webhookService,
        httpClient,
      }),
    },
  ];
}