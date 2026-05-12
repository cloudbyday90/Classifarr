/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function getAiReadErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error';
}

export function buildAiUsageSuccessResponse(summary) {
  return {
    status: 200,
    body: summary,
  };
}

export function buildAiUsageErrorResponse(error, fallback) {
  if (error?.code === '42P01') {
    return {
      status: 200,
      body: fallback,
    };
  }

  return {
    status: 500,
    body: {
      error: getAiReadErrorMessage(error),
    },
  };
}

export function buildAiStatusSuccessResponse(status) {
  return {
    status: 200,
    body: status,
  };
}

export function buildAiStatusErrorResponse(error) {
  return {
    status: 500,
    body: {
      error: getAiReadErrorMessage(error),
    },
  };
}
