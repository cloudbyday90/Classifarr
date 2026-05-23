/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function registerMediaConfigRoutes(router, { radarrHandlers, sonarrHandlers, arrConfigStatusHandler }) {
  router.get('/radarr', radarrHandlers.list);
  router.post('/radarr', radarrHandlers.create);
  router.put('/radarr/:id', radarrHandlers.update);
  router.delete('/radarr/:id', radarrHandlers.remove);
  router.post('/radarr/test', radarrHandlers.test);
  router.get('/radarr/:id/root-folders', radarrHandlers.rootFolders);
  router.get('/radarr/:id/quality-profiles', radarrHandlers.qualityProfiles);

  router.get('/sonarr', sonarrHandlers.list);
  router.post('/sonarr', sonarrHandlers.create);
  router.put('/sonarr/:id', sonarrHandlers.update);
  router.delete('/sonarr/:id', sonarrHandlers.remove);
  router.post('/sonarr/test', sonarrHandlers.test);
  router.get('/sonarr/:id/root-folders', sonarrHandlers.rootFolders);
  router.get('/sonarr/:id/quality-profiles', sonarrHandlers.qualityProfiles);

  router.get('/arr-config-status', arrConfigStatusHandler);
}
