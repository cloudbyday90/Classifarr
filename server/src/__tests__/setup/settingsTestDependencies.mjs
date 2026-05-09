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

import database from '../../config/database.mjs';
import { authenticateToken, requireAdmin } from '../../middleware/auth.mjs';
import { createSettingsRouteDependencies } from '../../routes/settingsRouteDependencies.mjs';
import { createSettingsRouter } from '../../routes/settingsRouteShared.mjs';
import { aiRouterService } from '../../services/aiRouter.mjs';
import { autoLearningService } from '../../services/autoLearningService.mjs';
import { cloudLLMService } from '../../services/cloudLLM.mjs';
import { discordBotService } from '../../services/discordBot.mjs';
import { embeddingProvider } from '../../services/embeddingProvider.mjs';
import { embeddingRouter } from '../../services/embeddingRouter.mjs';
import { ollamaService } from '../../services/ollama.mjs';
import { omdbService } from '../../services/omdb.mjs';
import { pathTestService } from '../../services/pathTestService.mjs';
import { providerLock } from '../../services/providerLock.mjs';
import { radarrService } from '../../services/radarr.mjs';
import { schedulerService } from '../../services/scheduler.mjs';
import { sonarrService } from '../../services/sonarr.mjs';
import { startupService } from '../../services/startupService.mjs';
import { tavilyService } from '../../services/tavily.mjs';
import { tmdbService } from '../../services/tmdb.mjs';
import { webhookService } from '../../services/webhook.mjs';
import * as runtimeSettingsModule from '../../config/runtimeSettings.mjs';
import { defaultHttpClient } from '../../utils/httpClient.mjs';
import {
  decryptValue,
  encryptValue,
  formatEncryptedValue,
  parseEncryptedValue,
} from '../../utils/encryption.mjs';
import {
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
} from '../../utils/ragLoopConfig.mjs';

export const settingsTestRouterDependencies = {
  authenticateToken,
  requireAdmin,
  createSettingsRouteDependencies,
  createSettingsRouter,
  database,
  radarrService,
  sonarrService,
  discordBotService,
  defaultHttpClient,
  embeddingProvider,
  embeddingRouter,
  ollamaService,
  tmdbService,
  tavilyService,
  omdbService,
  pathTestService,
  cloudLLMService,
  aiRouterService,
  autoLearningService,
  schedulerService,
  startupService,
  runtimeSettings: runtimeSettingsModule.default ?? runtimeSettingsModule,
  providerLock,
  webhookService,
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
  encryptValue,
  formatEncryptedValue,
  parseEncryptedValue,
  decryptValue,
};
