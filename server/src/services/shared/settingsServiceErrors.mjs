/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * @typedef {Error & {
 *   httpStatus?: number,
 * }} SettingsServiceError
 */

/**
 * @param {string} message
 * @param {number} httpStatus
 * @param {Record<string, unknown>} [extras]
 * @returns {SettingsServiceError}
 */
export function createSettingsServiceError(message, httpStatus, extras = {}) {
  const error = /** @type {SettingsServiceError} */ (new Error(message));
  error.name = 'SettingsServiceError';
  error.httpStatus = httpStatus;
  Object.assign(error, extras);
  return error;
}