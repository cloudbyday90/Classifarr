/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPathTranslationPayload,
  normalizePathAccessibilityRequest,
  normalizePathMappingsRequest,
} from './pathTestingSupport.mjs';

export function createPathTestingHandlers({ pathTestService }) {
  return {
    async testPath(req, res, next) {
      try {
        const normalizedRequest = normalizePathAccessibilityRequest(req.body);
        if (normalizedRequest.errorResponse) {
          return res.status(normalizedRequest.errorResponse.status).json(normalizedRequest.errorResponse.body);
        }

        const result = await pathTestService.testPathAccessibility(normalizedRequest.payload.path);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async testTranslation(req, res, next) {
      try {
        const result = await pathTestService.testPathTranslation(buildPathTranslationPayload(req.body));

        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async testMappings(req, res, next) {
      try {
        const normalizedRequest = normalizePathMappingsRequest(req.params.mediaServerId);
        if (normalizedRequest.errorResponse) {
          return res.status(normalizedRequest.errorResponse.status).json(normalizedRequest.errorResponse.body);
        }

        const result = await pathTestService.testAllMappings(normalizedRequest.payload.mediaServerId);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async healthCheck(_req, res, next) {
      try {
        const result = await pathTestService.healthCheck();
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async getMediaPathConfig(_req, res, next) {
      try {
        const result = await pathTestService.getMediaPathConfig();
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}
