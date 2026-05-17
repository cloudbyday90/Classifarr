/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildWebhookUrl as defaultBuildWebhookUrl } from './shared/webhookSettingsModel.mjs';
import { createSettingsServiceError } from './shared/settingsServiceErrors.mjs';

function buildMissingWebhookSecretError() {
  return createSettingsServiceError('No webhook secret configured', 404);
}

function buildUnavailableWebhookSecretError() {
  return createSettingsServiceError(
    'Webhook authorization header is unavailable because the stored encryption key no longer matches the persisted secret. Restore the API key encryption key or regenerate the header manually.',
    409,
  );
}

function buildWebhookTestPayload() {
  return {
    notification_type: 'TEST_NOTIFICATION',
    event: 'test',
    subject: 'Test Notification from Classifarr',
    message: 'This is a test webhook to verify your configuration',
    media: {
      media_type: 'movie',
      tmdbId: 550,
      title: 'Test Movie',
      releaseDate: '1999-10-15',
    },
  };
}

function buildWebhookTestHeaders() {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'Classifarr-Test',
  };
}

export function createWebhookSettingsActionService({
  webhookService,
  httpClient,
  buildWebhookUrl = defaultBuildWebhookUrl,
}) {
  async function requireAvailableSecret() {
    const [config, secretKey] = await Promise.all([
      webhookService.getConfig({ mask: false }),
      webhookService.getFullSecret(),
    ]);

    if (secretKey) {
      return secretKey;
    }

    if (config?.secret_key) {
      throw buildUnavailableWebhookSecretError();
    }

    throw buildMissingWebhookSecretError();
  }

  return {
    async getSecret() {
      const secretKey = await requireAvailableSecret();

      return { secret_key: secretKey };
    },

    async getUrl({ req }) {
      const secretKey = await requireAvailableSecret();
      return { url: buildWebhookUrl(req, secretKey) };
    },

    async sendTestWebhook({ req }) {
      const secretKey = await requireAvailableSecret();
      const url = buildWebhookUrl(req, secretKey);
      const response = await httpClient.post(url, buildWebhookTestPayload(), {
        headers: buildWebhookTestHeaders(),
      });

      return response.data;
    },
  };
}
