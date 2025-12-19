/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const express = require('express');
const mediaSyncService = require('../services/mediaSync');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('mediaSync-routes');

/**
 * @route POST /api/media-sync/sync/:libraryId
 * @desc Trigger library sync
 */
router.post('/sync/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { incremental = false, batchSize = 100 } = req.body;

    logger.info('Starting library sync', { libraryId, incremental });

    const result = await mediaSyncService.syncLibrary(parseInt(libraryId), {
      incremental,
      batchSize,
    });

    res.json(result);
  } catch (error) {
    logger.error('Sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/media-sync/items/:libraryId
 * @desc Get synced items for a library
 */
router.get('/items/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await mediaSyncService.getLibraryItems(parseInt(libraryId), {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(result);
  } catch (error) {
    logger.error('Error getting library items', { error: error.message });
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * @route GET /api/media-sync/lookup/:tmdbId
 * @desc Check if media exists in any library
 */
router.get('/lookup/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { mediaType = 'movie' } = req.query;

    const result = await mediaSyncService.findExistingMedia(
      parseInt(tmdbId),
      mediaType
    );

    if (result) {
      res.json({
        exists: true,
        item: result,
      });
    } else {
      res.json({
        exists: false,
      });
    }
  } catch (error) {
    logger.error('Error looking up media', { error: error.message });
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * @route GET /api/media-sync/sync/status
 * @desc Get sync status for libraries
 */
router.get('/sync/status', async (req, res) => {
  try {
    const { libraryId } = req.query;

    const result = await mediaSyncService.getSyncStatus(
      libraryId ? parseInt(libraryId) : null
    );

    res.json(result);
  } catch (error) {
    logger.error('Error getting sync status', { error: error.message });
    res.status(500).json({
      error: error.message,
    });
  }
});

module.exports = router;
