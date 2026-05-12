/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isMaskedToken, maskToken } from '../../utils/tokenMasking.mjs';
import { buildSettingsErrorResponse, getSettingsErrorMessage } from './settingsErrorSupport.mjs';

const WEBHOOK_MASK_CHAR = '•';

export function isMaskedWebhookSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return false;
  }

  return isMaskedToken(secret) || secret.includes(WEBHOOK_MASK_CHAR);
}

export function maskWebhookSecret(config, fullSecret = null) {
  if (!config) {
    return null;
  }

  const masked = { ...config };
  if (fullSecret) {
    masked.secret_key = maskToken(fullSecret);
  } else if (masked.secret_key) {
    masked.secret_key = maskToken(masked.secret_key);
  }

  return masked;
}

export function parseWebhookConfigId(rawId) {
  const parsed = Number.parseInt(rawId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
