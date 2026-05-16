/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { AppError } from '../../utils/appError.mjs';

/**
 * @typedef {Error & {
 *   httpStatus?: number,
 *   extra?: Record<string, unknown>,
 * }} SettingsServiceError
 */

/**
 * @param {string} message
 * @param {number} httpStatus
 * @param {Record<string, unknown>} [extras]
 * @returns {SettingsServiceError}
 */
export function createSettingsServiceError(message, httpStatus, extras = {}) {
  const { code: rawCode, ...rest } = extras;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  const error = /** @type {SettingsServiceError} */ (new AppError(message, httpStatus, { code }));
  error.name = 'SettingsServiceError';
  error.httpStatus = httpStatus;
  error.extra = {
    ...(error.extra || {}),
    ...rest,
  };
  return error;
}
