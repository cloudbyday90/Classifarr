/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse, getSettingsErrorMessage } from './settingsErrorSupport.mjs';

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
