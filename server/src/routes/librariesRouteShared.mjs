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
import { registerArrConfigRoutes } from './librariesRouteArrConfig.mjs';
import { registerRuleSuggestionRoutes } from './librariesRouteRuleSuggestions.mjs';
import { registerPatternRoutes } from './librariesRoutePatterns.mjs';
import { registerCrudRoutes } from './librariesRouteCrud.mjs';
import { registerOverlapRoutes } from './librariesRouteOverlap.mjs';
import { registerObservationHealthRoutes } from './librariesRouteObservationHealth.mjs';
import { registerObservationHistoryRoutes } from './librariesRouteObservationHistory.mjs';
import { registerLabelRoutes } from './librariesRouteLabels.mjs';
import { registerRulesRoutes } from './librariesRouteRules.mjs';
import { NotFoundError, ValidationError } from '../utils/appError.mjs';

function parseProfileLibraryId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new ValidationError('Invalid library ID', {
      message: 'Library ID must be a positive integer.',
    });
  }

  const libraryId = Number(value);
  if (!Number.isSafeInteger(libraryId)) {
    throw new ValidationError('Invalid library ID', {
      message: 'Library ID must be a positive integer.',
    });
  }

  return libraryId;
}

export function createLibrariesRouter({
  express,
  db,
  radarrService,
  sonarrService,
  ollamaService,
  mediaPatternAnalyzer,
  libraryProfileService,
  createLogger,
  normalizeMetadataListLower,
  authenticateTokenOrApiKey,
  requireReadWrite,
  mediaSyncService,
  metadataEnrichment,
}) {
  const router = express.Router();
  const logger = createLogger('libraries');

  router.use(authenticateTokenOrApiKey);

  registerOverlapRoutes(router, { db });
  registerObservationHealthRoutes(router, { db });
  registerObservationHistoryRoutes(router, { db });

  registerCrudRoutes(router, { db });

  registerArrConfigRoutes(router, { db, radarrService, sonarrService, requireReadWrite, logger });

  registerLabelRoutes(router, { db, requireReadWrite });

  registerRulesRoutes(router, { db, mediaSyncService, requireReadWrite, logger });

  registerRuleSuggestionRoutes(router, { db, ollamaService, normalizeMetadataListLower, requireReadWrite, metadataEnrichment, logger });

  registerPatternRoutes(router, { db, mediaPatternAnalyzer, requireReadWrite, logger });

  router.get('/:id/profile', asyncHandler(async (req, res) => {
      const libraryId = parseProfileLibraryId(req.params.id);

      const profile = await libraryProfileService.getProfile(libraryId);
      if (!profile) {
        throw new NotFoundError('Profile not found', {
          message: 'The server-managed profile lifecycle has not generated a profile for this library yet.',
        });
      }

      // Keep the additive observation_summary with the stored distributions; reads never regenerate it.
      res.json(profile);
  }));

  router.post('/:id/profile/refresh', requireReadWrite, asyncHandler(async (req, res) => {
      const libraryId = parseProfileLibraryId(req.params.id);

      logger.info('Regenerating library profile from explicit maintenance request', { libraryId });

      const profile = await libraryProfileService.generateProfile(libraryId);

      if (!profile) {
        throw new ValidationError('Cannot generate profile', {
          message: 'Library has no synced items',
        });
      }

      res.json({ success: true, profile });
  }));

  return router;
}
