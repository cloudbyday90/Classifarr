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

'use strict';

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() }
}));

jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../utils/metadataNormalization', () => ({
  normalizeMetadataListLower: jest.fn()
}));

const db = require('../config/database');
const { normalizeMetadataListLower } = require('../utils/metadataNormalization');
const autoLearningService = require('../services/autoLearningService');

// Default thresholds mirror the service constants
const DEFAULTS = {
  genreLearnThreshold: 3,
  keywordLearnThreshold: 5,
  studioLearnThreshold: 2,
  minConfidenceRate: 0.75,
  maxLearnsPerUserPerDay: 50,
  maxLearnsPerLibraryPerHour: 20,
  learningLookbackDays: 30
};

// Reusable mock client factory
function makeMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

beforeEach(() => {
  // Reset module-level cache between every test
  autoLearningService.clearCache();
  db.query.mockReset();
  db.pool.connect.mockReset();
  normalizeMetadataListLower.mockReset();
  // Restore all spyOn overrides so they don't bleed between tests
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

describe('clearCache', () => {
  test('causes next getLearningSettings call to hit the DB again', async () => {
    // Warm the cache
    db.query.mockResolvedValueOnce({ rows: [] });
    await autoLearningService.getLearningSettings();
    expect(db.query).toHaveBeenCalledTimes(1);

    // Clear cache — next call should hit DB again
    autoLearningService.clearCache();
    db.query.mockResolvedValueOnce({ rows: [] });
    await autoLearningService.getLearningSettings();
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getLearningSettings
// ---------------------------------------------------------------------------

describe('getLearningSettings', () => {
  test('returns defaults when DB returns no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const settings = await autoLearningService.getLearningSettings();
    expect(settings.genreLearnThreshold).toBe(DEFAULTS.genreLearnThreshold);
    expect(settings.minConfidenceRate).toBe(DEFAULTS.minConfidenceRate);
    expect(settings.maxLearnsPerUserPerDay).toBe(DEFAULTS.maxLearnsPerUserPerDay);
  });

  test('overrides specific keys from DB rows', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { setting_key: 'learning_genre_threshold', setting_value: '7' },
        { setting_key: 'learning_keyword_threshold', setting_value: '10' },
        { setting_key: 'learning_studio_threshold', setting_value: '4' },
        { setting_key: 'learning_min_confidence_rate', setting_value: '80' },
        { setting_key: 'learning_max_per_user_day', setting_value: '100' },
        { setting_key: 'learning_max_per_library_hour', setting_value: '30' },
        { setting_key: 'learning_lookback_days', setting_value: '60' },
        { setting_key: 'learning_conflict_strategy', setting_value: 'ignore' },
        { setting_key: 'learning_auto_resolve_threshold', setting_value: '5' },
        { setting_key: 'learning_multi_genre_strategy', setting_value: 'strict' }
      ]
    });
    const settings = await autoLearningService.getLearningSettings();
    expect(settings.genreLearnThreshold).toBe(7);
    expect(settings.keywordLearnThreshold).toBe(10);
    expect(settings.studioLearnThreshold).toBe(4);
    expect(settings.minConfidenceRate).toBe(0.80);
    expect(settings.maxLearnsPerUserPerDay).toBe(100);
    expect(settings.maxLearnsPerLibraryPerHour).toBe(30);
    expect(settings.learningLookbackDays).toBe(60);
    expect(settings.conflictStrategy).toBe('ignore');
    expect(settings.autoResolveThreshold).toBe(5);
    expect(settings.multiGenreStrategy).toBe('strict');
  });

  test('returns cached result within TTL without re-querying DB', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await autoLearningService.getLearningSettings();
    await autoLearningService.getLearningSettings();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('returns defaults on DB error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB down'));
    const settings = await autoLearningService.getLearningSettings();
    expect(settings.genreLearnThreshold).toBe(DEFAULTS.genreLearnThreshold);
    expect(settings.minConfidenceRate).toBe(DEFAULTS.minConfidenceRate);
  });

  test('unknown setting_key rows are ignored gracefully', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ setting_key: 'learning_unknown_key', setting_value: '999' }]
    });
    const settings = await autoLearningService.getLearningSettings();
    // Should still return defaults for known keys
    expect(settings.genreLearnThreshold).toBe(DEFAULTS.genreLearnThreshold);
  });
});

// ---------------------------------------------------------------------------
// canApplyLearning
// ---------------------------------------------------------------------------

describe('canApplyLearning', () => {
  beforeEach(() => {
    // Provide settings so inner getLearningSettings returns defaults
    db.query.mockResolvedValueOnce({ rows: [] }); // settings query
  });

  test('returns allowed=true when both limits are under threshold', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // user count
      .mockResolvedValueOnce({ rows: [{ count: '3' }] });   // library count
    const result = await autoLearningService.canApplyLearning('user1', 10);
    expect(result.allowed).toBe(true);
  });

  test('returns allowed=false when user daily limit exceeded', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '50' }] });  // at limit
    const result = await autoLearningService.canApplyLearning('user1', 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/User rate limit/);
  });

  test('returns allowed=false when library hourly limit exceeded', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // user OK
      .mockResolvedValueOnce({ rows: [{ count: '20' }] });   // library at limit
    const result = await autoLearningService.canApplyLearning('user1', 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Library rate limit/);
  });

  test('returns allowed=false on DB error (conservative block)', async () => {
    db.query.mockRejectedValueOnce(new Error('DB timeout'));
    const result = await autoLearningService.canApplyLearning('user1', 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('rate_limit_check_failed');
  });
});

// ---------------------------------------------------------------------------
// recordLearningEvent
// ---------------------------------------------------------------------------

describe('recordLearningEvent', () => {
  test('inserts into learning_rate_limits', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await autoLearningService.recordLearningEvent('user1', 10);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO learning_rate_limits'),
      ['user1', 10]
    );
  });

  test('silently absorbs DB errors (does not throw)', async () => {
    db.query.mockRejectedValueOnce(new Error('insert failed'));
    await expect(autoLearningService.recordLearningEvent('user1', 10)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// calculateNetConfidence
// ---------------------------------------------------------------------------

describe('calculateNetConfidence', () => {
  // NOTE: service queries policy_feedback_log FIRST, then getLearningSettings.
  // Mocks must be queued in that order: [feedback_rows, settings_rows].

  test('genre: counts confirms and rejects correctly', async () => {
    normalizeMetadataListLower.mockImplementation(arr => (arr || []).map(x => x.toLowerCase()));
    db.query
      .mockResolvedValueOnce({
        rows: [
          // confirm: library matches, not correction
          { selected_library_id: 5, was_correction: false, item_metadata: { genres: ['Action'] } },
          { selected_library_id: 5, was_correction: false, item_metadata: { genres: ['Action'] } },
          { selected_library_id: 5, was_correction: false, item_metadata: { genres: ['Action'] } },
          // reject: was correction
          { selected_library_id: 5, was_correction: true, item_metadata: { genres: ['Action'] } }
        ]
      })                                      // policy_feedback_log
      .mockResolvedValueOnce({ rows: [] });   // getLearningSettings (confidence_settings)
    const result = await autoLearningService.calculateNetConfidence(5, 'Action', 'genre');
    expect(result.confirmCount).toBe(3);
    expect(result.rejectCount).toBe(1);
    expect(result.confidenceRate).toBeCloseTo(0.75);
    // 3 >= genreLearnThreshold(3) and rate >= 0.75 → shouldApply
    expect(result.shouldApply).toBe(true);
  });

  test('genre: shouldApply=false when below threshold', async () => {
    normalizeMetadataListLower.mockImplementation(arr => (arr || []).map(x => x.toLowerCase()));
    db.query
      .mockResolvedValueOnce({
        rows: [
          { selected_library_id: 5, was_correction: false, item_metadata: { genres: ['Action'] } },
          { selected_library_id: 5, was_correction: false, item_metadata: { genres: ['Action'] } }
          // only 2 confirms, need 3
        ]
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await autoLearningService.calculateNetConfidence(5, 'Action', 'genre');
    expect(result.shouldApply).toBe(false);
  });

  test('keyword: uses substring matching logic', async () => {
    normalizeMetadataListLower.mockImplementation(arr => (arr || []).map(x => x.toLowerCase()));
    db.query
      .mockResolvedValueOnce({
        rows: Array(5).fill({
          selected_library_id: 7,
          was_correction: false,
          item_metadata: { keywords: ['super hero'] }
        })
      })
      .mockResolvedValueOnce({ rows: [] });
    // keyword 'hero' is a substring of 'super hero'
    const result = await autoLearningService.calculateNetConfidence(7, 'hero', 'keyword');
    expect(result.confirmCount).toBe(5);
    expect(result.shouldApply).toBe(true);
  });

  test('studio: uses substring matching for studio field', async () => {
    normalizeMetadataListLower.mockImplementation(arr => arr || []);
    db.query
      .mockResolvedValueOnce({
        rows: Array(2).fill({
          selected_library_id: 3,
          was_correction: false,
          item_metadata: { studio: 'Warner Bros Pictures' }
        })
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await autoLearningService.calculateNetConfidence(3, 'Warner', 'studio');
    expect(result.confirmCount).toBe(2);
    expect(result.shouldApply).toBe(true);
  });

  test('returns zero-confidence on DB error', async () => {
    // First db.query (feedback_log) fails — no settings call reaches
    db.query.mockRejectedValueOnce(new Error('query failed'));
    const result = await autoLearningService.calculateNetConfidence(5, 'Action', 'genre');
    expect(result.confirmCount).toBe(0);
    expect(result.shouldApply).toBe(false);
  });

  test('returns zero confidence for item with no matching signal', async () => {
    normalizeMetadataListLower.mockImplementation(arr => (arr || []).map(x => x.toLowerCase()));
    db.query
      .mockResolvedValueOnce({
        rows: [{ selected_library_id: 5, was_correction: false, item_metadata: { genres: ['Comedy'] } }]
      })
      .mockResolvedValueOnce({ rows: [] });
    const result = await autoLearningService.calculateNetConfidence(5, 'Action', 'genre');
    expect(result.confirmCount).toBe(0);
    expect(result.shouldApply).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectIntraLibraryConflict
// ---------------------------------------------------------------------------

describe('detectIntraLibraryConflict', () => {
  test('returns conflict=false when no policy exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await autoLearningService.detectIntraLibraryConflict(5, 'Action', 'genre_prefer');
    expect(result.conflict).toBe(false);
  });

  test('returns conflict=false when genre is not in exclude list', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ custom_signals: { genres: { exclude: ['Horror'], prefer: [] } } }]
    });
    const result = await autoLearningService.detectIntraLibraryConflict(5, 'Action', 'genre_prefer');
    expect(result.conflict).toBe(false);
  });

  test('returns conflict=true when genre is in exclude list', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ custom_signals: { genres: { exclude: ['Action'] } } }] })
      .mockResolvedValueOnce({ rows: [] }); // conflict INSERT
    const result = await autoLearningService.detectIntraLibraryConflict(5, 'Action', 'genre_prefer');
    expect(result.conflict).toBe(true);
    expect(result.type).toBe('intra_library_exclusion');
  });

  test('returns conflict=true on DB error (conservative)', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const result = await autoLearningService.detectIntraLibraryConflict(5, 'Action', 'genre_prefer');
    expect(result.conflict).toBe(true);
    expect(result.type).toBe('error');
  });

  test('non-genre preferenceType has no exclusion check, returns no conflict', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ custom_signals: {} }]
    });
    const result = await autoLearningService.detectIntraLibraryConflict(5, 'Marvel', 'studio_prefer');
    expect(result.conflict).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addGenreToPrefer
// ---------------------------------------------------------------------------

describe('addGenreToPrefer', () => {
  test('executes BEGIN, policy lookup, UPDATE, INSERT, COMMIT and releases client', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })       // SELECT policy
      .mockResolvedValueOnce({})                           // UPDATE policy_presets
      .mockResolvedValueOnce({})                           // INSERT auto_learned_preferences
      .mockResolvedValueOnce({});                          // COMMIT

    await autoLearningService.addGenreToPrefer(5, 'Action', 3, 'user1');

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM library_policies'), [5]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE policy_presets'), expect.arrayContaining([10]));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO auto_learned_preferences'), expect.arrayContaining([5, 10, 'Action', 3, 'user1']));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('rolls back and returns early when no policy found', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})                // BEGIN
      .mockResolvedValueOnce({ rows: [] })       // no policy
      .mockResolvedValueOnce({});               // ROLLBACK

    await autoLearningService.addGenreToPrefer(5, 'Action', 3, 'user1');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
    // COMMIT should not have been called
    const calls = client.query.mock.calls.map(c => c[0]);
    expect(calls).not.toContain('COMMIT');
  });

  test('rolls back and rethrows on query error', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })       // policy
      .mockRejectedValueOnce(new Error('constraint fail')); // UPDATE fails

    await expect(autoLearningService.addGenreToPrefer(5, 'Action', 3, 'user1'))
      .rejects.toThrow('constraint fail');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addKeywordToPrefer
// ---------------------------------------------------------------------------

describe('addKeywordToPrefer', () => {
  test('executes full transaction for keyword insertion', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })       // policy
      .mockResolvedValueOnce({})                           // UPDATE
      .mockResolvedValueOnce({})                           // INSERT
      .mockResolvedValueOnce({});                          // COMMIT

    await autoLearningService.addKeywordToPrefer(5, 'superhero', 5, 'user1');

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO auto_learned_preferences'),
      expect.arrayContaining([5, 20, 'superhero', 5, 'user1']));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('rolls back and rethrows on error', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })
      .mockRejectedValueOnce(new Error('db fail'));

    await expect(autoLearningService.addKeywordToPrefer(5, 'superhero', 5, 'user1'))
      .rejects.toThrow('db fail');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addStudioToPrefer
// ---------------------------------------------------------------------------

describe('addStudioToPrefer', () => {
  test('executes full transaction for studio insertion', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 30 }] })       // policy
      .mockResolvedValueOnce({})                           // UPDATE
      .mockResolvedValueOnce({})                           // INSERT
      .mockResolvedValueOnce({});                          // COMMIT

    await autoLearningService.addStudioToPrefer(5, 'A24', 2, 'user1');

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO auto_learned_preferences'),
      expect.arrayContaining([5, 30, 'A24', 2, 'user1']));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// learnGenrePreference
// ---------------------------------------------------------------------------

describe('learnGenrePreference', () => {
  test('returns learned=false when shouldApply is false', async () => {
    // Spy on calculateNetConfidence to return insufficient confidence
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 1, rejectCount: 0, shouldApply: false, confidenceRate: 1
    });

    const result = await autoLearningService.learnGenrePreference(5, 'Action', { userId: 'u1' });
    expect(result.learned).toBe(false);
    expect(result.reason).toBe('insufficient_confidence');
  });

  test('returns learned=false when conflict detected', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 5, shouldApply: true, confidenceRate: 0.9
    });
    jest.spyOn(autoLearningService, 'detectIntraLibraryConflict').mockResolvedValueOnce({
      conflict: true, type: 'intra_library_exclusion'
    });

    const result = await autoLearningService.learnGenrePreference(5, 'Action', { userId: 'u1' });
    expect(result.learned).toBe(false);
    expect(result.reason).toBe('conflict_detected');
  });

  test('returns learned=true on success', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 5, shouldApply: true, confidenceRate: 0.9
    });
    jest.spyOn(autoLearningService, 'detectIntraLibraryConflict').mockResolvedValueOnce({ conflict: false });
    jest.spyOn(autoLearningService, 'addGenreToPrefer').mockResolvedValueOnce();

    const result = await autoLearningService.learnGenrePreference(5, 'Action', { userId: 'u1' });
    expect(result.learned).toBe(true);
    expect(result.confirmCount).toBe(5);
  });

  test('returns learned=false with error on thrown exception', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockRejectedValueOnce(new Error('boom'));

    const result = await autoLearningService.learnGenrePreference(5, 'Action', { userId: 'u1' });
    expect(result.learned).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// learnKeywordPreference
// ---------------------------------------------------------------------------

describe('learnKeywordPreference', () => {
  beforeEach(() => {
    // Settings query (called by getLearningSettings inside learnKeywordPreference)
    db.query.mockResolvedValueOnce({ rows: [] });
  });

  test('returns learned=false when below keywordLearnThreshold', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 2, confidenceRate: 0.9
    });

    const result = await autoLearningService.learnKeywordPreference(5, 'hero', { userId: 'u1' });
    expect(result.learned).toBe(false);
    expect(result.reason).toBe('insufficient_confirmations');
  });

  test('returns learned=false when below minConfidenceRate', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 6, confidenceRate: 0.5
    });

    const result = await autoLearningService.learnKeywordPreference(5, 'hero', { userId: 'u1' });
    expect(result.learned).toBe(false);
    expect(result.reason).toBe('low_confidence_rate');
  });

  test('returns learned=true on success', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 6, confidenceRate: 0.9
    });
    jest.spyOn(autoLearningService, 'addKeywordToPrefer').mockResolvedValueOnce();

    const result = await autoLearningService.learnKeywordPreference(5, 'hero', { userId: 'u1' });
    expect(result.learned).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// learnStudioPreference
// ---------------------------------------------------------------------------

describe('learnStudioPreference', () => {
  beforeEach(() => {
    db.query.mockResolvedValueOnce({ rows: [] }); // settings
  });

  test('returns learned=false when below studioLearnThreshold', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 1, confidenceRate: 1.0
    });

    const result = await autoLearningService.learnStudioPreference(5, 'A24', { userId: 'u1' });
    expect(result.learned).toBe(false);
    expect(result.reason).toBe('insufficient_confirmations');
  });

  test('returns learned=true on success', async () => {
    jest.spyOn(autoLearningService, 'calculateNetConfidence').mockResolvedValueOnce({
      confirmCount: 3, confidenceRate: 0.9
    });
    jest.spyOn(autoLearningService, 'addStudioToPrefer').mockResolvedValueOnce();

    const result = await autoLearningService.learnStudioPreference(5, 'A24', { userId: 'u1' });
    expect(result.learned).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// learnFromFeedback
// ---------------------------------------------------------------------------

describe('learnFromFeedback', () => {
  test('returns learned=false immediately when rate limit exceeded', async () => {
    jest.spyOn(autoLearningService, 'canApplyLearning').mockResolvedValueOnce({
      allowed: false, reason: 'User rate limit exceeded (50/50 per day)'
    });

    const result = await autoLearningService.learnFromFeedback({
      tmdbId: 1, libraryId: 5, genres: ['Action'], userId: 'u1'
    });
    expect(result.learned).toBe(false);
    expect(result.reason).toBe('rate_limit');
  });

  test('learns genres, keywords, and studio; records event when something learned', async () => {
    jest.spyOn(autoLearningService, 'canApplyLearning').mockResolvedValueOnce({ allowed: true });
    jest.spyOn(autoLearningService, 'learnGenrePreference').mockResolvedValueOnce({ learned: true });
    jest.spyOn(autoLearningService, 'learnKeywordPreference').mockResolvedValueOnce({ learned: true });
    jest.spyOn(autoLearningService, 'learnStudioPreference').mockResolvedValueOnce({ learned: true });
    jest.spyOn(autoLearningService, 'recordLearningEvent').mockResolvedValueOnce();

    const result = await autoLearningService.learnFromFeedback({
      tmdbId: 1, libraryId: 5,
      genres: ['Action'],
      keywords: ['hero'],
      studio: 'A24',
      userId: 'u1'
    });
    expect(result.learned).toBe(true);
    expect(result.count).toBe(3);
    expect(autoLearningService.recordLearningEvent).toHaveBeenCalledWith('u1', 5);
  });

  test('limits genres to top 3 and keywords to top 5', async () => {
    jest.spyOn(autoLearningService, 'canApplyLearning').mockResolvedValueOnce({ allowed: true });
    jest.spyOn(autoLearningService, 'learnGenrePreference').mockResolvedValue({ learned: false });
    jest.spyOn(autoLearningService, 'learnKeywordPreference').mockResolvedValue({ learned: false });
    jest.spyOn(autoLearningService, 'learnStudioPreference').mockResolvedValue({ learned: false });

    await autoLearningService.learnFromFeedback({
      tmdbId: 1, libraryId: 5,
      genres: ['A', 'B', 'C', 'D', 'E'],    // 5 provided
      keywords: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'], // 6 provided
      userId: 'u1'
    });

    expect(autoLearningService.learnGenrePreference).toHaveBeenCalledTimes(3);
    expect(autoLearningService.learnKeywordPreference).toHaveBeenCalledTimes(5);
  });

  test('does not call recordLearningEvent when nothing learned', async () => {
    jest.spyOn(autoLearningService, 'canApplyLearning').mockResolvedValueOnce({ allowed: true });
    jest.spyOn(autoLearningService, 'learnGenrePreference').mockResolvedValue({ learned: false });
    jest.spyOn(autoLearningService, 'recordLearningEvent').mockResolvedValueOnce();

    await autoLearningService.learnFromFeedback({
      tmdbId: 1, libraryId: 5, genres: ['Action'], userId: 'u1'
    });

    expect(autoLearningService.recordLearningEvent).not.toHaveBeenCalled();
  });

  test('returns error object on unhandled exception', async () => {
    jest.spyOn(autoLearningService, 'canApplyLearning').mockRejectedValueOnce(new Error('unexpected'));

    const result = await autoLearningService.learnFromFeedback({
      tmdbId: 1, libraryId: 5, genres: [], userId: 'u1'
    });
    expect(result.learned).toBe(false);
    expect(result.error).toBe('unexpected');
  });
});

// ---------------------------------------------------------------------------
// getLearnedPreferences
// ---------------------------------------------------------------------------

describe('getLearnedPreferences', () => {
  test('returns rows with default status=active, limit=100, offset=0', async () => {
    const rows = [{ id: 1, preference_type: 'genre_prefer', preference_value: 'Action' }];
    db.query.mockResolvedValueOnce({ rows });

    const result = await autoLearningService.getLearnedPreferences(5);
    expect(result).toEqual(rows);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('auto_learned_preferences'),
      [5, 'active', 100, 0]
    );
  });

  test('accepts custom status, limit, offset', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await autoLearningService.getLearnedPreferences(5, { status: 'reverted', limit: 20, offset: 40 });
    expect(db.query).toHaveBeenCalledWith(expect.anything(), [5, 'reverted', 20, 40]);
  });

  test('returns [] on DB error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const result = await autoLearningService.getLearnedPreferences(5);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// revertPreference
// ---------------------------------------------------------------------------

describe('revertPreference', () => {
  test('executes full revert transaction: marks reverted, removes from policy signals', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({   // SELECT pref
        rows: [{
          id: 1, library_id: 5, policy_id: 10,
          preference_type: 'genre_prefer', preference_value: 'Action'
        }]
      })
      .mockResolvedValueOnce({}) // UPDATE auto_learned_preferences
      .mockResolvedValueOnce({}) // UPDATE policy_presets
      .mockResolvedValueOnce({}); // COMMIT

    const result = await autoLearningService.revertPreference(1, 42, 'wrong genre');
    expect(result.success).toBe(true);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('throws when preference not found', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})              // BEGIN
      .mockResolvedValueOnce({ rows: [] });    // preference not found

    await expect(autoLearningService.revertPreference(999, 42, 'reason'))
      .rejects.toThrow('Preference not found');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('throws on invalid preference_type (security validation)', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 1, library_id: 5, policy_id: 10,
          preference_type: 'malicious_type; DROP TABLE--',
          preference_value: 'x'
        }]
      })
      .mockResolvedValueOnce({}); // UPDATE auto_learned_preferences

    await expect(autoLearningService.revertPreference(1, 42, 'test'))
      .rejects.toThrow('Invalid preference type');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('rolls back and rethrows on UPDATE error', async () => {
    const client = makeMockClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 1, library_id: 5, policy_id: 10,
          preference_type: 'genre_prefer', preference_value: 'Action'
        }]
      })
      .mockRejectedValueOnce(new Error('update failed')); // UPDATE fails

    await expect(autoLearningService.revertPreference(1, 42, 'reason'))
      .rejects.toThrow('update failed');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('accepts all three valid preference types without throwing on type check', async () => {
    for (const prefType of ['genre_prefer', 'keyword_prefer', 'studio_prefer']) {
      const client = makeMockClient();
      db.pool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 1, library_id: 5, policy_id: 10, preference_type: prefType, preference_value: 'val' }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await expect(autoLearningService.revertPreference(1, 42, 'reason')).resolves.toEqual({ success: true });
    }
  });
});
