/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolveAiProviderRequest as defaultResolveAiProviderRequest } from './shared/aiSettingsRequestSupport.mjs';

export function createAiSettingsActionService({
  cloudLLMService,
  resolveAiProviderRequest = defaultResolveAiProviderRequest,
}) {
  return {
    async testConnection({ body, dbOrClient, resolveRequestApiKey }) {
      const requestConfig = await resolveAiProviderRequest({
        body,
        dbOrClient,
        resolveRequestApiKey,
      });

      if (!requestConfig.api_key) {
        const error = new Error('API key is required');
        error.httpStatus = 400;
        throw error;
      }

      return cloudLLMService.testConnection(requestConfig);
    },

    async getModels({ body, dbOrClient, resolveRequestApiKey }) {
      const requestConfig = await resolveAiProviderRequest({
        body,
        dbOrClient,
        resolveRequestApiKey,
      });

      if (!requestConfig.api_key) {
        const error = new Error('API key is required');
        error.httpStatus = 400;
        throw error;
      }

      const models = await cloudLLMService.getModels(requestConfig);

      return {
        success: true,
        models,
      };
    },

    async resetUsage() {
      await cloudLLMService.resetMonthlyUsage();

      return {
        success: true,
        message: 'Monthly usage reset successfully',
      };
    },
  };
}
