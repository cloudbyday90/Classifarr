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

import settingsArrApi, {
  addRadarrConfig,
  addSonarrConfig,
  deleteRadarrConfig,
  deleteSonarrConfig,
  getRadarrConfig,
  getRadarrQualityProfiles,
  getSonarrConfig,
  getSonarrQualityProfiles,
  testRadarrConnection,
  testSonarrConnection,
  updateRadarrConfig,
  updateSonarrConfig,
} from './settingsArr'
import settingsConfidenceApi, {
  exportConfidenceSettings,
  getConfidenceHistory,
  getConfidenceSettings,
  revertConfidenceSetting,
  updateConfidenceSettings,
} from './settingsConfidence'
import settingsProvidersApi, {
  getAIConfig,
  getAIModels,
  getAIUsage,
  getLastOllamaPreflight,
  getOllamaModels,
  getOMDbConfig,
  getTavilyConfig,
  testAIConnection,
  testOllama,
  testOMDb,
  testTavily,
  updateAIConfig,
  updateOMDbConfig,
  updateTavilyConfig,
} from './settingsProviders'
import settingsWebhookApi, {
  createWebhookConfig,
  deleteWebhookConfig,
  generateWebhookKey,
  getWebhookConfig,
  getWebhookConfigs,
  getWebhookLogs,
  getWebhookSecret,
  getWebhookStats,
  setPrimaryWebhookConfig,
  testWebhook,
  updateWebhookConfig,
} from './settingsWebhook'

const settingsApi = {
  ...settingsConfidenceApi,
  ...settingsArrApi,
  ...settingsProvidersApi,
  ...settingsWebhookApi,
}

export {
  getConfidenceSettings,
  updateConfidenceSettings,
  getConfidenceHistory,
  revertConfidenceSetting,
  exportConfidenceSettings,
  getRadarrConfig,
  addRadarrConfig,
  updateRadarrConfig,
  deleteRadarrConfig,
  testRadarrConnection,
  getRadarrQualityProfiles,
  getSonarrConfig,
  addSonarrConfig,
  updateSonarrConfig,
  deleteSonarrConfig,
  testSonarrConnection,
  getSonarrQualityProfiles,
  testOllama,
  getOllamaModels,
  getLastOllamaPreflight,
  getTavilyConfig,
  updateTavilyConfig,
  testTavily,
  getOMDbConfig,
  updateOMDbConfig,
  testOMDb,
  getAIConfig,
  updateAIConfig,
  testAIConnection,
  getAIModels,
  getAIUsage,
  getWebhookConfig,
  updateWebhookConfig,
  generateWebhookKey,
  getWebhookSecret,
  getWebhookLogs,
  getWebhookStats,
  testWebhook,
  getWebhookConfigs,
  createWebhookConfig,
  deleteWebhookConfig,
  setPrimaryWebhookConfig,
}

export default settingsApi
