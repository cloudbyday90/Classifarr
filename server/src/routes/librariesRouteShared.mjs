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
import { registerLabelRoutes } from './librariesRouteLabels.mjs';
import { registerRulesRoutes } from './librariesRouteRules.mjs';
import { NotFoundError, ValidationError } from '../utils/appError.mjs';

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

  registerCrudRoutes(router, { db });

  registerArrConfigRoutes(router, { db, radarrService, sonarrService, requireReadWrite, logger });

  registerLabelRoutes(router, { db, requireReadWrite });

  registerRulesRoutes(router, { db, mediaSyncService, requireReadWrite, logger });

  registerRuleSuggestionRoutes(router, { db, ollamaService, normalizeMetadataListLower, requireReadWrite, metadataEnrichment, logger });

  registerPatternRoutes(router, { db, mediaPatternAnalyzer, requireReadWrite, logger });

  router.get('/:id/profile', asyncHandler(async (req, res) => {
      const { id } = req.params;

      const profile = await libraryProfileService.getProfile(parseInt(id));
      if (!profile) {
        throw new NotFoundError('Profile not found', {
          message: 'Profile will be generated after library sync and enrichment',
        });
      }

      res.json(profile);
  }));

  router.post('/:id/profile/refresh', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;

      logger.info('Refreshing library profile', { libraryId: id });

      const profile = await libraryProfileService.generateProfile(parseInt(id));

      if (!profile) {
        throw new ValidationError('Cannot generate profile', {
          message: 'Library has no synced items',
        });
      }

      res.json({ success: true, profile });
  }));

  return router;
}
