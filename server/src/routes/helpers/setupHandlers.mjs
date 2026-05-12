/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeSetupMediaPath, sendSetupErrorResponse } from './setupSupport.mjs';

export function createSetupHandlers({ startupService }) {
  return {
    async getSetupStatus(_req, res) {
      try {
        const status = await startupService.getSetupStatus();
        return res.json(status);
      } catch (error) {
        return sendSetupErrorResponse(res, error);
      }
    },

    async setMediaPath(req, res) {
      try {
        const path = normalizeSetupMediaPath(req.body?.path);

        if (!path) {
          return res.status(400).json({ error: 'Path is required' });
        }

        await startupService.setMediaPath(path);
        const status = await startupService.checkMediaPathStatus();
        return res.json(status);
      } catch (error) {
        return sendSetupErrorResponse(res, error);
      }
    },
  };
}


