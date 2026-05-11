/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockApiKeyAuth = {
  authenticateTokenOrApiKey: jest.fn((req, res, next) => next()),
  requireReadWrite: jest.fn((req, res, next) => next())
};

const mockDb = {
  query: jest.fn()
};

const mockRadarrService = {
  getRootFolders: jest.fn(),
  getQualityProfiles: jest.fn(),
  getTags: jest.fn(),
  getMinimumAvailabilityOptions: jest.fn()
};

const mockSonarrService = {
  getRootFolders: jest.fn(),
  getQualityProfiles: jest.fn(),
  getTags: jest.fn(),
  getSeriesTypeOptions: jest.fn(),
  getSeasonMonitoringOptions: jest.fn()
};

const mockMediaSyncService = {
  syncLibrary: jest.fn()
};

const mockClassificationService = {};

const mockOllamaService = {
  generate: jest.fn()
};

const mockMediaPatternAnalyzer = {
  analyzeGroup: jest.fn(),
  analyzeLibrary: jest.fn()
};

const mockLibraryProfileService = {
  getProfile: jest.fn(),
  generateProfile: jest.fn()
};

const loggerFactory = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

const mockLogger = {
  createLogger: loggerFactory
};

jest.unstable_mockModule('../middleware/apiKeyAuth.mjs', () => createMockModule(mockApiKeyAuth));

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarrService));

jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarrService));

jest.unstable_mockModule('../services/mediaSync.mjs', () => createNamedMockModule('mediaSyncService', mockMediaSyncService));

jest.unstable_mockModule('../services/classification.mjs', () => createNamedMockModule('classificationService', mockClassificationService));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllamaService));

jest.unstable_mockModule('../services/mediaPatternAnalyzer.mjs', () => createNamedMockModule('mediaPatternAnalyzer', mockMediaPatternAnalyzer));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => createNamedMockModule('libraryProfileService', mockLibraryProfileService));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const db = mockDb;
const radarrService = mockRadarrService;
const sonarrService = mockSonarrService;
const mediaSyncService = mockMediaSyncService;
const ollamaService = mockOllamaService;
const mediaPatternAnalyzer = mockMediaPatternAnalyzer;
const libraryProfileService = mockLibraryProfileService;
const { createLogger } = mockLogger;
const { authenticateTokenOrApiKey, requireReadWrite } = mockApiKeyAuth;
const errors = await import('../utils/errors.mjs');
const { LibraryNotFoundError } = errors;
const { createLibrariesRouter } = await import('../routes/librariesRouteShared.mjs');
const metadataEnrichment = await import('../utils/metadataEnrichment.mjs');

describe('Libraries routes coverage', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    radarrService.getMinimumAvailabilityOptions.mockReset();
    sonarrService.getSeriesTypeOptions.mockReset();
    sonarrService.getSeasonMonitoringOptions.mockReset();
    app = express();
    app.use(express.json());
    app.use('/api/libraries', createLibrariesRouter({
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
      errors,
    }));

    radarrService.getMinimumAvailabilityOptions.mockReturnValue(['released', 'announced']);
    sonarrService.getSeriesTypeOptions.mockReturnValue(['standard', 'anime']);
    sonarrService.getSeasonMonitoringOptions.mockReturnValue(['all', 'future']);
  });

  test('GET /api/libraries returns list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Movies' }] });

    const res = await request(app)
      .get('/api/libraries')
      .expect(200);

    expect(res.body[0].name).toBe('Movies');
  });

  test('GET /api/libraries/pending-suggestions returns aggregate', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { library_id: 1, pending_count: 2, library_name: 'Movies' },
        { library_id: 2, pending_count: 3, library_name: 'Anime' }
      ]
    });

    const res = await request(app)
      .get('/api/libraries/pending-suggestions')
      .expect(200);

    expect(res.body.totalPending).toBe(5);
    expect(res.body.libraries).toHaveLength(2);
  });

  describe('GET /api/libraries/:id and PUT /api/libraries/:id', () => {
    test('returns 404 for missing library on GET', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/libraries/55')
        .expect(404);
    });

    test('returns library details on GET', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 3, name: 'Family', item_count: 10 }]
      });

      const res = await request(app)
        .get('/api/libraries/3')
        .expect(200);

      expect(res.body.id).toBe(3);
    });

    test('returns 404 on PUT when library missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/api/libraries/3')
        .send({ name: 'updated' })
        .expect(404);
    });

    test('updates library on PUT', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 3, name: 'Updated Movies', is_active: true }]
      });

      const res = await request(app)
        .put('/api/libraries/3')
        .send({ name: 'Updated Movies' })
        .expect(200);

      expect(res.body.name).toBe('Updated Movies');
    });
  });

  describe('labels endpoints', () => {
    test('GET labels returns assigned labels', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Kids' }] });

      const res = await request(app)
        .get('/api/libraries/3/labels')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    test('POST labels upserts label assignment', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ library_id: 3, label_preset_id: 10 }] });

      const res = await request(app)
        .post('/api/libraries/3/labels')
        .send({ label_preset_id: 10, rule_type: 'include' })
        .expect(200);

      expect(res.body.label_preset_id).toBe(10);
    });

    test('DELETE labels removes assignment', async () => {
      db.query.mockResolvedValueOnce({});

      const res = await request(app)
        .delete('/api/libraries/3/labels/8')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('ARR options/settings', () => {
    test('GET arr-options returns 404 when library missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/libraries/3/arr-options')
        .expect(404);
    });

    test('GET arr-options returns movie options from Radarr', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 3, media_type: 'movie', arr_id: 4 }] })
        .mockResolvedValueOnce({ rows: [{ id: 4, url: 'http://radarr', api_key: 'abc', is_active: true }] });

      radarrService.getRootFolders.mockResolvedValueOnce([{ id: 1, path: '/movies', freeSpace: 10 }]);
      radarrService.getQualityProfiles.mockResolvedValueOnce([{ id: 2, name: 'HD' }]);
      radarrService.getTags.mockResolvedValueOnce([{ id: 5, label: 'kids' }]);

      const res = await request(app)
        .get('/api/libraries/3/arr-options')
        .expect(200);

      expect(res.body.rootFolders).toHaveLength(1);
      expect(res.body.qualityProfiles).toHaveLength(1);
      expect(res.body.minimumAvailabilityOptions).toContain('released');
    });

    test('GET arr-options returns tv options from Sonarr', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 3, media_type: 'tv', arr_id: 6 }] })
        .mockResolvedValueOnce({ rows: [{ id: 6, url: 'http://sonarr', api_key: 'xyz', is_active: true }] });

      sonarrService.getRootFolders.mockResolvedValueOnce([{ id: 1, path: '/tv', freeSpace: 12 }]);
      sonarrService.getQualityProfiles.mockResolvedValueOnce([{ id: 2, name: 'Any' }]);
      sonarrService.getTags.mockResolvedValueOnce([{ id: 7, label: 'anime' }]);

      const res = await request(app)
        .get('/api/libraries/3/arr-options')
        .expect(200);

      expect(res.body.seriesTypeOptions).toContain('anime');
      expect(res.body.seasonMonitoringOptions).toContain('all');
    });

    test('PUT arr-settings returns 404 when library missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/api/libraries/3/arr-settings')
        .send({ settings: { qualityProfileId: 2 } })
        .expect(404);
    });

    test('PUT arr-settings validates media type', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ media_type: 'invalid' }] });

      await request(app)
        .put('/api/libraries/3/arr-settings')
        .send({ settings: {} })
        .expect(400);
    });

    test('PUT arr-settings updates json settings', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ media_type: 'movie' }] })
        .mockResolvedValueOnce({ rows: [{ id: 3, radarr_settings: { quality_profile_id: 2 } }] });

      const res = await request(app)
        .put('/api/libraries/3/arr-settings')
        .send({ settings: { quality_profile_id: 2 } })
        .expect(200);

      expect(res.body.id).toBe(3);
    });
  });

  test('POST /api/libraries/sync-arr-profiles syncs radarr and sonarr profile cache', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, url: 'http://radarr', api_key: 'rk', is_active: true }]
      })
      .mockResolvedValue({ rows: [{ id: 2, url: 'http://sonarr', api_key: 'sk', is_active: true }] });

    radarrService.getRootFolders.mockResolvedValueOnce([{ id: 1, path: '/movies' }]);
    radarrService.getQualityProfiles.mockResolvedValueOnce([{ id: 2, name: 'HD-1080p' }]);
    radarrService.getTags.mockResolvedValueOnce([{ id: 3, label: 'family' }]);

    sonarrService.getRootFolders.mockResolvedValueOnce([{ id: 4, path: '/shows' }]);
    sonarrService.getQualityProfiles.mockResolvedValueOnce([{ id: 5, name: 'TV-HD' }]);
    sonarrService.getTags.mockResolvedValueOnce([{ id: 6, label: 'anime' }]);

    const res = await request(app)
      .post('/api/libraries/sync-arr-profiles')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.synced).toBeGreaterThan(0);
  });

  test('GET /api/libraries/label-presets/all returns presets', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, category: 'genre', name: 'Anime' }] });

    const res = await request(app)
      .get('/api/libraries/label-presets/all')
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  describe('POST /api/libraries/:id/sync', () => {
    test('returns sync result', async () => {
      mediaSyncService.syncLibrary.mockResolvedValueOnce({ success: true, processed: 25 });

      const res = await request(app)
        .post('/api/libraries/4/sync')
        .send({ incremental: true, batchSize: 20 })
        .expect(200);

      expect(mediaSyncService.syncLibrary).toHaveBeenCalledWith(4, { incremental: true, batchSize: 20 });
      expect(res.body.success).toBe(true);
    });

    test('maps LibraryNotFoundError to 404 payload', async () => {
      mediaSyncService.syncLibrary.mockRejectedValueOnce(new LibraryNotFoundError(999));

      const res = await request(app)
        .post('/api/libraries/999/sync')
        .send({})
        .expect(404);

      expect(res.body.error).toBe('Library not found');
    });
  });

  describe('rules CRUD endpoints', () => {
    test('GET /rules returns rows', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 11, name: 'Rule A' }] });

      const res = await request(app)
        .get('/api/libraries/4/rules')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    test('POST /rules validates conditions', async () => {
      await request(app)
        .post('/api/libraries/4/rules')
        .send({})
        .expect(400);
    });

    test('POST /rules supports legacy rule payload', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 31, name: 'genre includes horror' }] });

      const res = await request(app)
        .post('/api/libraries/4/rules')
        .send({ rule_type: 'genre', operator: 'includes', value: 'horror' })
        .expect(201);

      expect(res.body.id).toBe(31);
    });

    test('GET /rules/debug-insert returns inserted row', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 99, value: 'debug_test' }] });

      const res = await request(app)
        .get('/api/libraries/4/rules/debug-insert')
        .expect(200);

      expect(res.body.id).toBe(99);
    });

    test('PUT /rules/:ruleId returns 404 for missing rule', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/api/libraries/4/rules/88')
        .send({ name: 'Nope' })
        .expect(404);
    });

    test('PUT /rules/:ruleId updates existing rule', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 88, name: 'Updated rule' }] });

      const res = await request(app)
        .put('/api/libraries/4/rules/88')
        .send({ name: 'Updated rule' })
        .expect(200);

      expect(res.body.name).toBe('Updated rule');
    });

    test('DELETE /rules/:ruleId returns 404 when missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .delete('/api/libraries/4/rules/88')
        .expect(404);
    });

    test('DELETE /rules/:ruleId deletes rule', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 88 }] });

      const res = await request(app)
        .delete('/api/libraries/4/rules/88')
        .expect(200);

      expect(res.body.deletedId).toBe(88);
    });
  });

  test('GET /api/libraries/:id/rules/suggest builds heuristic suggestions', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          ratings: ['PG', 'G'],
          genres: ['Animation', 'Family', 'Comedy'],
          languages: ['ja'],
          total_items: '10'
        }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ christmas_count: '4', holiday_count: '3', hallmark_count: '0', total: '10' }]
      })
      .mockResolvedValueOnce({ rows: [{ name: 'Anime Kids' }] });

    const res = await request(app)
      .get('/api/libraries/4/rules/suggest')
      .expect(200);

    expect(res.body.totalItems).toBe(10);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });

  describe('GET /api/libraries/:id/rules/smart-suggest', () => {
    test('returns 404 if library does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/libraries/4/rules/smart-suggest')
        .expect(404);
    });

    test('returns llm suggestions and filters content_type condition', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 4, name: 'Anime Family', media_type: 'movie' }] })
        .mockResolvedValueOnce({ rows: [{ content_type: 'anime', count: '9' }] })
        .mockResolvedValueOnce({ rows: [{ genre: 'Animation', count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ content_rating: 'PG', count: '8' }] })
        .mockResolvedValueOnce({ rows: [{ language: 'ja', count: '9' }] })
        .mockResolvedValueOnce({ rows: [{ keyword: 'family', count: '8' }] })
        .mockResolvedValueOnce({
          rows: [{ total: '10', analyzed: '9', tavily_enriched: '5', last_item_added: '2026-02-18T00:00:00Z' }]
        })
        .mockResolvedValueOnce({ rows: [{ last_analyzed: '2026-02-17T00:00:00Z', pending_count: 1 }] })
        .mockResolvedValueOnce({ rows: [{ advisory_insight: 'Good for families', imdb_insight: null, anime_insight: null }] })
        .mockResolvedValueOnce({ rows: [{ name: 'Existing Rule', conditions: [{ field: 'genre', value: 'Drama' }] }] })
        .mockResolvedValueOnce({ rows: [{ model: 'llama3', temperature: '0.2', is_active: true }] });

      ollamaService.generate.mockResolvedValueOnce(
        '{"suggestions":[{"name":"Anime focus","conditions":[{"field":"content_type","operator":"equals","value":"anime"},{"field":"genre","operator":"contains","value":"Animation"}],"confidence":92,"reasoning":"Dominant anime profile"}]}'
      );

      const res = await request(app)
        .get('/api/libraries/4/rules/smart-suggest')
        .expect(200);

      expect(res.body.source).toBe('llm');
      expect(res.body.suggestions).toHaveLength(1);
      expect(res.body.suggestions[0].conditions.every((c) => c.field !== 'content_type')).toBe(true);
      expect(res.body.hasNewData).toBe(true);
    });

    test('falls back to data-analysis when no active ollama config', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 4, name: 'Kids Anime', media_type: 'movie' }] })
        .mockResolvedValueOnce({ rows: [{ content_type: 'anime', count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ genre: 'Animation', count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ content_rating: 'G', count: '8' }] })
        .mockResolvedValueOnce({ rows: [{ language: 'ja', count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ keyword: 'anime', count: '8' }] })
        .mockResolvedValueOnce({
          rows: [{ total: '10', analyzed: '10', tavily_enriched: '2', last_item_added: '2026-02-18T00:00:00Z' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/libraries/4/rules/smart-suggest')
        .expect(200);

      expect(res.body.source).toBe('data-analysis');
      expect(res.body.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('auto-generate rule endpoints', () => {
    test('POST /:id/rules/auto-generate returns 404 when library missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/libraries/9/rules/auto-generate')
        .expect(404);
    });

    test('POST /:id/rules/auto-generate inserts inferred rules', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 9, name: 'Kids Anime Christmas' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/libraries/9/rules/auto-generate')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.rulesCreated).toBeGreaterThan(0);
      expect(res.body.rules.length).toBeGreaterThan(0);
    });

    test('POST /auto-generate-all processes active libraries', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Family Movies' }] })
        .mockResolvedValue({ rows: [{ count: '1' }] });

      const res = await request(app)
        .post('/api/libraries/auto-generate-all')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.totalRulesCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pattern and profile helper endpoints', () => {
    test('GET /rule-suggestions/:contentType delegates to analyzer', async () => {
      mediaPatternAnalyzer.analyzeGroup.mockResolvedValueOnce({ patterns: [{ type: 'studio' }] });

      const res = await request(app)
        .get('/api/libraries/4/rule-suggestions/anime')
        .expect(200);

      expect(mediaPatternAnalyzer.analyzeGroup).toHaveBeenCalledWith(4, 'anime');
      expect(res.body.patterns).toHaveLength(1);
    });

    test('GET /available-patterns delegates to analyzer', async () => {
      mediaPatternAnalyzer.analyzeLibrary.mockResolvedValueOnce({ patterns: [{ type: 'genre' }] });

      const res = await request(app)
        .get('/api/libraries/4/available-patterns')
        .expect(200);

      expect(res.body.patterns).toHaveLength(1);
    });

    test('POST /dismiss-suggestions marks notification dismissed', async () => {
      db.query.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/libraries/4/dismiss-suggestions')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('POST /refresh-patterns recalculates and stores suggestions', async () => {
      mediaPatternAnalyzer.analyzeLibrary.mockResolvedValueOnce({ patterns: [{ pattern_type: 'genre', pattern_value: 'anime' }] });
      db.query.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/libraries/4/refresh-patterns')
        .expect(200);

      expect(res.body.patterns).toHaveLength(1);
    });

    test('GET /dismissed-patterns returns list', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, pattern_type: 'genre', pattern_value: 'horror' }] });

      const res = await request(app)
        .get('/api/libraries/4/dismissed-patterns')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    test('POST /dismiss-pattern validates required fields', async () => {
      await request(app)
        .post('/api/libraries/4/dismiss-pattern')
        .send({})
        .expect(400);
    });

    test('POST /dismiss-pattern updates dismissal state', async () => {
      db.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/libraries/4/dismiss-pattern')
        .send({ patternType: 'genre', patternValue: 'anime' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('POST /restore-pattern validates required fields', async () => {
      await request(app)
        .post('/api/libraries/4/restore-pattern')
        .send({})
        .expect(400);
    });

    test('POST /restore-pattern restores dismissed pattern', async () => {
      db.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/libraries/4/restore-pattern')
        .send({ patternType: 'genre', patternValue: 'anime' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('GET /profile returns 404 if profile not found', async () => {
      libraryProfileService.getProfile.mockResolvedValueOnce(null);

      await request(app)
        .get('/api/libraries/4/profile')
        .expect(404);
    });

    test('GET /profile returns profile payload', async () => {
      libraryProfileService.getProfile.mockResolvedValueOnce({ library_id: 4, genres: { Animation: 80 } });

      const res = await request(app)
        .get('/api/libraries/4/profile')
        .expect(200);

      expect(res.body.library_id).toBe(4);
    });

    test('POST /profile/refresh returns 400 when profile cannot be generated', async () => {
      libraryProfileService.generateProfile.mockResolvedValueOnce(null);

      await request(app)
        .post('/api/libraries/4/profile/refresh')
        .expect(400);
    });

    test('POST /profile/refresh returns generated profile', async () => {
      libraryProfileService.generateProfile.mockResolvedValueOnce({ library_id: 4, refreshed: true });

      const res = await request(app)
        .post('/api/libraries/4/profile/refresh')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.profile.library_id).toBe(4);
    });
  });
});
