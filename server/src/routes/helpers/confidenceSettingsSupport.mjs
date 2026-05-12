/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function buildConfidenceSettingsResponse(rows = []) {
  return rows.reduce((accumulator, row) => {
    accumulator[row.setting_key] = {
      value: row.setting_value,
      description: row.description,
      default: row.default_value,
    };
    return accumulator;
  }, {});
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

export function normalizeConfidenceSettingsUpdateRequest(body) {
  if (!isPlainObject(body)) {
    return { errorResponse: buildInvalidConfidenceSettingsObjectResponse() };
  }

  return { payload: body };
}

export function normalizeConfidenceSettingsImportRequest(settings) {
  if (!Array.isArray(settings)) {
    return { errorResponse: buildInvalidConfidenceSettingsArrayResponse() };
  }

  return { payload: settings };
}

export function normalizeConfidenceHistoryPagination(query = {}, maxLimit = 1000) {
  const rawLimit = query.limit;
  const rawOffset = query.offset;

  const limit = rawLimit === undefined ? 50 : Number.parseInt(rawLimit, 10);
  const offset = rawOffset === undefined ? 0 : Number.parseInt(rawOffset, 10);

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

export function buildConfidenceExportResponse(rows = [], username = 'unknown') {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: username,
    settings: rows,
  };
}

export function sendConfidenceSettingsErrorResponse(res, error, fallbackMessage) {
  if (error?.httpStatus) {
    return res.status(error.httpStatus).json({ error: error.message });
  }

  return res.status(500).json({ error: fallbackMessage });
}
