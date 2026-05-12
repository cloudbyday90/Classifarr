/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

export function createPathTestingHandlers({ pathTestService }) {
  return {
    async testPath(req, res) {
      try {
        const { path } = req.body;

        if (!path) {
          return res.status(400).json({ error: 'Path is required' });
        }

        const result = await pathTestService.testPathAccessibility(path);
        return res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async testTranslation(req, res) {
      try {
        const { plexPath, arrPath, classiflarrPath, sampleFile } = req.body;
        const result = await pathTestService.testPathTranslation({
          plexPath,
          arrPath,
          classiflarrPath,
          sampleFile,
        });

        return res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async testMappings(req, res) {
      try {
        const mediaServerId = Number.parseInt(String(req.params.mediaServerId), 10);

        if (!Number.isInteger(mediaServerId) || mediaServerId <= 0) {
          return res.status(400).json({ error: 'mediaServerId must be a positive integer' });
        }

        const result = await pathTestService.testAllMappings(mediaServerId);
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

