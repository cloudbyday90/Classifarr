/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createArrConfigHandlers, createArrConfigStatusHandler } from './arrConfigHandlers.mjs';

export function createArrSettingsRouteHandlers({
  database,
  radarrService,
  sonarrService,
}) {
  const radarrHandlers = createArrConfigHandlers({
    db: database,
    table: 'radarr_config',
    entityLabel: 'Radarr',
    service: radarrService,
    defaultPort: 7878,
    extraColumns: ['media_server_id', 'quality_profile_id', 'minimum_availability'],
    createDefaults: {
      media_server_id: null,
      quality_profile_id: null,
      minimum_availability: 'released',
    },
  });

  const sonarrHandlers = createArrConfigHandlers({
    db: database,
    table: 'sonarr_config',
    entityLabel: 'Sonarr',
    service: sonarrService,
    defaultPort: 8989,
    extraColumns: ['media_server_id', 'quality_profile_id', 'monitor', 'series_type'],
    createDefaults: {
      media_server_id: null,
      quality_profile_id: null,
      monitor: 'all',
      series_type: 'standard',
    },
  });

  return {
    arrConfigStatusHandler: createArrConfigStatusHandler({ db: database }),
    radarrHandlers,
    sonarrHandlers,
  };
}