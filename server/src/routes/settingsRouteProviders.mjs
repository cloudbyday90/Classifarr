/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';

export function registerProviderRoutes(router, {
  ollamaHandlers,
  metadataProviderHandlers,
  aiHandlers,
  webSearchProviderHandlers,
}) {
  router.get('/ollama', ollamaHandlers.getConfig);
  router.put('/ollama', ollamaHandlers.updateConfig);
  router.post('/ollama/test', ollamaHandlers.testConnection);
  router.get('/ollama/preflight/last', ollamaHandlers.getLastPreflight);
  router.post('/ollama/warm', ollamaHandlers.warmModel);
  router.post('/ollama/warm-all', ollamaHandlers.warmAllModels);
  router.get('/ollama/models', ollamaHandlers.getModels);
  router.get('/ollama/recommended-models', ollamaHandlers.getRecommendedModels);

  router.get('/tmdb', metadataProviderHandlers.getTmdbConfig);
  router.put('/tmdb', metadataProviderHandlers.updateTmdbConfig);
  router.post('/tmdb/test', metadataProviderHandlers.testTmdb);
  router.get('/tmdb/health', metadataProviderHandlers.tmdbHealth);

  router.get('/tavily', metadataProviderHandlers.getTavilyConfig);
  router.put('/tavily', metadataProviderHandlers.updateTavilyConfig);
  router.post('/tavily/test', metadataProviderHandlers.testTavily);
  router.post('/tavily/search', metadataProviderHandlers.searchTavily);
  router.get('/tavily/health', metadataProviderHandlers.tavilyHealth);

  if (webSearchProviderHandlers) {
    router.get('/web-search/providers', webSearchProviderHandlers.listProviders);
    router.get('/web-search/providers/route-diagnostics', webSearchProviderHandlers.getRouteDiagnostics);
    router.get('/web-search/provider-calibration-policies', webSearchProviderHandlers.listCalibrationPolicies);
    router.get('/web-search/provider-calibration-policies/coverage', webSearchProviderHandlers.getCalibrationPolicyCoverage);
    router.get('/web-search/provider-guardrail-thresholds', webSearchProviderHandlers.getGuardrailThresholds);
    router.put('/web-search/provider-guardrail-thresholds', webSearchProviderHandlers.updateGuardrailThresholds);
    router.get('/web-search/provider-guardrail-analytics', webSearchProviderHandlers.getGuardrailAnalytics);
    router.get('/web-search/provider-guardrail-digest', webSearchProviderHandlers.getGuardrailDigest);
    router.post('/web-search/provider-calibration-policies/:purpose/preview', webSearchProviderHandlers.previewCalibrationPolicy);
    router.put('/web-search/provider-calibration-policies/:purpose', webSearchProviderHandlers.updateCalibrationPolicy);
    router.put('/web-search/providers/:providerKey', webSearchProviderHandlers.updateProvider);
    router.post('/web-search/providers/:providerKey/test', webSearchProviderHandlers.testProvider);
  }

  router.get('/omdb', metadataProviderHandlers.getOmdbConfig);
  router.put('/omdb', metadataProviderHandlers.updateOmdbConfig);
  router.post('/omdb/test', metadataProviderHandlers.testOmdb);
  router.post('/omdb/search', metadataProviderHandlers.searchOmdb);
  router.get('/omdb/health', metadataProviderHandlers.omdbHealth);

  router.get('/ai', asyncHandler(aiHandlers.getConfig));
  router.put('/ai', asyncHandler(aiHandlers.updateConfig));
  router.post('/ai/verification-preflight', asyncHandler(aiHandlers.getVerificationPreflight));
  router.post('/ai/test', aiHandlers.testConnection);
  router.post('/ai/models', aiHandlers.getModels);
  router.get('/ai/usage', aiHandlers.getUsage);
  router.get('/ai/status', aiHandlers.getStatus);
  router.post('/ai/reset-usage', asyncHandler(aiHandlers.resetUsage));
}
