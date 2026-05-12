/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  maskWebhookSecret as defaultMaskWebhookSecret,
  normalizeWebhookConfigUpdatePayload as defaultNormalizeWebhookConfigUpdatePayload,
  normalizeWebhookCreatePayload as defaultNormalizeWebhookCreatePayload,
} from '../routes/helpers/webhookSettingsSupport.mjs';

function buildMissingWebhookConfigNameError() {
  const error = new Error('Name is required');
  error.httpStatus = 400;
  return error;
}

export function createWebhookSettingsMutationService({
  webhookService,
  normalizeWebhookConfigUpdatePayload = defaultNormalizeWebhookConfigUpdatePayload,
  normalizeWebhookCreatePayload = defaultNormalizeWebhookCreatePayload,
  maskWebhookSecret = defaultMaskWebhookSecret,
}) {
  return {
    async updateConfig({ body = {} }) {
      const config = await normalizeWebhookConfigUpdatePayload({
        payload: body,
        webhookService,
      });

      const result = await webhookService.updateConfig(config);
      const fullSecret = await webhookService.getFullSecret();
      return maskWebhookSecret(result, fullSecret);
    },

    async generateKey() {
      const secretKey = webhookService.generateSecretKey();
      const config = await webhookService.updateConfig({ secret_key: secretKey });

      return {
        ...config,
        secret_key: secretKey,
      };
    },

    async createConfig({ body = {} }) {
      if (!body.name) {
        throw buildMissingWebhookConfigNameError();
      }

      const payload = normalizeWebhookCreatePayload(body);
      return webhookService.createConfig(payload);
    },

    async updateConfigById({ id, body = {} }) {
      const payload = normalizeWebhookCreatePayload(body);
      return webhookService.updateConfigById(id, payload);
    },

    async setPrimaryConfig({ id }) {
      return webhookService.setPrimaryConfig(id);
    },
  };
}
