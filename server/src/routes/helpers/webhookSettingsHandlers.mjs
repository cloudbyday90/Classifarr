/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildInvalidWebhookConfigIdResponse,
  buildMaskedWebhookConfigResponse,
  buildWebhookDeleteErrorResponse,
  buildWebhookTestErrorResponse,
  buildWebhookTestSuccessResponse,
  buildWebhookUrl,
  maskWebhookSecret,
  normalizeWebhookConfigRecordResponse,
  normalizeWebhookConfigUpdatePayload,
  normalizeWebhookCreatePayload,
  parseWebhookConfigId,
} from './webhookSettingsSupport.mjs';
import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
import {
  readWebhookConfig,
  readWebhookConfigById,
  readWebhookConfigList,
} from '../../services/webhookSettingsReadService.mjs';
import { createWebhookSettingsActionService } from '../../services/webhookSettingsActionService.mjs';

export function createWebhookSettingsHandlers({ webhookService, httpClient }) {
  const actionService = createWebhookSettingsActionService({
    webhookService,
    httpClient,
    buildWebhookUrl,
  });

  return {
    async getConfig(_req, res) {
      try {
        const config = await readWebhookConfig({ webhookService });
        res.json(config);
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
        const payload = await actionService.getSecret();
        res.json(payload);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getUrl(req, res) {
      try {
        const payload = await actionService.getUrl({ req });
        res.json(payload);
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
        const responseData = await actionService.sendTestWebhook({ req });
        res.json(buildWebhookTestSuccessResponse(responseData));
      } catch (error) {
        const response = buildWebhookTestErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async listConfigs(_req, res) {
      try {
        const configs = await readWebhookConfigList({ webhookService });
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
          const response = buildInvalidWebhookConfigIdResponse();
          return res.status(response.status).json(response.body);
        }

        const config = await readWebhookConfigById({ webhookService, id });
        const response = normalizeWebhookConfigRecordResponse(config);
        res.status(response.status).json(response.body);
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
          const response = buildInvalidWebhookConfigIdResponse();
          return res.status(response.status).json(response.body);
        }

        const payload = normalizeWebhookCreatePayload(req.body);

        const config = await webhookService.updateConfigById(id, payload);
        const response = normalizeWebhookConfigRecordResponse(config);
        res.status(response.status).json(response.body);
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
          const response = buildInvalidWebhookConfigIdResponse();
          return res.status(response.status).json(response.body);
        }

        const config = await webhookService.setPrimaryConfig(id);
        const response = buildMaskedWebhookConfigResponse(config);
        res.status(response.status).json(response.body);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },
  };
}

