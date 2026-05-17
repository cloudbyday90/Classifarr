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
import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import { sendData, sendError } from '../../utils/responseHelpers.mjs';
import { createWebhookSettingsActionService } from '../../services/webhookSettingsActionService.mjs';
import { createWebhookSettingsMutationService } from '../../services/webhookSettingsMutationService.mjs';

async function buildWebhookTestResponse({ actionService, req }) {
  try {
    const responseData = await actionService.sendTestWebhook({ req });
    return {
      status: 200,
      body: buildWebhookTestSuccessResponse(responseData),
    };
  } catch (error) {
    return buildWebhookTestErrorResponse(error);
  }
}

async function buildWebhookDeleteResponse({ webhookService, rawId }) {
  const id = parseWebhookConfigId(rawId);
  if (!id) {
    throw new ValidationError('Invalid configuration id');
  }

  try {
    await webhookService.deleteConfig(id);
    return {
      status: 200,
      body: { success: true },
    };
  } catch (error) {
    return buildWebhookDeleteErrorResponse(error);
  }
}

export function createWebhookSettingsHandlers({ webhookService, httpClient }) {
  const actionService = createWebhookSettingsActionService({
    webhookService,
    httpClient,
  });
  const mutationService = createWebhookSettingsMutationService({
    webhookService,
  });

  return {
    getConfig: asyncHandler(async (_req, res) => {
      const config = await readWebhookConfig({ webhookService });
      return sendData(res, config);
    }),

    updateConfig: asyncHandler(async (req, res) => {
      const result = await mutationService.updateConfig({ body: req.body });
      return sendData(res, result);
    }),

    generateKey: asyncHandler(async (_req, res) => {
      const config = await mutationService.generateKey();
      return sendData(res, config);
    }),

    getSecret: asyncHandler(async (_req, res) => {
      const payload = await actionService.getSecret();
      return sendData(res, payload);
    }),

    getUrl: asyncHandler(async (req, res) => {
      const payload = await actionService.getUrl({ req });
      return sendData(res, payload);
    }),

    getLogs: asyncHandler(async (req, res) => {
      const { page = 1, limit = 50, status, media_type } = req.query;
      const parsedPage = Number.parseInt(page, 10);
      const parsedLimit = Number.parseInt(limit, 10);
      if (!Number.isFinite(parsedPage) || parsedPage < 1) {
        return sendError(res, 400, 'page must be a positive integer');
      }
      if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
        return sendError(res, 400, 'limit must be a positive integer');
      }
      const result = await webhookService.getLogs({
        page: parsedPage,
        limit: parsedLimit,
        status,
        media_type,
      });
      return sendData(res, result);
    }),

    getStats: asyncHandler(async (_req, res) => {
      const stats = await webhookService.getStats();
      return sendData(res, stats);
    }),

    sendTestWebhook: asyncHandler(async (req, res) => {
      const response = await buildWebhookTestResponse({ actionService, req });
      return res.status(response.status).json(response.body);
    }),

    listConfigs: asyncHandler(async (_req, res) => {
      const configs = await readWebhookConfigList({ webhookService });
      return sendData(res, configs);
    }),

    getConfigById: asyncHandler(async (req, res) => {
      const id = parseWebhookConfigId(req.params.id);
      if (!id) {
        const response = buildInvalidWebhookConfigIdResponse();
        return res.status(response.status).json(response.body);
      }

      const config = await readWebhookConfigById({ webhookService, id });
      const response = normalizeWebhookConfigRecordResponse(config);
      return res.status(response.status).json(response.body);
    }),

    createConfig: asyncHandler(async (req, res) => {
      const config = await mutationService.createConfig({ body: req.body });
      return sendData(res, config, 201);
    }),

    updateConfigById: asyncHandler(async (req, res) => {
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
      return res.status(response.status).json(response.body);
    }),

    deleteConfig: asyncHandler(async (req, res) => {
      const response = await buildWebhookDeleteResponse({
        webhookService,
        rawId: req.params.id,
      });
      return res.status(response.status).json(response.body);
    }),

    setPrimaryConfig: asyncHandler(async (req, res) => {
      const id = parseWebhookConfigId(req.params.id);
      if (!id) {
        const response = buildInvalidWebhookConfigIdResponse();
        return res.status(response.status).json(response.body);
      }

      const config = await mutationService.setPrimaryConfig({ id });
      const response = buildMaskedWebhookConfigResponse(config);
      return res.status(response.status).json(response.body);
    }),
  };
}
