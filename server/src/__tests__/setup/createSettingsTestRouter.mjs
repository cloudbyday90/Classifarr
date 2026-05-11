import * as database from '../../config/database.mjs';
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

function createSettingsTestRouter(express, dependencyOverrides = {}) {
  const { httpClient: overriddenHttpClient, ...routeDependencyOverrides } = dependencyOverrides;

  const routeDependencies = createSettingsRouteDependencies({
    database,
    radarrService,
    sonarrService,
    discordBotService,
    httpClient: overriddenHttpClient ?? defaultHttpClient,
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
    ...routeDependencyOverrides,
  });

  return createSettingsRouter({
    express,
    authenticateToken,
    requireAdmin,
    ...routeDependencies,
  });
}

export {
  createSettingsTestRouter,
};
