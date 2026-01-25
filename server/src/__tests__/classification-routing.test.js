/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Classification Routing Tests - Mapping fallback
 */

jest.mock('../config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  pool: { connect: jest.fn() }
}));
jest.mock('../services/radarr');
jest.mock('../services/sonarr');
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
const classificationService = require('../services/classification');

describe('ClassificationService - routeToArr mapping fallback', () => {
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
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
});
