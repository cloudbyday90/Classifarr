/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { maskWebhookSecret } from '../../services/shared/webhookSettingsModel.mjs';

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
