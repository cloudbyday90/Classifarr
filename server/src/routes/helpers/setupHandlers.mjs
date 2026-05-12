/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

export function createSetupHandlers({ startupService }) {
  return {
    async getSetupStatus(_req, res) {
      try {
        const status = await startupService.getSetupStatus();
        return res.json(status);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async setMediaPath(req, res) {
      try {
        const rawPath = req.body?.path;
        const path = typeof rawPath === 'string' ? rawPath.trim() : '';

        if (!path) {
          return res.status(400).json({ error: 'Path is required' });
        }

        await startupService.setMediaPath(path);
        const status = await startupService.checkMediaPathStatus();
        return res.json(status);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },
  };
}

