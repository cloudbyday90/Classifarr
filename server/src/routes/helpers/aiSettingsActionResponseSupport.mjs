/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getAiSettingsErrorMessage } from './aiSettingsErrorSupport.mjs';
import { getAiSettingsErrorStatus } from './aiSettingsErrorSupport.mjs';

export function buildAiTestConnectionSuccessResponse(result) {
  return {
    status: 200,
    body: result,
  };
}

export function buildAiTestConnectionErrorResponse(error) {
  return {
    status: getAiSettingsErrorStatus(error, 200),
    body: {
      success: false,
      error: getAiSettingsErrorMessage(error),
    },
  };
}

export function buildAiModelsSuccessResponse(result) {
  return {
    status: 200,
    body: result,
  };
}

export function buildAiModelsErrorResponse(error) {
  return {
    status: getAiSettingsErrorStatus(error, 200),
    body: {
      success: false,
      error: getAiSettingsErrorMessage(error),
      models: [],
    },
  };
}
