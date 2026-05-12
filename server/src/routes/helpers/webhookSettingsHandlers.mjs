/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildWebhookDeleteErrorResponse,
  buildWebhookTestErrorResponse,
  buildWebhookTestSuccessResponse,
  buildWebhookUrl,
  maskWebhookSecret,
  normalizeWebhookConfigUpdatePayload,
  normalizeWebhookCreatePayload,
  parseWebhookConfigId,
} from './webhookSettingsSupport.mjs';
import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

export function createWebhookSettingsHandlers({ webhookService, httpClient }) {
  return {
    async getConfig(_req, res) {
      try {
        const config = await webhookService.getConfig();
        const fullSecret = await webhookService.getFullSecret();
        res.json(maskWebhookSecret(config, fullSecret));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async updateConfig(req, res) {
      try {
        const config = await normalizeWebhookConfigUpdatePayload({
          payload: req.body,
          webhookService,
        });

        const result = await webhookService.updateConfig(config);
        const fullSecret = await webhookService.getFullSecret();
        res.json(maskWebhookSecret(result, fullSecret));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async generateKey(_req, res) {
      try {
        const secretKey = webhookService.generateSecretKey();
        const config = await webhookService.updateConfig({ secret_key: secretKey });
        res.json({
          ...config,
          secret_key: secretKey,
        });
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getSecret(_req, res) {
      try {
        const secretKey = await webhookService.getFullSecret();

        if (!secretKey) {
          return res.status(404).json({ error: 'No webhook secret configured' });
        }

        res.json({ secret_key: secretKey });
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getUrl(req, res) {
      try {
        const secretKey = await webhookService.getFullSecret();
        res.json({ url: buildWebhookUrl(req, secretKey) });
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getLogs(req, res) {
      try {
        const { page = 1, limit = 50, status, media_type } = req.query;
        const result = await webhookService.getLogs({
          page: Number.parseInt(page, 10),
          limit: Number.parseInt(limit, 10),
          status,
          media_type,
        });
        res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getStats(_req, res) {
      try {
        const stats = await webhookService.getStats();
        res.json(stats);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async sendTestWebhook(req, res) {
      try {
        const secretKey = await webhookService.getFullSecret();
        const url = buildWebhookUrl(req, secretKey);

        const testPayload = {
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

        const response = await httpClient.post(url, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Classifarr-Test',
          },
        });

        res.json(buildWebhookTestSuccessResponse(response.data));
      } catch (error) {
        const response = buildWebhookTestErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async listConfigs(_req, res) {
      try {
        const configs = await webhookService.getAllConfigs();
        res.json(configs);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getConfigById(req, res) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid configuration id' });
        }

        const config = await webhookService.getConfigById(id);
        if (!config) {
          return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json(maskWebhookSecret(config));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async createConfig(req, res) {
      try {
        if (!req.body.name) {
          return res.status(400).json({ error: 'Name is required' });
        }

        const payload = normalizeWebhookCreatePayload(req.body);

        const config = await webhookService.createConfig(payload);
        res.status(201).json(config);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async updateConfigById(req, res) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid configuration id' });
        }

        const payload = normalizeWebhookCreatePayload(req.body);

        const config = await webhookService.updateConfigById(id, payload);
        if (!config) {
          return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json(maskWebhookSecret(config));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async deleteConfig(req, res) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid configuration id' });
        }

        await webhookService.deleteConfig(id);
        res.json({ success: true });
      } catch (error) {
        const response = buildWebhookDeleteErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async setPrimaryConfig(req, res) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid configuration id' });
        }

        const config = await webhookService.setPrimaryConfig(id);
        res.json(maskWebhookSecret(config));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },
  };
}

