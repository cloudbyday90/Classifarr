/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function buildMissingPathTestingPathResponse() {
  return {
    status: 400,
    body: { error: 'Path is required' },
  };
}

export function buildInvalidPathTestingMediaServerIdResponse() {
  return {
    status: 400,
    body: { error: 'mediaServerId must be a positive integer' },
  };
}

export function normalizePathAccessibilityRequest(body = {}) {
  if (!body.path) {
    return { errorResponse: buildMissingPathTestingPathResponse() };
  }

  return { payload: { path: body.path } };
}

export function buildPathTranslationPayload(body = {}) {
  return {
    plexPath: body.plexPath,
    arrPath: body.arrPath,
    classiflarrPath: body.classiflarrPath,
    sampleFile: body.sampleFile,
  };
}

export function parsePathTestingMediaServerId(rawMediaServerId) {
  const mediaServerId = Number.parseInt(String(rawMediaServerId), 10);
  return Number.isInteger(mediaServerId) && mediaServerId > 0 ? mediaServerId : null;
}

export function normalizePathMappingsRequest(rawMediaServerId) {
  const mediaServerId = parsePathTestingMediaServerId(rawMediaServerId);
  if (!mediaServerId) {
    return { errorResponse: buildInvalidPathTestingMediaServerIdResponse() };
  }

  return { payload: { mediaServerId } };
}
