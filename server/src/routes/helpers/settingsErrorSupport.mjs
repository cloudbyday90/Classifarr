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
 *   currentSum?: number,
 * }} SettingsRouteError
 */

/**
 * @param {SettingsRouteError | undefined | null} error
 * @returns {string}
 */
export function getSettingsErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error';
}

/**
 * @param {SettingsRouteError | undefined | null} error
 * @param {number} [fallbackStatus=500]
 * @returns {number}
 */
export function getSettingsErrorStatus(error, fallbackStatus = 500) {
  return error?.httpStatus || fallbackStatus;
}

/**
 * @param {SettingsRouteError | undefined | null} error
 * @param {{ fallbackStatus?: number, extras?: Record<string, unknown> }} [options]
 */
export function buildSettingsErrorResponse(error, {
  fallbackStatus = 500,
  extras = {},
} = {}) {
  return {
    status: getSettingsErrorStatus(error, fallbackStatus),
    body: {
      error: getSettingsErrorMessage(error),
      ...extras,
    },
  };
}