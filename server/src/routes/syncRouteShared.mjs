/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createSyncRouter({ express, syncStatus, logger }) {
  const router = express.Router();

  router.get('/status', async (_req, res) => {
    try {
      const status = syncStatus.getStatus();
      return res.json(status);
    } catch (error) {
      logger.error('Failed to get sync status', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
