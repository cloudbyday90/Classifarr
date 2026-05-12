/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

export function normalizeOllamaHost(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return '';
  }
  return String(value).trim();
}

export function normalizeOllamaPort(value) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function sendOllamaSettingsErrorResponse(res, error) {
  const response = buildSettingsErrorResponse(error);
  return res.status(response.status).json(response.body);
}
