/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function getAiActionErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error';
}

export function buildAiTestConnectionSuccessResponse(result) {
  return {
    status: 200,
    body: result,
  };
}

export function buildAiTestConnectionErrorResponse(error) {
  return {
    status: error.httpStatus || 200,
    body: {
      success: false,
      error: getAiActionErrorMessage(error),
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
    status: error.httpStatus || 200,
    body: {
      success: false,
      error: getAiActionErrorMessage(error),
      models: [],
    },
  };
}
