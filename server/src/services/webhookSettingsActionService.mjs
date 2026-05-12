/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildWebhookUrl as defaultBuildWebhookUrl } from './shared/webhookSettingsModel.mjs';

function buildMissingWebhookSecretError() {
  const error = new Error('No webhook secret configured');
  error.httpStatus = 404;
  return error;
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
  return {
    async getSecret() {
      const secretKey = await webhookService.getFullSecret();

      if (!secretKey) {
        throw buildMissingWebhookSecretError();
      }

      return { secret_key: secretKey };
    },

    async getUrl({ req }) {
      const secretKey = await webhookService.getFullSecret();
      return { url: buildWebhookUrl(req, secretKey) };
    },

    async sendTestWebhook({ req }) {
      const secretKey = await webhookService.getFullSecret();
      const url = buildWebhookUrl(req, secretKey);
      const response = await httpClient.post(url, buildWebhookTestPayload(), {
        headers: buildWebhookTestHeaders(),
      });

      return response.data;
    },
  };
}
