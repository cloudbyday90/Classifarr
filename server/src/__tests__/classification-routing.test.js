/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Classification Routing Tests - Mapping fallback
 */

jest.mock('../config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  pool: { connect: jest.fn() }
}));
jest.mock('../services/radarr');
jest.mock('../services/sonarr');
jest.mock('../services/tmdb', () => ({
  getExternalIds: jest.fn()
}));
jest.mock('../services/providerLock', () => ({
  loadConfig: jest.fn(),
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn(),
  heartbeat: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

const db = require('../config/database');
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const tmdbService = require('../services/tmdb');
const classificationService = require('../services/classification');
const { createConsoleSpy } = require('./setup/consoleHelpers');

describe('ClassificationService - routeToArr mapping fallback', () => {
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleWarnSpy = createConsoleSpy('warn', { suppress: true });
    consoleErrorSpy = createConsoleSpy('error', { suppress: true });
  });

  afterAll(() => {
    consoleWarnSpy.restore();
    consoleErrorSpy.restore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes using library_arr_mappings when arr_id is missing', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          library_id: 1,
          arr_type: 'radarr',
          arr_config_id: 5,
          arr_root_folder_path: '/movies',
          quality_profile_id: 4
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 5,
          url: 'http://radarr:7878',
          api_key: 'test-key',
          is_active: true
        }]
      });

    radarrService.addMovie.mockResolvedValueOnce({});

    await classificationService.routeToArr(
      { title: 'Test Movie', tmdb_id: 123, year: 2024 },
      { id: 1, arr_type: 'radarr', arr_id: null, radarr_settings: {}, root_folder: null, quality_profile_id: null }
    );

    expect(radarrService.addMovie).toHaveBeenCalledWith(
      'http://radarr:7878',
      'test-key',
      expect.objectContaining({
        rootFolderPath: '/movies',
        qualityProfileId: 4
      })
    );
  });

  test('routes Sonarr using TVDB lookup and requested seasons', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 2,
        url: 'http://sonarr:8989',
        api_key: 'sonarr-key',
        is_active: true
      }]
    });

    tmdbService.getExternalIds.mockResolvedValueOnce({ tvdb_id: 123 });
    sonarrService.searchSeries.mockResolvedValueOnce([
      {
        tvdbId: 123,
        title: 'Test Series',
        seasons: [
          { seasonNumber: 0, monitored: true },
          { seasonNumber: 1, monitored: false }
        ]
      }
    ]);
    sonarrService.addSeries.mockResolvedValueOnce({});

    await classificationService.routeToArr(
      {
        title: 'Test Series',
        tmdb_id: 999,
        requested_seasons: [0, 1],
        include_specials: false
      },
      {
        id: 10,
        arr_type: 'sonarr',
        arr_id: 2,
        sonarr_settings: {
          root_folder_path: '/tv',
          quality_profile_id: 7,
          season_monitoring: 'all',
          search_on_add: true,
          season_folder: true,
          monitor: true
        }
      }
    );

    expect(sonarrService.searchSeries).toHaveBeenCalledWith(
      'http://sonarr:8989',
      'sonarr-key',
      123
    );
    expect(sonarrService.addSeries).toHaveBeenCalledTimes(1);
    const addPayload = sonarrService.addSeries.mock.calls[0][2];
    expect(addPayload.addOptions).toEqual(expect.objectContaining({
      searchForMissingEpisodes: true,
      monitor: 'all'
    }));
    const season0 = addPayload.seasons.find(season => season.seasonNumber === 0);
    const season1 = addPayload.seasons.find(season => season.seasonNumber === 1);
    expect(season0.monitored).toBe(false);
    expect(season1.monitored).toBe(true);
  });

  test('skips Sonarr add when lookup lacks English title', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 2,
        url: 'http://sonarr:8989',
        api_key: 'sonarr-key',
        is_active: true
      }]
    });

    tmdbService.getExternalIds.mockResolvedValueOnce({ tvdb_id: 123 });
    sonarrService.searchSeries.mockResolvedValueOnce([
      {
        tvdbId: 123,
        title: '',
        seasons: []
      }
    ]);

    await classificationService.routeToArr(
      {
        title: 'Test Series',
        tmdb_id: 999
      },
      {
        id: 10,
        arr_type: 'sonarr',
        arr_id: 2,
        sonarr_settings: {
          root_folder_path: '/tv',
          quality_profile_id: 7,
          season_monitoring: 'all',
          search_on_add: true
        }
      }
    );

    expect(sonarrService.addSeries).not.toHaveBeenCalled();
  });

  test('routes Radarr with search-on-add and monitoring settings', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 4,
        url: 'http://radarr:7878',
        api_key: 'radarr-key',
        is_active: true
      }]
    });

    radarrService.addMovie.mockResolvedValueOnce({});

    await classificationService.routeToArr(
      {
        title: 'Test Movie',
        tmdb_id: 777,
        year: 2024
      },
      {
        id: 11,
        arr_type: 'radarr',
        arr_id: 4,
        radarr_settings: {
          root_folder_path: '/movies',
          quality_profile_id: 3,
          monitor: false,
          search_on_add: false
        }
      }
    );

    expect(radarrService.addMovie).toHaveBeenCalledWith(
      'http://radarr:7878',
      'radarr-key',
      expect.objectContaining({
        rootFolderPath: '/movies',
        qualityProfileId: 3,
        monitored: false,
        addOptions: expect.objectContaining({
          searchForMovie: false
        })
      })
    );
  });

  test('falls back to Radarr config quality profile when library settings are missing', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 9,
        url: 'http://radarr:7878',
        api_key: 'radarr-key',
        quality_profile_id: 11,
        is_active: true
      }]
    });

    radarrService.addMovie.mockResolvedValueOnce({});

    await classificationService.routeToArr(
      {
        title: 'Config Profile Movie',
        tmdb_id: 321,
        year: 2025
      },
      {
        id: 12,
        arr_type: 'radarr',
        arr_id: 9,
        radarr_settings: {},
        root_folder: '/movies',
        quality_profile_id: null
      }
    );

    expect(radarrService.addMovie).toHaveBeenCalledWith(
      'http://radarr:7878',
      'radarr-key',
      expect.objectContaining({
        rootFolderPath: '/movies',
        qualityProfileId: 11
      })
    );
  });

  test('coerces Radarr quality profile IDs to numbers', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 10,
        url: 'http://radarr:7878',
        api_key: 'radarr-key',
        quality_profile_id: 12,
        is_active: true
      }]
    });

    radarrService.addMovie.mockResolvedValueOnce({});

    await classificationService.routeToArr(
      {
        title: 'String Profile Movie',
        tmdb_id: 555,
        year: 2024
      },
      {
        id: 14,
        arr_type: 'radarr',
        arr_id: 10,
        radarr_settings: {
          root_folder_path: '/movies',
          quality_profile_id: '12'
        }
      }
    );

    expect(radarrService.addMovie).toHaveBeenCalledWith(
      'http://radarr:7878',
      'radarr-key',
      expect.objectContaining({
        qualityProfileId: 12
      })
    );
  });

  test('falls back to Sonarr config quality profile when library settings are missing', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 6,
        url: 'http://sonarr:8989',
        api_key: 'sonarr-key',
        quality_profile_id: 22,
        is_active: true
      }]
    });

    tmdbService.getExternalIds.mockResolvedValueOnce({ tvdb_id: 222 });
    sonarrService.searchSeries.mockResolvedValueOnce([
      {
        tvdbId: 222,
        title: 'Config Profile Show',
        seasons: [
          { seasonNumber: 1, monitored: false }
        ]
      }
    ]);
    sonarrService.addSeries.mockResolvedValueOnce({});

    await classificationService.routeToArr(
      {
        title: 'Config Profile Show',
        tmdb_id: 111
      },
      {
        id: 13,
        arr_type: 'sonarr',
        arr_id: 6,
        sonarr_settings: {},
        root_folder: '/tv',
        quality_profile_id: null
      }
    );

    expect(sonarrService.addSeries).toHaveBeenCalledWith(
      'http://sonarr:8989',
      'sonarr-key',
      expect.objectContaining({
        rootFolderPath: '/tv',
        qualityProfileId: 22
      })
    );
  });

  test('coerces Sonarr quality profile IDs to numbers', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 7,
        url: 'http://sonarr:8989',
        api_key: 'sonarr-key',
        quality_profile_id: 33,
        is_active: true
      }]
    });

    tmdbService.getExternalIds.mockResolvedValueOnce({ tvdb_id: 333 });
    sonarrService.searchSeries.mockResolvedValueOnce([
      {
        tvdbId: 333,
        title: 'String Profile Show',
        seasons: [
          { seasonNumber: 1, monitored: false }
        ]
      }
    ]);
    sonarrService.addSeries.mockResolvedValueOnce({});

    await classificationService.routeToArr(
      {
        title: 'String Profile Show',
        tmdb_id: 444
      },
      {
        id: 15,
        arr_type: 'sonarr',
        arr_id: 7,
        sonarr_settings: {
          root_folder_path: '/tv',
          quality_profile_id: '33'
        }
      }
    );

    expect(sonarrService.addSeries).toHaveBeenCalledWith(
      'http://sonarr:8989',
      'sonarr-key',
      expect.objectContaining({
        qualityProfileId: 33
      })
    );
  });
});
