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
 * @typedef {{
 *   status: number,
 *   body: Record<string, unknown>,
 * }} SettingsActionResponse
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

/**
 * Executes a settings action and sends the success or error response.
 * Centralizes the try/catch + build-success/build-error + res.status().json()
 * pattern shared across AI and webhook settings handlers.
 *
 * @param {{
 *   action: () => Promise<unknown>,
 *   buildSuccess: (result: unknown) => SettingsActionResponse,
 *   buildError: (error: unknown) => SettingsActionResponse,
 * }} params
 * @param {import('express').Response} res
 */
export async function trySettingsAction({ action, buildSuccess, buildError }, res) {
  try {
    const response = buildSuccess(await action());
    return res.status(response.status).json(response.body);
  } catch (error) {
    const response = buildError(error);
    return res.status(response.status).json(response.body);
  }
}