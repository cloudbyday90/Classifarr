/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

/**
 * @typedef {{
 *   status: (code: number) => OllamaResponse,
 *   json: (body: unknown) => unknown,
 * }} OllamaResponse
 */

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function normalizeOllamaHost(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return '';
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {number | null | undefined}
 */
export function normalizeOllamaPort(value) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param {OllamaResponse} res
 * @param {Error & { httpStatus?: number }} error
 */
export function sendOllamaSettingsErrorResponse(res, error) {
  const response = buildSettingsErrorResponse(error);
  return res.status(response.status).json(response.body);
}
