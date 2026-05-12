/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { maskConfigWithSecret } from '../../services/webhookServiceShared.mjs';
import { isMaskedToken } from '../../utils/tokenMasking.mjs';
import { buildSettingsErrorResponse, getSettingsErrorMessage } from './settingsErrorSupport.mjs';

const WEBHOOK_MASK_CHAR = '•';

export function isMaskedWebhookSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return false;
  }

  return isMaskedToken(secret) || secret.includes(WEBHOOK_MASK_CHAR);
}

export function maskWebhookSecret(config, fullSecret = null) {
  return maskConfigWithSecret(config, fullSecret);
}

export function parseWebhookConfigId(rawId) {
  const parsed = Number.parseInt(rawId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildInvalidWebhookConfigIdResponse() {
  return {
    status: 400,
    body: { error: 'Invalid configuration id' },
  };
}

export function buildWebhookConfigNotFoundResponse() {
  return {
    status: 404,
    body: { error: 'Configuration not found' },
  };
}

export function buildMaskedWebhookConfigResponse(config) {
  return {
    status: 200,
    body: maskWebhookSecret(config),
  };
}

export function normalizeWebhookConfigRecordResponse(config) {
  if (!config) {
    return buildWebhookConfigNotFoundResponse();
  }

  return buildMaskedWebhookConfigResponse(config);
}

export function buildWebhookUrl(req, secretKey) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let url = `${baseUrl}/api/webhook/overseerr`;
  if (secretKey) {
    url += `?key=${encodeURIComponent(secretKey)}`;
  }
  return url;
}

export async function normalizeWebhookConfigUpdatePayload({
  payload,
  webhookService,
}) {
  const nextPayload = { ...payload };

  if (nextPayload.secret_key && isMaskedWebhookSecret(nextPayload.secret_key)) {
    const fullSecret = await webhookService.getFullSecret();
    if (fullSecret) {
      nextPayload.secret_key = fullSecret;
    } else {
      delete nextPayload.secret_key;
    }
  }

  return nextPayload;
}

export function normalizeWebhookCreatePayload(payload) {
  const nextPayload = { ...payload };
  if (nextPayload.secret_key && isMaskedWebhookSecret(nextPayload.secret_key)) {
    delete nextPayload.secret_key;
  }
  return nextPayload;
}

export function buildWebhookTestSuccessResponse(responseData) {
  return {
    success: true,
    message: 'Test webhook sent successfully',
    response: responseData,
  };
}

export function buildWebhookTestErrorResponse(error) {
  return {
    status: 500,
    body: {
      success: false,
      error: getSettingsErrorMessage(error),
      details: error?.response?.data,
    },
  };
}

export function buildWebhookDeleteErrorResponse(error) {
  return buildSettingsErrorResponse(error, { fallbackStatus: 400 });
}
