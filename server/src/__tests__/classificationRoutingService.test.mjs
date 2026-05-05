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

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };
const mockRadarrService = {
    buildUrl: jest.fn().mockReturnValue('http://radarr:7878'),
    getMovieByTmdbId: jest.fn(),
    addMovie: jest.fn(),
    getQualityProfiles: jest.fn(),
    getRootFolders: jest.fn(),
};
const mockSonarrService = {
    buildUrl: jest.fn().mockReturnValue('http://sonarr:8989'),
    getSeriesByTvdbId: jest.fn(),
    addSeries: jest.fn(),
    searchSeries: jest.fn(),
    getQualityProfiles: jest.fn(),
    getRootFolders: jest.fn(),
};
const mockTmdbService = { getExternalIds: jest.fn() };
const mockLoggerModule = {
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }))
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarrService, default: mockRadarrService }));

jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarrService, default: mockSonarrService }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdbService, default: mockTmdbService }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLoggerModule, default: mockLoggerModule }));

const { default: classificationRoutingService } = await import('../services/classificationRoutingService.mjs');
const db = mockDb;
const radarrService = mockRadarrService;
const sonarrService = mockSonarrService;
const tmdbService = mockTmdbService;

function radarrLibrary(overrides = {}) {
    return {
        id: 1,
        arr_type: 'radarr',
        arr_id: 42,
        radarr_settings: { root_folder_path: '/movies', quality_profile_id: 5, monitor: true, search_on_add: true },
        ...overrides,
    };
}

function sonarrLibrary(overrides = {}) {
    return {
        id: 2,
        arr_type: 'sonarr',
        arr_id: 99,
        sonarr_settings: {
            root_folder_path: '/tv',
            quality_profile_id: 3,
            series_type: 'standard',
            season_monitoring: 'all',
            season_folder: true,
            search_on_add: true,
        },
        ...overrides,
    };
}

function radarrConfigRow(overrides = {}) {
    return { id: 42, url: 'http://radarr:7878', api_key: 'radarr-key', ...overrides };
}

function sonarrConfigRow(overrides = {}) {
    return { id: 99, url: 'http://sonarr:8989', api_key: 'sonarr-key', ...overrides };
}

function lookupSeries(overrides = {}) {
    return {
        tvdbId: 12345,
        title: 'Test Series',
        seriesType: 'standard',
        tags: [],
        seasons: [
            { seasonNumber: 0, monitored: true },
            { seasonNumber: 1, monitored: true },
            { seasonNumber: 2, monitored: true },
        ],
        ...overrides,
    };
}

const baseMetadata = { title: 'Test Movie', tmdb_id: 11111, year: 2024 };
const baseTvMetadata = { title: 'Test Series', tmdb_id: 22222, tvdb_id: 12345 };

describe('normalizeSettings', () => {
  test('returns {} for null', () => {
    expect(classificationRoutingService.normalizeSettings(null)).toEqual({});
  });

  test('returns {} for undefined', () => {
    expect(classificationRoutingService.normalizeSettings(undefined)).toEqual({});
  });

  test('parses valid JSON string to object', () => {
    const result = classificationRoutingService.normalizeSettings('{"root_folder_path":"/movies"}');
    expect(result).toEqual({ root_folder_path: '/movies' });
  });

  test('returns {} for invalid JSON string', () => {
    expect(classificationRoutingService.normalizeSettings('not-json')).toEqual({});
  });

  test('returns {} when JSON parses to a number', () => {
    expect(classificationRoutingService.normalizeSettings('5')).toEqual({});
  });

  test('returns {} when JSON parses to a string', () => {
    expect(classificationRoutingService.normalizeSettings('"hello"')).toEqual({});
  });

  test('returns the object unchanged when already an object', () => {
    const obj = { root_folder_path: '/movies', quality_profile_id: 5 };
    expect(classificationRoutingService.normalizeSettings(obj)).toBe(obj);
  });

  test('returns {} for empty string', () => {
    expect(classificationRoutingService.normalizeSettings('')).toEqual({});
  });

  test('parses JSON string to empty object', () => {
    expect(classificationRoutingService.normalizeSettings('{}')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// normalizeQualityProfileId
// ---------------------------------------------------------------------------

describe('normalizeQualityProfileId', () => {
  test('returns null for null', () => {
    expect(classificationRoutingService.normalizeQualityProfileId(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(classificationRoutingService.normalizeQualityProfileId(undefined)).toBeNull();
  });

  test('returns integer for numeric string "5"', () => {
    expect(classificationRoutingService.normalizeQualityProfileId('5')).toBe(5);
  });

  test('returns integer for numeric value 5', () => {
    expect(classificationRoutingService.normalizeQualityProfileId(5)).toBe(5);
  });

  test('returns null for "0" (not > 0)', () => {
    expect(classificationRoutingService.normalizeQualityProfileId('0')).toBeNull();
  });

  test('returns null for 0', () => {
    expect(classificationRoutingService.normalizeQualityProfileId(0)).toBeNull();
  });

  test('returns null for negative integer', () => {
    expect(classificationRoutingService.normalizeQualityProfileId(-1)).toBeNull();
  });

  test('returns null for non-numeric string', () => {
    expect(classificationRoutingService.normalizeQualityProfileId('abc')).toBeNull();
  });

  test('returns null for float string', () => {
    expect(classificationRoutingService.normalizeQualityProfileId('3.7')).toBeNull();
  });

  test('returns null for alphanumeric string', () => {
    expect(classificationRoutingService.normalizeQualityProfileId('12abc')).toBeNull();
  });

  test('returns null for exponent notation', () => {
    expect(classificationRoutingService.normalizeQualityProfileId('1e3')).toBeNull();
  });

  test('trims whitespace around valid numeric strings', () => {
    expect(classificationRoutingService.normalizeQualityProfileId(' 7 ')).toBe(7);
  });

  test('returns large valid integer', () => {
    expect(classificationRoutingService.normalizeQualityProfileId('1000')).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// isSettingsEmpty
// ---------------------------------------------------------------------------

describe('isSettingsEmpty', () => {
  test('returns true for null', () => {
    expect(classificationRoutingService.isSettingsEmpty(null)).toBe(true);
  });

  test('returns true for undefined', () => {
    expect(classificationRoutingService.isSettingsEmpty(undefined)).toBe(true);
  });

  test('returns true for empty object {}', () => {
    expect(classificationRoutingService.isSettingsEmpty({})).toBe(true);
  });

  test('returns true for empty JSON string "{}"', () => {
    expect(classificationRoutingService.isSettingsEmpty('{}')).toBe(true);
  });

  test('returns false for object with keys', () => {
    expect(classificationRoutingService.isSettingsEmpty({ root_folder_path: '/movies' })).toBe(false);
  });

  test('returns false for non-empty JSON string', () => {
    expect(classificationRoutingService.isSettingsEmpty('{"root_folder_path":"/movies"}')).toBe(false);
  });

  test('returns true for invalid JSON string (normalizes to {})', () => {
    expect(classificationRoutingService.isSettingsEmpty('bad-json')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// suggestSeriesType
// ---------------------------------------------------------------------------

describe('suggestSeriesType', () => {
  test('returns "anime" when appliedLabels includes "anime"', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['anime'])).toBe('anime');
  });

  test('returns "anime" for Japanese + animation label', () => {
    expect(classificationRoutingService.suggestSeriesType({ original_language: 'ja' }, ['animation'])).toBe('anime');
  });

  test('returns "standard" for Japanese without animation label', () => {
    expect(classificationRoutingService.suggestSeriesType({ original_language: 'ja' }, ['comedy'])).toBe('standard');
  });

  test('returns "standard" for animation without Japanese', () => {
    expect(classificationRoutingService.suggestSeriesType({ original_language: 'en' }, ['animation'])).toBe('standard');
  });

  test('anime check wins over daily label', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['anime', 'talk'])).toBe('anime');
  });

  test('returns "daily" for "late_night"', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['late_night'])).toBe('daily');
  });

  test('returns "daily" for "talk"', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['talk'])).toBe('daily');
  });

  test('returns "daily" for "news"', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['news'])).toBe('daily');
  });

  test('returns "daily" for "game_show"', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['game_show'])).toBe('daily');
  });

  test('returns "daily" for "soap_opera"', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['soap_opera'])).toBe('daily');
  });

  test('returns "standard" for empty labels', () => {
    expect(classificationRoutingService.suggestSeriesType({}, [])).toBe('standard');
  });

  test('returns "standard" for unrecognised labels', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['comedy', 'drama'])).toBe('standard');
  });

  test('defaults appliedLabels to [] when omitted', () => {
    expect(classificationRoutingService.suggestSeriesType({})).toBe('standard');
  });

  test('returns "standard" when metadata.original_language is undefined', () => {
    expect(classificationRoutingService.suggestSeriesType({}, ['animation'])).toBe('standard');
  });
});

// ---------------------------------------------------------------------------
// resolveDefaultQualityProfile
// ---------------------------------------------------------------------------

describe('resolveDefaultQualityProfile', () => {
  beforeEach(() => {
    db.query.mockReset();
    radarrService.getQualityProfiles.mockReset();
    sonarrService.getQualityProfiles.mockReset();
  });

  test('returns cached profile_id when cache has a row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ profile_id: 7 }] });
    await expect(
      classificationRoutingService.resolveDefaultQualityProfile('radarr', 'http://radarr', 'key')
    ).resolves.toBe(7);
    expect(radarrService.getQualityProfiles).not.toHaveBeenCalled();
  });

  test('calls radarrService on cache miss for radarr', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    radarrService.getQualityProfiles.mockResolvedValueOnce([{ id: 3 }, { id: 4 }]);
    await expect(
      classificationRoutingService.resolveDefaultQualityProfile('radarr', 'http://radarr', 'key')
    ).resolves.toBe(3);
  });

  test('calls sonarrService on cache miss for sonarr', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    sonarrService.getQualityProfiles.mockResolvedValueOnce([{ id: 8 }]);
    await expect(
      classificationRoutingService.resolveDefaultQualityProfile('sonarr', 'http://sonarr', 'key')
    ).resolves.toBe(8);
  });

  test('returns null when API returns empty profiles array', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    radarrService.getQualityProfiles.mockResolvedValueOnce([]);
    await expect(
      classificationRoutingService.resolveDefaultQualityProfile('radarr', 'http://radarr', 'key')
    ).resolves.toBeNull();
  });

  test('returns null when profiles[0] has no id', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    radarrService.getQualityProfiles.mockResolvedValueOnce([{ name: 'Any', id: 0 }]);
    await expect(
      classificationRoutingService.resolveDefaultQualityProfile('radarr', 'http://radarr', 'key')
    ).resolves.toBeNull();
  });

  test('returns null and warns on db error', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    await expect(
      classificationRoutingService.resolveDefaultQualityProfile('radarr', 'http://radarr', 'key')
    ).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveDefaultRootFolder
// ---------------------------------------------------------------------------

describe('resolveDefaultRootFolder', () => {
  beforeEach(() => {
    db.query.mockReset();
    radarrService.getRootFolders.mockReset();
    sonarrService.getRootFolders.mockReset();
  });

  test('returns cached profile_path when cache has a row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ profile_path: '/data/movies' }] });
    await expect(
      classificationRoutingService.resolveDefaultRootFolder('radarr', 'http://radarr', 'key')
    ).resolves.toBe('/data/movies');
    expect(radarrService.getRootFolders).not.toHaveBeenCalled();
  });

  test('calls radarrService on cache miss for radarr', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    radarrService.getRootFolders.mockResolvedValueOnce([{ path: '/movies' }, { path: '/other' }]);
    await expect(
      classificationRoutingService.resolveDefaultRootFolder('radarr', 'http://radarr', 'key')
    ).resolves.toBe('/movies');
  });

  test('calls sonarrService on cache miss for sonarr', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    sonarrService.getRootFolders.mockResolvedValueOnce([{ path: '/tv' }]);
    await expect(
      classificationRoutingService.resolveDefaultRootFolder('sonarr', 'http://sonarr', 'key')
    ).resolves.toBe('/tv');
  });

  test('returns null when API returns empty folders array', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    radarrService.getRootFolders.mockResolvedValueOnce([]);
    await expect(
      classificationRoutingService.resolveDefaultRootFolder('radarr', 'http://radarr', 'key')
    ).resolves.toBeNull();
  });

  test('returns null when folders[0] has no path', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    radarrService.getRootFolders.mockResolvedValueOnce([{ accessible: false }]);
    await expect(
      classificationRoutingService.resolveDefaultRootFolder('radarr', 'http://radarr', 'key')
    ).resolves.toBeNull();
  });

  test('returns null and warns on db error', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    await expect(
      classificationRoutingService.resolveDefaultRootFolder('radarr', 'http://radarr', 'key')
    ).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveRoutingConfig
// ---------------------------------------------------------------------------

describe('resolveRoutingConfig', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('returns null for null library', async () => {
    await expect(classificationRoutingService.resolveRoutingConfig(null)).resolves.toBeNull();
  });

  test('returns resolved immediately when arr_id and arr_type already set', async () => {
    const lib = radarrLibrary();
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result).toMatchObject({ id: 1, arr_type: 'radarr', arr_id: 42 });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('normalises id from library_id when id is missing', async () => {
    const lib = { library_id: 7, arr_type: 'radarr', arr_id: 10 };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result.id).toBe(7);
    expect(result.library_id).toBe(7);
  });

  test('returns resolved without DB query when library has no id', async () => {
    // needsMapping=true but no libraryId → can't query
    const lib = { arr_type: null, arr_id: null };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result).toBeTruthy();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns resolved unchanged when DB has no matching mapping', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const lib = { id: 5, arr_type: null, arr_id: null };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result.arr_type).toBeNull();
    expect(result.arr_id).toBeNull();
  });

  test('merges arr_type and arr_id from mapping', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ arr_type: 'radarr', arr_config_id: 55, arr_root_folder_path: '/movies', quality_profile_id: 4 }]
    });
    const lib = { id: 5, arr_type: null, arr_id: null };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result.arr_type).toBe('radarr');
    expect(result.arr_id).toBe(55);
  });

  test('populates radarr_settings defaults when radarr mapping found and settings empty', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ arr_type: 'radarr', arr_config_id: 55, arr_root_folder_path: '/movies', quality_profile_id: 4 }]
    });
    const lib = { id: 5, arr_type: null, arr_id: null, radarr_settings: null };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result.radarr_settings).toMatchObject({
      root_folder_path: '/movies',
      quality_profile_id: 4,
      monitor: true,
      search_on_add: true,
    });
  });

  test('populates sonarr_settings defaults when sonarr mapping found and settings empty', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ arr_type: 'sonarr', arr_config_id: 77, arr_root_folder_path: '/tv', quality_profile_id: 2 }]
    });
    const lib = { id: 8, arr_type: null, arr_id: null, sonarr_settings: null };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result.sonarr_settings).toMatchObject({
      root_folder_path: '/tv',
      quality_profile_id: 2,
      series_type: 'standard',
      season_monitoring: 'all',
      season_folder: true,
    });
  });

  test('does not overwrite existing arr_type already set on library', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ arr_type: 'sonarr', arr_config_id: 77, arr_root_folder_path: '/tv', quality_profile_id: 2 }]
    });
    const lib = { id: 8, arr_type: 'radarr', arr_id: null };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    // arr_type was already set on lib; mapping should not override it
    expect(result.arr_type).toBe('radarr');
  });

  test('does not overwrite populated radarr_settings', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ arr_type: 'radarr', arr_config_id: 55, arr_root_folder_path: '/other', quality_profile_id: 99 }]
    });
    const existingSettings = { root_folder_path: '/movies', quality_profile_id: 7 };
    const lib = { id: 5, arr_type: null, arr_id: null, radarr_settings: existingSettings };
    const result = await classificationRoutingService.resolveRoutingConfig(lib);
    expect(result.radarr_settings).toEqual(existingSettings);
  });
});

// ---------------------------------------------------------------------------
// routeToArr
// ---------------------------------------------------------------------------

describe('routeToArr', () => {
  beforeEach(() => {
    db.query.mockReset();
    radarrService.buildUrl.mockReset().mockReturnValue('http://radarr:7878');
    radarrService.getMovieByTmdbId.mockReset();
    radarrService.addMovie.mockReset();
    radarrService.getQualityProfiles.mockReset();
    radarrService.getRootFolders.mockReset();
    sonarrService.buildUrl.mockReset().mockReturnValue('http://sonarr:8989');
    sonarrService.getSeriesByTvdbId.mockReset();
    sonarrService.addSeries.mockReset();
    sonarrService.searchSeries.mockReset();
    sonarrService.getQualityProfiles.mockReset();
    sonarrService.getRootFolders.mockReset();
    tmdbService.getExternalIds.mockReset();
  });

  // --- No-mapping / guard cases ---

  test('returns no_mapping when library is null', async () => {
    const result = await classificationRoutingService.routeToArr(baseMetadata, null);
    expect(result).toMatchObject({ routed: false, reason: 'no_mapping', attempted: false });
  });

  test('returns no_mapping when resolvedLibrary has no arr_type', async () => {
    const lib = { id: 1, arr_type: null, arr_id: null };
    db.query.mockResolvedValueOnce({ rows: [] }); // no mapping row
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result).toMatchObject({ routed: false, reason: 'no_mapping', arrType: null });
  });

  test('returns missing_arr_id when arr_type set but arr_id is null', async () => {
    // arr_id is null → resolveRoutingConfig performs a DB lookup; return empty rows so arr_id stays null
    db.query.mockResolvedValueOnce({ rows: [] });
    const lib = { id: 1, arr_type: 'radarr', arr_id: null };
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result).toMatchObject({ routed: false, reason: 'missing_arr_id', arrType: 'radarr', attempted: false });
  });

  // --- Radarr path ---

  test('radarr: returns config_missing_or_inactive when DB has no active config', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // radarr_config empty
    const result = await classificationRoutingService.routeToArr(baseMetadata, radarrLibrary());
    expect(result).toMatchObject({ attempted: true, routed: false, reason: 'config_missing_or_inactive' });
  });

  test('radarr: uses config.url as baseUrl when set', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow({ url: 'http://custom-radarr' })] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 1 });
    await classificationRoutingService.routeToArr(baseMetadata, radarrLibrary());
    expect(radarrService.addMovie).toHaveBeenCalledWith('http://custom-radarr', expect.any(String), expect.any(Object));
  });

  test('radarr: falls back to radarrService.buildUrl when config.url is absent', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow({ url: null })] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 1 });
    await classificationRoutingService.routeToArr(baseMetadata, radarrLibrary());
    expect(radarrService.buildUrl).toHaveBeenCalled();
    expect(radarrService.addMovie).toHaveBeenCalledWith('http://radarr:7878', expect.any(String), expect.any(Object));
  });

  test('radarr: returns missing_required_settings when root_folder_path unresolvable', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [radarrConfigRow()] }) // radarr_config
      .mockResolvedValueOnce({ rows: [] });                 // arr_profiles_cache for root folder
    radarrService.getRootFolders.mockResolvedValueOnce([]);
    const lib = radarrLibrary({ radarr_settings: { quality_profile_id: 5 } }); // no root_folder_path
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result).toMatchObject({ routed: false, reason: 'missing_required_settings' });
  });

  test('radarr: pre-check finds existing movie → already_in_arr', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow()] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce({ id: 99, monitored: true });
    const result = await classificationRoutingService.routeToArr(baseMetadata, radarrLibrary());
    expect(result).toMatchObject({ routed: true, reason: 'already_in_arr', arrType: 'radarr' });
    expect(radarrService.addMovie).not.toHaveBeenCalled();
  });

  test('radarr: pre-check throws → falls through to add', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow()] });
    radarrService.getMovieByTmdbId.mockRejectedValueOnce(new Error('network error'));
    radarrService.addMovie.mockResolvedValueOnce({ id: 200 });
    const result = await classificationRoutingService.routeToArr(baseMetadata, radarrLibrary());
    expect(result).toMatchObject({ routed: true, reason: 'routed' });
    expect(radarrService.addMovie).toHaveBeenCalled();
  });

  test('radarr: skips pre-check when tmdb_id missing', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow()] });
    radarrService.addMovie.mockResolvedValueOnce({ id: 201 });
    const meta = { ...baseMetadata, tmdb_id: null };
    const result = await classificationRoutingService.routeToArr(meta, radarrLibrary());
    expect(result).toMatchObject({ routed: true, reason: 'routed' });
    expect(radarrService.getMovieByTmdbId).not.toHaveBeenCalled();
  });

  test('radarr: add succeeds → routed', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow()] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 300 });
    const result = await classificationRoutingService.routeToArr(baseMetadata, radarrLibrary());
    expect(result).toMatchObject({ attempted: true, routed: true, reason: 'routed', arrType: 'radarr', error: null });
  });

  test('radarr: add returns alreadyExists → already_in_arr', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow()] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ alreadyExists: true });
    const result = await classificationRoutingService.routeToArr(baseMetadata, radarrLibrary());
    expect(result).toMatchObject({ routed: true, reason: 'already_in_arr' });
  });

  test('radarr: quality_profile_id falls back to config row value', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow({ quality_profile_id: 9 })] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 1 });
    // Settings has no quality_profile_id
    const lib = radarrLibrary({ radarr_settings: { root_folder_path: '/movies' } });
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result.routed).toBe(true);
    const addCall = radarrService.addMovie.mock.calls[0][2];
    expect(addCall.qualityProfileId).toBe(9);
  });

  test('radarr: invalid quality_profile_id falls back instead of truncating', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow({ quality_profile_id: 9 })] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 1 });
    const lib = radarrLibrary({
      radarr_settings: { root_folder_path: '/movies', quality_profile_id: '12abc' },
    });
    await classificationRoutingService.routeToArr(baseMetadata, lib);
    const addCall = radarrService.addMovie.mock.calls[0][2];
    expect(addCall.qualityProfileId).toBe(9);
  });

  test('radarr: quality_profile_id resolved from API when settings and config both missing', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [radarrConfigRow({ quality_profile_id: null })] }) // radarr_config
      .mockResolvedValueOnce({ rows: [] });  // arr_profiles_cache for quality
    radarrService.getQualityProfiles.mockResolvedValueOnce([{ id: 15 }]);
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 1 });
    const lib = radarrLibrary({ radarr_settings: { root_folder_path: '/movies' } });
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result.routed).toBe(true);
    const addCall = radarrService.addMovie.mock.calls[0][2];
    expect(addCall.qualityProfileId).toBe(15);
  });

  test('radarr: falls back to legacy root_folder when radarr_settings empty', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow()] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 1 });
    const lib = radarrLibrary({
      radarr_settings: null,
      root_folder: '/legacy-movies',
      quality_profile_id: 5,
    });
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result.routed).toBe(true);
    const addCall = radarrService.addMovie.mock.calls[0][2];
    expect(addCall.rootFolderPath).toBe('/legacy-movies');
  });

  test('radarr: omits invalid year instead of truncating it', async () => {
    db.query.mockResolvedValueOnce({ rows: [radarrConfigRow()] });
    radarrService.getMovieByTmdbId.mockResolvedValueOnce(null);
    radarrService.addMovie.mockResolvedValueOnce({ id: 1 });
    const metadata = { ...baseMetadata, year: '2024x' };
    await classificationRoutingService.routeToArr(metadata, radarrLibrary());
    const addCall = radarrService.addMovie.mock.calls[0][2];
    expect(addCall.year).toBeUndefined();
  });

  // --- Sonarr path ---

  test('sonarr: returns config_missing_or_inactive when DB has no active config', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // sonarr_config empty
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ attempted: true, routed: false, reason: 'config_missing_or_inactive' });
  });

  test('sonarr: uses tvdb_id from metadata directly without tmdb lookup', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result.routed).toBe(true);
    expect(tmdbService.getExternalIds).not.toHaveBeenCalled();
  });

  test('sonarr: resolves tvdb_id via tmdb when not in metadata', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    tmdbService.getExternalIds.mockResolvedValueOnce({ tvdb_id: 99999 });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries({ tvdbId: 99999 })]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const meta = { ...baseTvMetadata, tvdb_id: null, tmdb_id: 22222 };
    const result = await classificationRoutingService.routeToArr(meta, sonarrLibrary());
    expect(result.routed).toBe(true);
    expect(tmdbService.getExternalIds).toHaveBeenCalledWith(22222, 'tv');
  });

  test('sonarr: returns missing_tvdb_id when no tvdb_id and no tmdb_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    const meta = { title: 'Test', tvdb_id: null, tmdb_id: null };
    const result = await classificationRoutingService.routeToArr(meta, sonarrLibrary());
    expect(result).toMatchObject({ routed: false, reason: 'missing_tvdb_id' });
  });

  test('sonarr: returns missing_tvdb_id when tmdb lookup returns no tvdb_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    tmdbService.getExternalIds.mockResolvedValueOnce({ imdb_id: 'tt12345' });
    const meta = { title: 'Test', tvdb_id: null, tmdb_id: 22222 };
    const result = await classificationRoutingService.routeToArr(meta, sonarrLibrary());
    expect(result).toMatchObject({ routed: false, reason: 'missing_tvdb_id' });
  });

  test('sonarr: returns lookup_no_series when searchSeries returns empty', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([]);
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ routed: false, reason: 'lookup_no_series' });
  });

  test('sonarr: returns lookup_missing_title when lookupSeries.title is empty string', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries({ title: '   ' })]);
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ routed: false, reason: 'lookup_missing_title' });
  });

  test('sonarr: pre-check finds existing series → already_in_arr', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce({ id: 88, monitored: true });
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ routed: true, reason: 'already_in_arr' });
    expect(sonarrService.addSeries).not.toHaveBeenCalled();
  });

  test('sonarr: pre-check throws → falls through to add', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockRejectedValueOnce(new Error('timeout'));
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ routed: true, reason: 'routed' });
  });

  test('sonarr: add succeeds → routed', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 50 });
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ attempted: true, routed: true, reason: 'routed', arrType: 'sonarr', error: null });
  });

  test('sonarr: add returns alreadyExists → already_in_arr', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ alreadyExists: true });
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ routed: true, reason: 'already_in_arr' });
  });

  test('sonarr: add throws → arr_add_failed with error message', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockRejectedValueOnce(new Error('Sonarr rejected'));
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result).toMatchObject({ routed: false, reason: 'arr_add_failed', error: 'Sonarr rejected' });
  });

  test('sonarr: uses first lookup result when tvdbId does not match exactly', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    // lookupSeries has tvdbId=99999 but metadata.tvdb_id=12345 — first result used
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries({ tvdbId: 99999 })]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    expect(result.routed).toBe(true);
  });

  test('sonarr: invalid tvdb_id fails cleanly instead of truncating', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    const metadata = { ...baseTvMetadata, tvdb_id: '12345abc' };
    const result = await classificationRoutingService.routeToArr(metadata, sonarrLibrary());
    expect(result).toMatchObject({ routed: false, reason: 'missing_tvdb_id' });
    expect(sonarrService.searchSeries).not.toHaveBeenCalled();
    expect(sonarrService.addSeries).not.toHaveBeenCalled();
  });

  test('sonarr: seriesType defaults to "standard" when not in settings or lookupSeries', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries({ seriesType: undefined })]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const lib = sonarrLibrary({ sonarr_settings: { root_folder_path: '/tv', quality_profile_id: 3 } });
    await classificationRoutingService.routeToArr(baseTvMetadata, lib);
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.seriesType).toBe('standard');
  });

  test('sonarr: seriesType uses lookupSeries.seriesType when settings omits it', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries({ seriesType: 'anime' })]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const lib = sonarrLibrary({ sonarr_settings: { root_folder_path: '/tv', quality_profile_id: 3 } });
    await classificationRoutingService.routeToArr(baseTvMetadata, lib);
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.seriesType).toBe('anime');
  });

  test('sonarr: removes series id before add call', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries({ id: 777 })]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    await classificationRoutingService.routeToArr(baseTvMetadata, sonarrLibrary());
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.id).toBeUndefined();
  });

  test('sonarr: requestedSeasons filters season monitoring', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const meta = { ...baseTvMetadata, requested_seasons: [1] };
    await classificationRoutingService.routeToArr(meta, sonarrLibrary());
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    // season 0 (specials) should be unmonitored because include_specials is not set
    expect(addCall.seasons.find(s => s.seasonNumber === 0).monitored).toBe(false);
    expect(addCall.seasons.find(s => s.seasonNumber === 1).monitored).toBe(true);
    expect(addCall.seasons.find(s => s.seasonNumber === 2).monitored).toBe(false);
  });

  test('sonarr: include_specials keeps season 0 monitored when requested_seasons includes 0', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const meta = { ...baseTvMetadata, requested_seasons: [0, 1], include_specials: true };
    await classificationRoutingService.routeToArr(meta, sonarrLibrary());
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.seasons.find(s => s.seasonNumber === 0).monitored).toBe(true);
  });

  test('sonarr: requested_seasons string values are parsed to integers', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const meta = { ...baseTvMetadata, requested_seasons: ['1', '2'] };
    await classificationRoutingService.routeToArr(meta, sonarrLibrary());
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.seasons.find(s => s.seasonNumber === 1).monitored).toBe(true);
    expect(addCall.seasons.find(s => s.seasonNumber === 2).monitored).toBe(true);
  });

  test('sonarr: malformed requested_seasons entries are dropped while padded integers are accepted', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([
      lookupSeries({
        seasons: [
          { seasonNumber: 0, monitored: true },
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: true },
          { seasonNumber: 3, monitored: true },
        ],
      }),
    ]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const meta = { ...baseTvMetadata, requested_seasons: ['03', '2x'] };
    await classificationRoutingService.routeToArr(meta, sonarrLibrary());
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.seasons.find(s => s.seasonNumber === 2).monitored).toBe(false);
    expect(addCall.seasons.find(s => s.seasonNumber === 3).monitored).toBe(true);
  });

  test('sonarr: season_monitoring "all_seasons" maps to "all"', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const lib = sonarrLibrary({
      sonarr_settings: { root_folder_path: '/tv', quality_profile_id: 3, season_monitoring: 'all_seasons' },
    });
    await classificationRoutingService.routeToArr(baseTvMetadata, lib);
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.addOptions.monitor).toBe('all');
  });

  test('sonarr: season_monitoring "first" maps to "firstSeason"', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const lib = sonarrLibrary({
      sonarr_settings: { root_folder_path: '/tv', quality_profile_id: 3, season_monitoring: 'first' },
    });
    await classificationRoutingService.routeToArr(baseTvMetadata, lib);
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.addOptions.monitor).toBe('firstSeason');
  });

  test('sonarr: falls back to legacy fields when sonarr_settings null', async () => {
    db.query.mockResolvedValueOnce({ rows: [sonarrConfigRow()] });
    sonarrService.searchSeries.mockResolvedValueOnce([lookupSeries()]);
    sonarrService.getSeriesByTvdbId.mockResolvedValueOnce(null);
    sonarrService.addSeries.mockResolvedValueOnce({ id: 1 });
    const lib = sonarrLibrary({ sonarr_settings: null, root_folder: '/legacy-tv', quality_profile_id: 3 });
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, lib);
    expect(result.routed).toBe(true);
    const addCall = sonarrService.addSeries.mock.calls[0][2];
    expect(addCall.rootFolderPath).toBe('/legacy-tv');
  });

  test('sonarr: returns missing_required_settings when root_folder_path unresolvable', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sonarrConfigRow()] })
      .mockResolvedValueOnce({ rows: [] }); // arr_profiles_cache
    sonarrService.getRootFolders.mockResolvedValueOnce([]);
    const lib = sonarrLibrary({ sonarr_settings: { quality_profile_id: 3 } }); // no root_folder_path
    const result = await classificationRoutingService.routeToArr(baseTvMetadata, lib);
    expect(result).toMatchObject({ routed: false, reason: 'missing_required_settings' });
  });

  // --- Unsupported type / unexpected error ---

  test('returns unsupported_arr_type for unknown arr_type', async () => {
    const lib = { id: 1, arr_type: 'plex', arr_id: 1 };
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result).toMatchObject({ routed: false, reason: 'unsupported_arr_type', attempted: true });
  });

  test('catches unexpected top-level error and returns unexpected_error', async () => {
    // Force resolveRoutingConfig to throw by making db.query throw (library needs mapping lookup)
    const lib = { id: 5, arr_type: null, arr_id: null };
    db.query.mockRejectedValueOnce(new Error('catastrophic db failure'));
    const result = await classificationRoutingService.routeToArr(baseMetadata, lib);
    expect(result).toMatchObject({ routed: false, reason: 'unexpected_error', error: 'catastrophic db failure' });
  });
});
