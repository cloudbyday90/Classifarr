/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function getAiSettingsErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error';
}

export function getAiSettingsErrorStatus(error, fallbackStatus = 500) {
  return error?.httpStatus || fallbackStatus;
}
