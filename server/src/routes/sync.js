/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const express = require('express');
const router = express.Router();
const syncStatus = require('../services/syncStatus');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SyncRoutes');

/**
 * GET /api/sync/status
 * Returns current sync status for UI
 */
router.get('/status', async (req, res) => {
  try {
    const status = syncStatus.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get sync status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
