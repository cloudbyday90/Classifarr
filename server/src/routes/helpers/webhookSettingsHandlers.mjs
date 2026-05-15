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
  normalizeWebhookConfigRecordResponse,
  parseWebhookConfigId,
} from './webhookConfigResponseSupport.mjs';
import {
  buildWebhookDeleteErrorResponse,
  buildWebhookTestErrorResponse,
  buildWebhookTestSuccessResponse,
} from './webhookSettingsActionResponseSupport.mjs';
import {
  readWebhookConfig,
  readWebhookConfigById,
  readWebhookConfigList,
} from '../../services/webhookSettingsReadService.mjs';
import { createWebhookSettingsActionService } from '../../services/webhookSettingsActionService.mjs';
import { createWebhookSettingsMutationService } from '../../services/webhookSettingsMutationService.mjs';

export function createWebhookSettingsHandlers({ webhookService, httpClient }) {
  const actionService = createWebhookSettingsActionService({
    webhookService,
    httpClient,
  });
  const mutationService = createWebhookSettingsMutationService({
    webhookService,
  });

  return {
    async getConfig(_req, res, next) {
      try {
        const config = await readWebhookConfig({ webhookService });
        res.json(config);
      } catch (error) {
        next(error);
      }
    },

    async updateConfig(req, res, next) {
      try {
        const result = await mutationService.updateConfig({ body: req.body });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async generateKey(_req, res, next) {
      try {
        const config = await mutationService.generateKey();
        res.json(config);
      } catch (error) {
        next(error);
      }
    },

    async getSecret(_req, res, next) {
      try {
        const payload = await actionService.getSecret();
        res.json(payload);
      } catch (error) {
        next(error);
      }
    },

    async getUrl(req, res, next) {
      try {
        const payload = await actionService.getUrl({ req });
        res.json(payload);
      } catch (error) {
        next(error);
      }
    },

    async getLogs(req, res, next) {
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
        next(error);
      }
    },

    async getStats(_req, res, next) {
      try {
        const stats = await webhookService.getStats();
        res.json(stats);
      } catch (error) {
        next(error);
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

    async listConfigs(_req, res, next) {
      try {
        const configs = await readWebhookConfigList({ webhookService });
        res.json(configs);
      } catch (error) {
        next(error);
      }
    },

    async getConfigById(req, res, next) {
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
        next(error);
      }
    },

    async createConfig(req, res, next) {
      try {
        const config = await mutationService.createConfig({ body: req.body });
        res.status(201).json(config);
      } catch (error) {
        next(error);
      }
    },

    async updateConfigById(req, res, next) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          const response = buildInvalidWebhookConfigIdResponse();
          return res.status(response.status).json(response.body);
        }

        const config = await mutationService.updateConfigById({
          id,
          body: req.body,
        });
        const response = normalizeWebhookConfigRecordResponse(config);
        res.status(response.status).json(response.body);
      } catch (error) {
        next(error);
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

    async setPrimaryConfig(req, res, next) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          const response = buildInvalidWebhookConfigIdResponse();
          return res.status(response.status).json(response.body);
        }

        const config = await mutationService.setPrimaryConfig({ id });
        const response = buildMaskedWebhookConfigResponse(config);
        res.status(response.status).json(response.body);
      } catch (error) {
        next(error);
      }
    },
  };
}
