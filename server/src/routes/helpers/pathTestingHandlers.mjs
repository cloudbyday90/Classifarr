/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
import {
  buildPathTranslationPayload,
  normalizePathAccessibilityRequest,
  normalizePathMappingsRequest,
} from './pathTestingSupport.mjs';

export function createPathTestingHandlers({ pathTestService }) {
  return {
    async testPath(req, res) {
      try {
        const normalizedRequest = normalizePathAccessibilityRequest(req.body);
        if (normalizedRequest.errorResponse) {
          return res.status(normalizedRequest.errorResponse.status).json(normalizedRequest.errorResponse.body);
        }

        const result = await pathTestService.testPathAccessibility(normalizedRequest.payload.path);
        return res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async testTranslation(req, res) {
      try {
        const result = await pathTestService.testPathTranslation(buildPathTranslationPayload(req.body));

        return res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async testMappings(req, res) {
      try {
        const normalizedRequest = normalizePathMappingsRequest(req.params.mediaServerId);
        if (normalizedRequest.errorResponse) {
          return res.status(normalizedRequest.errorResponse.status).json(normalizedRequest.errorResponse.body);
        }

        const result = await pathTestService.testAllMappings(normalizedRequest.payload.mediaServerId);
        return res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async healthCheck(_req, res) {
      try {
        const result = await pathTestService.healthCheck();
        return res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async getMediaPathConfig(_req, res) {
      try {
        const result = await pathTestService.getMediaPathConfig();
        return res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },
  };
}

