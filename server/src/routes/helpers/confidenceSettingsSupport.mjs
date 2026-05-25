/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
import { isPlainObject } from '../../utils/stringUtils.mjs';

/**
 * @typedef {{
 *   setting_key: string,
 *   setting_value: string,
 *   description?: string,
 *   default_value?: string,
 * }} ConfidenceSettingRow
 */

/**
 * @typedef {{
 *   status: (code: number) => ConfidenceResponse,
 *   json: (body: unknown) => unknown,
 * }} ConfidenceResponse
 */

/**
 * @typedef {Error & {
 *   httpStatus?: number,
 * }} ConfidenceSupportError
 */

/**
 * @param {ConfidenceSettingRow[]} [rows=[]]
 */
export function buildConfidenceSettingsResponse(rows = []) {
  return rows.reduce((accumulator, row) => {
    accumulator[row.setting_key] = {
      value: row.setting_value,
      description: row.description,
      default: row.default_value,
    };
    return accumulator;
  }, /** @type {Record<string, { value: string, description?: string, default?: string }>} */ ({}));
}

export function buildInvalidConfidenceSettingsObjectResponse() {
  return {
    status: 400,
    body: { error: 'Settings must be a valid object' },
  };
}

export function buildInvalidConfidenceSettingsArrayResponse() {
  return {
    status: 400,
    body: { error: 'Settings must be an array' },
  };
}

export function buildInvalidConfidenceHistoryPaginationResponse(maxLimit) {
  return {
    status: 400,
    body: {
      error: `Invalid pagination parameters. 'limit' must be a positive integer up to ${maxLimit}, and 'offset' must be a non-negative integer.`,
    },
  };
}

/**
 * @param {Record<string, unknown>} body
 */
export function normalizeConfidenceSettingsUpdateRequest(body) {
  if (!isPlainObject(body)) {
    return { errorResponse: buildInvalidConfidenceSettingsObjectResponse() };
  }

  return { payload: body };
}

/**
 * @param {ConfidenceSettingRow[] | unknown} settings
 */
export function normalizeConfidenceSettingsImportRequest(settings) {
  if (!Array.isArray(settings)) {
    return { errorResponse: buildInvalidConfidenceSettingsArrayResponse() };
  }

  return { payload: settings };
}

/**
 * @param {{ limit?: string | number, offset?: string | number }} [query={}]
 * @param {number} [maxLimit=1000]
 */
export function normalizeConfidenceHistoryPagination(query = {}, maxLimit = 1000) {
  const rawLimit = query.limit;
  const rawOffset = query.offset;

  const limit = rawLimit === undefined ? 50 : Number.parseInt(String(rawLimit), 10);
  const offset = rawOffset === undefined ? 0 : Number.parseInt(String(rawOffset), 10);

  if (
    !Number.isInteger(limit) ||
    !Number.isInteger(offset) ||
    limit <= 0 ||
    limit > maxLimit ||
    offset < 0
  ) {
    return { errorResponse: buildInvalidConfidenceHistoryPaginationResponse(maxLimit) };
  }

  return { payload: { limit, offset } };
}

/**
 * @param {ConfidenceSettingRow[]} [rows=[]]
 * @param {string} [username='unknown']
 */
export function buildConfidenceExportResponse(rows = [], username = 'unknown') {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: username,
    settings: rows,
  };
}

/**
 * @internal
 * @param {ConfidenceResponse} res
 * @param {ConfidenceSupportError | Error | undefined | null} error
 * @param {string} fallbackMessage
 */
export function sendConfidenceSettingsErrorResponse(res, error, fallbackMessage) {
  const response = buildSettingsErrorResponse(error, { fallbackStatus: 500 });
  if (response.status === 500) {
    return res.status(500).json({ error: fallbackMessage });
  }

  return res.status(response.status).json(response.body);
}
