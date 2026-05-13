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
import { createArrSettingsRouteHandlers } from './helpers/arrSettingsRouteHandlers.mjs';
import {
  createAiHandlerDescriptors,
  createOperationalHandlerDescriptors,
} from './helpers/settingsRouteHandlerDescriptors.mjs';

function buildHandlerGroup(descriptors, context) {
  return Object.fromEntries(descriptors.map(({ key, create }) => [key, create(context)]));
}

function createAiHandlerGroups(aiSettingsDependencies, logger) {
  return buildHandlerGroup(createAiHandlerDescriptors(aiSettingsDependencies, logger));
}

function createOperationalHandlerGroups(operationalSettingsDependencies) {
  return buildHandlerGroup(createOperationalHandlerDescriptors(operationalSettingsDependencies));
}

export function createSettingsRouteDependencies({
  logger: providedLogger,
  ...dependencyOverrides
} = {}) {
  const logger = providedLogger || createLogger('SettingsRoutes');
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
