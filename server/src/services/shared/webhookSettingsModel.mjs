/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { maskConfigWithSecret } from '../webhookServiceShared.mjs';
import { isMaskedToken } from '../../utils/tokenMasking.mjs';

const WEBHOOK_MASK_CHAR = '•';
export const WEBHOOK_SECRET_STATUS = Object.freeze({
  AVAILABLE: 'available',
  MISSING: 'missing',
  UNAVAILABLE: 'unavailable',
});

export function isMaskedWebhookSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return false;
  }

  return isMaskedToken(secret) || secret.includes(WEBHOOK_MASK_CHAR);
}

export function maskWebhookSecret(config, fullSecret = null) {
  return maskConfigWithSecret(config, fullSecret);
}

export function resolveWebhookSecretStatus(config, fullSecret = null) {
  if (fullSecret) {
    return WEBHOOK_SECRET_STATUS.AVAILABLE;
  }

  if (config?.secret_key) {
    return WEBHOOK_SECRET_STATUS.UNAVAILABLE;
  }

  return WEBHOOK_SECRET_STATUS.MISSING;
}

export function annotateWebhookSecretStatus(config, fullSecret = null) {
  return {
    ...(config ?? {}),
    secret_key_status: resolveWebhookSecretStatus(config, fullSecret),
  };
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
