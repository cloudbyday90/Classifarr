/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';

export function createMediaSyncRouter({
  express,
  createLogger,
  syncStatus,
  authenticateTokenOrApiKey,
  requireReadWrite,
  mediaSyncService,
}) {
  const router = express.Router();
  const logger = createLogger('mediaSync-routes');

  router.use(authenticateTokenOrApiKey);

  router.post('/sync/:libraryId', requireReadWrite, asyncHandler(async (req, res) => {
    const { libraryId } = req.params;
    const { incremental = false, batchSize = 100 } = req.body;

    const startResult = syncStatus.tryStart('library_sync');
    if (!startResult.started) {
      return res.status(409).json({
        error: 'Sync already in progress',
        message: startResult.reason,
        progress: startResult.progress,
      });
    }

    try {
      logger.info('Starting library sync', { libraryId, incremental });

      const result = await mediaSyncService.syncLibrary(Number.parseInt(libraryId, 10), {
        incremental,
        batchSize,
      });

      syncStatus.stop();
      sendData(res, result);
    } catch (error) {
      syncStatus.stop();
      throw error;
    }
  }));

  router.get('/items/:libraryId', asyncHandler(async (req, res) => {
    const libraryId = parseIntParam(req.params.libraryId, null, 1);
    if (libraryId === null) {
      throw new ValidationError('Invalid library ID');
    }

    const result = await mediaSyncService.getLibraryItems(libraryId, {
      limit: parseIntParam(req.query.limit, 50, 1),
      offset: parseIntParam(req.query.offset, 0, 0),
    });

    sendData(res, result);
  }));

  router.get('/lookup/:tmdbId', asyncHandler(async (req, res) => {
    const { tmdbId } = req.params;
    const { mediaType = 'movie' } = req.query;

    const result = await mediaSyncService.findExistingMedia(
      Number.parseInt(tmdbId, 10),
      mediaType
    );

    if (result) {
      sendData(res, { exists: true, item: result });
    } else {
      sendData(res, { exists: false });
    }
  }));

  router.get('/sync/status', asyncHandler(async (req, res) => {
    const { libraryId } = req.query;

    const result = await mediaSyncService.getSyncStatus(
      libraryId ? Number.parseInt(libraryId, 10) : null
    );

    sendData(res, result);
  }));

  return router;
}
