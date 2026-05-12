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

import { createLogger } from '../utils/logger.mjs';
import {
  createAiSettingsDependencies,
  createArrSettingsDependencies,
  createOperationalSettingsDependencies,
} from './helpers/settingsRouteDependencyBuilders.mjs';
import { createAiSettingsHandlers } from './helpers/aiSettingsHandlers.mjs';
import { createArrSettingsRouteHandlers } from './helpers/arrSettingsRouteHandlers.mjs';
import { createConfidenceSettingsHandlers } from './helpers/confidenceSettingsHandlers.mjs';
import { createMetadataProviderSettingsHandlers } from './helpers/metadataProviderSettingsHandlers.mjs';
import { createOllamaSettingsHandlers } from './helpers/ollamaSettingsHandlers.mjs';
import { createOperationalSettingsRouteHandlers } from './helpers/operationalSettingsRouteHandlers.mjs';
import { resolveRequestApiKey } from './helpers/providerConfigHelpers.mjs';

export function createSettingsRouteDependencies({
  ...dependencyOverrides
} = {}) {
  const logger = createLogger('SettingsRoutes');
  const aiSettingsDependencies = createAiSettingsDependencies({
    ...dependencyOverrides,
    logger,
  });

  return {
    ...createArrSettingsRouteHandlers(
      createArrSettingsDependencies(dependencyOverrides),
    ),
    aiHandlers: createAiSettingsHandlers({
      ...aiSettingsDependencies,
      db: aiSettingsDependencies.database,
      resolveRequestApiKey,
    }),
    confidenceSettingsHandlers: createConfidenceSettingsHandlers({
      db: aiSettingsDependencies.database,
      logger,
      autoLearningService: aiSettingsDependencies.autoLearningService,
    }),
    metadataProviderHandlers: createMetadataProviderSettingsHandlers({
      db: aiSettingsDependencies.database,
      logger,
      tmdbService: aiSettingsDependencies.tmdbService,
      tavilyService: aiSettingsDependencies.tavilyService,
      omdbService: aiSettingsDependencies.omdbService,
      schedulerService: aiSettingsDependencies.schedulerService,
    }),
    ollamaHandlers: createOllamaSettingsHandlers({
      db: aiSettingsDependencies.database,
      ollamaService: aiSettingsDependencies.ollamaService,
    }),
    ...createOperationalSettingsRouteHandlers(
      createOperationalSettingsDependencies({
        ...dependencyOverrides,
        logger,
      }),
    ),
  };
}
