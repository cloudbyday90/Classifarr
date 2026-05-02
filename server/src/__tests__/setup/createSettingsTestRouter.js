/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

async function createSettingsTestRouter(express, dependencyOverrides = {}) {
  const database = require('../../config/database');
  const { authenticateToken, requireAdmin } = require('../../middleware/auth');
  const radarrService = require('../../services/radarr');
  const sonarrService = require('../../services/sonarr');
  const discordBotService = require('../../services/discordBot');
  const embeddingProvider = require('../../services/embeddingProvider');
  const embeddingRouter = require('../../services/embeddingRouter');
  const ollamaService = require('../../services/ollama');
  const tmdbService = require('../../services/tmdb');
  const tavilyService = require('../../services/tavily');
  const omdbService = require('../../services/omdb');
  const pathTestService = require('../../services/pathTestService');
  const cloudLLMService = require('../../services/cloudLLM');
  const aiRouterService = require('../../services/aiRouter');
  const autoLearningService = require('../../services/autoLearningService');
  const schedulerService = require('../../services/scheduler');
  const startupService = require('../../services/startupService');
  const runtimeSettings = require('../../config/runtimeSettings');
  const providerLock = require('../../services/providerLock');
  const webhookService = require('../../services/webhook');
  const httpClient = require('axios');
  const {
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig,
  } = require('../../utils/ragLoopConfig');
  const {
    encryptValue,
    formatEncryptedValue,
    parseEncryptedValue,
    decryptValue,
  } = require('../../utils/encryption');
  const [{ createSettingsRouteDependencies }, { createSettingsRouter }] = await Promise.all([
    import('../../routes/settingsRouteDependencies.mjs'),
    import('../../routes/settingsRouteShared.mjs'),
  ]);

  const { httpClient: overriddenHttpClient, ...routeDependencyOverrides } = dependencyOverrides;

  const routeDependencies = {
    ...createSettingsRouteDependencies({
      database,
      radarrService,
      sonarrService,
      discordBotService,
      httpClient: overriddenHttpClient || httpClient,
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
      runtimeSettings,
      providerLock,
      webhookService,
      getRagLoopDefaultConfig,
      validateAndNormalizeRagLoopConfig,
      encryptValue,
      formatEncryptedValue,
      parseEncryptedValue,
      decryptValue,
    }),
    ...routeDependencyOverrides,
  };

  return createSettingsRouter({
    express,
    authenticateToken,
    requireAdmin,
    ...routeDependencies,
  });
}

module.exports = {
  createSettingsTestRouter,
};
