/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';

export function registerMediaConfigRoutes(router, { radarrHandlers, sonarrHandlers, arrConfigStatusHandler }) {
  router.get('/radarr', asyncHandler(radarrHandlers.list));
  router.post('/radarr', asyncHandler(radarrHandlers.create));
  router.put('/radarr/:id', asyncHandler(radarrHandlers.update));
  router.delete('/radarr/:id', asyncHandler(radarrHandlers.remove));
  router.post('/radarr/test', asyncHandler(radarrHandlers.test));
  router.get('/radarr/:id/root-folders', asyncHandler(radarrHandlers.rootFolders));
  router.get('/radarr/:id/quality-profiles', asyncHandler(radarrHandlers.qualityProfiles));

  router.get('/sonarr', asyncHandler(sonarrHandlers.list));
  router.post('/sonarr', asyncHandler(sonarrHandlers.create));
  router.put('/sonarr/:id', asyncHandler(sonarrHandlers.update));
  router.delete('/sonarr/:id', asyncHandler(sonarrHandlers.remove));
  router.post('/sonarr/test', asyncHandler(sonarrHandlers.test));
  router.get('/sonarr/:id/root-folders', asyncHandler(sonarrHandlers.rootFolders));
  router.get('/sonarr/:id/quality-profiles', asyncHandler(sonarrHandlers.qualityProfiles));

  router.get('/arr-config-status', asyncHandler(arrConfigStatusHandler));
}
