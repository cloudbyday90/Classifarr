/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';

const createArrConfigHandlers = jest.fn(({ table }) => ({ table }));
const createArrConfigStatusHandler = jest.fn(({ db }) => ({ db, type: 'status-handler' }));

jest.unstable_mockModule('../routes/helpers/arrConfigHandlers.mjs', () => ({
  createArrConfigHandlers,
  createArrConfigStatusHandler,
}));

const { createArrSettingsRouteHandlers } = await import('../routes/helpers/arrSettingsRouteHandlers.mjs');

describe('arrSettingsRouteHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assembles Radarr, Sonarr, and ARR status handlers with the expected dependency bags', () => {
    const database = { kind: 'database' };
    const radarrService = { kind: 'radarr-service' };
    const sonarrService = { kind: 'sonarr-service' };

    const result = createArrSettingsRouteHandlers({
      database,
      radarrService,
      sonarrService,
    });

    expect(createArrConfigHandlers).toHaveBeenNthCalledWith(1, {
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
    expect(createArrConfigHandlers).toHaveBeenNthCalledWith(2, {
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
    expect(createArrConfigStatusHandler).toHaveBeenCalledWith({ db: database });

    expect(result).toEqual({
      arrConfigStatusHandler: { db: database, type: 'status-handler' },
      radarrHandlers: { table: 'radarr_config' },
      sonarrHandlers: { table: 'sonarr_config' },
    });
  });
});