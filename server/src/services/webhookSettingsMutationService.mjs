/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  annotateWebhookSecretStatus as defaultAnnotateWebhookSecretStatus,
  maskWebhookSecret as defaultMaskWebhookSecret,
  normalizeWebhookConfigUpdatePayload as defaultNormalizeWebhookConfigUpdatePayload,
  normalizeWebhookCreatePayload as defaultNormalizeWebhookCreatePayload,
} from './shared/webhookSettingsModel.mjs';
import { createSettingsServiceError } from './shared/settingsServiceErrors.mjs';

/**
 * @typedef {{
 *   name?: string,
 *   [key: string]: unknown,
 * }} WebhookMutationPayload
 */

function buildMissingWebhookConfigNameError() {
  return createSettingsServiceError('Name is required', 400);
}

export function createWebhookSettingsMutationService({
  webhookService,
  annotateWebhookSecretStatus = defaultAnnotateWebhookSecretStatus,
  normalizeWebhookConfigUpdatePayload = defaultNormalizeWebhookConfigUpdatePayload,
  normalizeWebhookCreatePayload = defaultNormalizeWebhookCreatePayload,
  maskWebhookSecret = defaultMaskWebhookSecret,
}) {
  return {
    /** @param {{ body?: WebhookMutationPayload }} options */
    async updateConfig({ body = {} }) {
      const config = await normalizeWebhookConfigUpdatePayload({
        payload: body,
        webhookService,
      });

      const result = await webhookService.updateConfig(config);
      const fullSecret = await webhookService.getFullSecret();
      /** @returns {Promise<Record<string, unknown>>} */
      return annotateWebhookSecretStatus(
        maskWebhookSecret(result, fullSecret),
        fullSecret,
      );
    },

    async generateKey() {
      const secretKey = webhookService.generateSecretKey();
      const config = await webhookService.updateConfig({ secret_key: secretKey });

      return {
        ...annotateWebhookSecretStatus(config, secretKey),
        secret_key: secretKey,
      };
    },

    /** @param {{ body?: WebhookMutationPayload }} options */
    async createConfig({ body = {} }) {
      if (!body.name) {
        throw buildMissingWebhookConfigNameError();
      }

      const payload = normalizeWebhookCreatePayload(body);
      return webhookService.createConfig(payload);
    },

    /** @param {{ id: number | string, body?: WebhookMutationPayload }} options */
    async updateConfigById({ id, body = {} }) {
      const payload = normalizeWebhookCreatePayload(body);
      return webhookService.updateConfigById(id, payload);
    },

    /** @param {{ id: number | string }} options */
    async setPrimaryConfig({ id }) {
      return webhookService.setPrimaryConfig(id);
    },
  };
}
