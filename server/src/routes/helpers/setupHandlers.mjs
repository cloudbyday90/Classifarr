/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createSetupHandlers({ service }) {
  return {
    async getSetupStatus(_req, res) {
      try {
        const status = await service.getSetupStatus();
        return res.json(status);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async setMediaPath(req, res) {
      try {
        const rawPath = req.body?.path;
        const path = typeof rawPath === 'string' ? rawPath.trim() : '';

        if (!path) {
          return res.status(400).json({ error: 'Path is required' });
        }

        await service.setMediaPath(path);
        const status = await service.checkMediaPathStatus();
        return res.json(status);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  };
}

export default {
  createSetupHandlers,
};