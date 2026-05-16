/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import { sendData } from '../../utils/responseHelpers.mjs';
import {
  buildPathTranslationPayload,
  normalizePathAccessibilityRequest,
  normalizePathMappingsRequest,
} from './pathTestingSupport.mjs';

function requirePathAccessibilityPayload(body) {
  const normalizedRequest = normalizePathAccessibilityRequest(body);
  if (normalizedRequest.errorResponse) {
    throw new ValidationError(normalizedRequest.errorResponse.body.error);
  }

  return normalizedRequest.payload;
}

function requirePathMappingsPayload(rawMediaServerId) {
  const normalizedRequest = normalizePathMappingsRequest(rawMediaServerId);
  if (normalizedRequest.errorResponse) {
    throw new ValidationError(normalizedRequest.errorResponse.body.error);
  }

  return normalizedRequest.payload;
}

export function createPathTestingHandlers({ pathTestService }) {
  return {
    testPath: asyncHandler(async (req, res) => {
      const { path } = requirePathAccessibilityPayload(req.body);
      const result = await pathTestService.testPathAccessibility(path);
      return sendData(res, result);
    }),

    testTranslation: asyncHandler(async (req, res) => {
      const result = await pathTestService.testPathTranslation(buildPathTranslationPayload(req.body));
      return sendData(res, result);
    }),

    testMappings: asyncHandler(async (req, res) => {
      const { mediaServerId } = requirePathMappingsPayload(req.params.mediaServerId);
      const result = await pathTestService.testAllMappings(mediaServerId);
      return sendData(res, result);
    }),

    healthCheck: asyncHandler(async (_req, res) => {
      const result = await pathTestService.healthCheck();
      return sendData(res, result);
    }),

    getMediaPathConfig: asyncHandler(async (_req, res) => {
      const result = await pathTestService.getMediaPathConfig();
      return sendData(res, result);
    }),
  };
}
