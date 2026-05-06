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

export function createMediaSyncRouter({
  express,
  createLogger,
  syncStatus,
  authenticateTokenOrApiKey,
  requireReadWrite,
  mediaSyncService,
  errors,
}) {
  const router = express.Router();
  const logger = createLogger('mediaSync-routes');

  router.use(authenticateTokenOrApiKey);

  router.post('/sync/:libraryId', requireReadWrite, async (req, res) => {
    try {
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

      logger.info('Starting library sync', { libraryId, incremental });

      const result = await mediaSyncService.syncLibrary(Number.parseInt(libraryId, 10), {
        incremental,
        batchSize,
      });

      syncStatus.stop();
      res.json(result);
    } catch (error) {
      syncStatus.stop();

      const { isLibraryNotFoundError } = errors;
      if (isLibraryNotFoundError(error)) {
        return res.status(404).json(error.toJSON());
      }

      logger.error('Sync failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  router.get('/items/:libraryId', async (req, res) => {
    try {
      const { libraryId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await mediaSyncService.getLibraryItems(Number.parseInt(libraryId, 10), {
        limit: Number.parseInt(limit, 10),
        offset: Number.parseInt(offset, 10),
      });

      res.json(result);
    } catch (error) {
      const { isLibraryNotFoundError } = errors;
      if (isLibraryNotFoundError(error)) {
        return res.status(404).json(error.toJSON());
      }

      logger.error('Error getting library items', { error: error.message });
      res.status(500).json({
        error: error.message,
      });
    }
  });

  router.get('/lookup/:tmdbId', async (req, res) => {
    try {
      const { tmdbId } = req.params;
      const { mediaType = 'movie' } = req.query;

      const result = await mediaSyncService.findExistingMedia(
        Number.parseInt(tmdbId, 10),
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

  router.get('/sync/status', async (req, res) => {
    try {
      const { libraryId } = req.query;

      const result = await mediaSyncService.getSyncStatus(
        libraryId ? Number.parseInt(libraryId, 10) : null
      );

      res.json(result);
    } catch (error) {
      logger.error('Error getting sync status', { error: error.message });
      res.status(500).json({
        error: error.message,
      });
    }
  });

  return router;
}
