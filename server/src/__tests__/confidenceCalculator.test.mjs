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
import { createMockModule, createNamedMockModule, createLoggerModuleMock} from './helpers/mockFactory.mjs';

const mockDb = {
  query: jest.fn(),
  pool: { connect: jest.fn() },
  withTransaction: jest.fn(async (fn) => {
    const conn = await mockDb.pool.connect();
    try {
      await conn.query('BEGIN');
      const result = await fn(conn);
      await conn.query('COMMIT');
      return result;
    } catch (err) {
      try { await conn.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      conn.release();
    }
  }),
};

const mockSignalCollector = {
  SIGNAL_TYPES: {
    SOURCE_LIBRARY: 'source_library',
    MANUAL_CORRECTION: 'manual_correction',
    CUSTOM_RULE: 'custom_rule',
    EXISTING_MEDIA: 'existing_media',
    CONTENT_ANALYSIS: 'content_analysis',
    EXACT_MATCH: 'exact_match',
    COLLECTION_MATCH: 'collection_match',
    LEARNED_PATTERN: 'learned_pattern',
    KEYWORD_MATCH: 'keyword_match',
    GENRE_MATCH: 'genre_match',
    SEMANTIC_SIMILARITY: 'semantic_similarity',
    PROFILE_SCORE: 'profile_score',
    PATTERN_STUDIO: 'pattern_studio',
    PATTERN_FRANCHISE: 'pattern_franchise',
    PATTERN_GENRE: 'pattern_genre',
    PATTERN_CERTIFICATION: 'pattern_certification'
  }
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/signalCollector.mjs', () => createNamedMockModule('SIGNAL_TYPES', mockSignalCollector));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { confidenceCalculator } = await import('../services/confidenceCalculator.mjs');
const db = mockDb;

// ─── helpers ──────────────────────────────────────────────────────────────────
const lib = (id, name) => ({ id, name });
const sig = (type, library, rawScore) => ({ type, library, rawScore });

// Capture defaults before any test mutates singleton state.
const DEFAULT_WEIGHTS = confidenceCalculator.getDefaultWeights();
const DEFAULT_THRESHOLD = 80;

// ─── beforeEach ───────────────────────────────────────────────────────────────
// Reset singleton mutable state and individual db mocks (codeHealth rule:
// no clearAllMocks + mock-setup combo — use individual mockReset instead).
let mockClient;
beforeEach(() => {
  confidenceCalculator.weights = { ...DEFAULT_WEIGHTS };
  confidenceCalculator.threshold = DEFAULT_THRESHOLD;

  mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn()
  };
  db.query.mockReset();
  db.pool.connect.mockReset();
  db.pool.connect.mockResolvedValue(mockClient);
});

// ---------------------------------------------------------------------------
// getWeight / getThreshold / getWeights / getDefaultWeights
// ---------------------------------------------------------------------------

describe('getWeight', () => {
  test('returns the default weight for source_library (100)', () => {
    expect(confidenceCalculator.getWeight('source_library')).toBe(100);
  });

  test('returns the default weight for semantic_similarity (75)', () => {
    expect(confidenceCalculator.getWeight('semantic_similarity')).toBe(75);
  });

  test('returns 0 for an unknown signal type', () => {
    expect(confidenceCalculator.getWeight('totally_unknown')).toBe(0);
  });

  test('reflects custom weight after direct mutation', () => {
    confidenceCalculator.weights['genre_match'] = 42;
    expect(confidenceCalculator.getWeight('genre_match')).toBe(42);
  });
});

describe('getThreshold', () => {
  test('returns default threshold of 80', () => {
    expect(confidenceCalculator.getThreshold()).toBe(80);
  });

  test('reflects custom threshold after direct mutation', () => {
    confidenceCalculator.threshold = 65;
    expect(confidenceCalculator.getThreshold()).toBe(65);
  });
});

describe('getWeights', () => {
  test('returns a copy — mutations do not affect internal state', () => {
    const copy = confidenceCalculator.getWeights();
    copy['source_library'] = 0;
    expect(confidenceCalculator.getWeight('source_library')).toBe(100);
  });

  test('includes all expected default signal types', () => {
    const weights = confidenceCalculator.getWeights();
    expect(weights).toHaveProperty('source_library', 100);
    expect(weights).toHaveProperty('custom_rule', 35);
    expect(weights).toHaveProperty('semantic_similarity', 75);
    expect(weights).toHaveProperty('genre_match', 10);
  });
});

describe('getDefaultWeights', () => {
  test('returns 100 for all authoritative signal types', () => {
    const dw = confidenceCalculator.getDefaultWeights();
    expect(dw['source_library']).toBe(100);
    expect(dw['manual_correction']).toBe(100);
    expect(dw['existing_media']).toBe(100);
    expect(dw['exact_match']).toBe(100);
  });

  test('returns a copy — mutations do not affect internal state', () => {
    const dw = confidenceCalculator.getDefaultWeights();
    dw['source_library'] = 0;
    expect(confidenceCalculator.getDefaultWeights()['source_library']).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculate — empty / null input
// ---------------------------------------------------------------------------

describe('calculate — empty input', () => {
  test('returns zeroed result for empty array', () => {
    const result = confidenceCalculator.calculate([]);
    expect(result.confidence).toBe(0);
    expect(result.isAuthoritative).toBe(false);
    expect(result.requiresAI).toBe(true);
    expect(result.hasConflict).toBe(false);
    expect(result.meetsThreshold).toBe(false);
    expect(result.suggestedLibrary).toBeNull();
    expect(result.threshold).toBe(DEFAULT_THRESHOLD);
  });

  test('returns zeroed result for null', () => {
    const result = confidenceCalculator.calculate(null);
    expect(result.confidence).toBe(0);
    expect(result.requiresAI).toBe(true);
  });

  test('returns zeroed result for undefined', () => {
    expect(confidenceCalculator.calculate(undefined).confidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculate — authoritative signals
// ---------------------------------------------------------------------------

describe('calculate — authoritative signals', () => {
  test('source_library signal returns confidence 100 and isAuthoritative true', () => {
    const result = confidenceCalculator.calculate([
      sig('source_library', lib(1, 'Movies'), 100)
    ]);
    expect(result.confidence).toBe(100);
    expect(result.isAuthoritative).toBe(true);
    expect(result.requiresAI).toBe(false);
    expect(result.authoritativeSignal).toBe('source_library');
    expect(result.suggestedLibrary).toEqual(lib(1, 'Movies'));
    expect(result.meetsThreshold).toBe(true);
    expect(result.hasConflict).toBe(false);
  });

  test('manual_correction signal is authoritative', () => {
    const result = confidenceCalculator.calculate([
      sig('manual_correction', lib(2, 'Anime'), 100)
    ]);
    expect(result.isAuthoritative).toBe(true);
    expect(result.authoritativeSignal).toBe('manual_correction');
  });

  test('exact_match signal is authoritative', () => {
    const result = confidenceCalculator.calculate([
      sig('exact_match', lib(3, 'Kids'), 100)
    ]);
    expect(result.isAuthoritative).toBe(true);
  });

  test('existing_media signal is authoritative', () => {
    const result = confidenceCalculator.calculate([
      sig('existing_media', lib(4, 'TV'), 100)
    ]);
    expect(result.isAuthoritative).toBe(true);
  });

  test('authoritative signal without library is treated as regular (not authoritative)', () => {
    const result = confidenceCalculator.calculate([
      sig('source_library', null, 100)
    ]);
    expect(result.isAuthoritative).toBe(false);
    expect(result.requiresAI).toBe(true);
  });

  test('multiple authoritative signals for the same library remain authoritative', () => {
    const result = confidenceCalculator.calculate([
      sig('source_library', lib(1, 'Movies'), 100),
      sig('manual_correction', lib(1, 'Movies'), 100)
    ]);
    expect(result.isAuthoritative).toBe(true);
    expect(result.suggestedLibrary).toEqual(lib(1, 'Movies'));
    expect(result.authoritativeSignal).toBe('source_library');
    expect(result.authoritativeSignals).toEqual([
      { type: 'source_library', libraryId: 1, libraryName: 'Movies' },
      { type: 'manual_correction', libraryId: 1, libraryName: 'Movies' }
    ]);
  });

  test('conflicting authoritative signals downgrade to a conservative conflict result', () => {
    const result = confidenceCalculator.calculate([
      sig('source_library', lib(2, 'Anime'), 100),
      sig('manual_correction', lib(1, 'Movies'), 100)
    ]);

    expect(result.isAuthoritative).toBe(false);
    expect(result.authoritativeConflict).toBe(true);
    expect(result.requiresAI).toBe(true);
    expect(result.hasConflict).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.rawConfidence).toBe(0);
    expect(result.meetsThreshold).toBe(false);
    expect(result.authoritativeConflictLibraries).toEqual([
      {
        library: lib(2, 'Anime'),
        signalTypes: ['source_library']
      },
      {
        library: lib(1, 'Movies'),
        signalTypes: ['manual_correction']
      }
    ]);
  });

  test('authoritative result includes full breakdown', () => {
    const result = confidenceCalculator.calculate([
      sig('source_library', lib(1, 'Movies'), 100),
      sig('genre_match', lib(1, 'Movies'), 80)
    ]);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0].isAuthoritative).toBe(true);
    expect(result.breakdown[1].isAuthoritative).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// calculate — regular signals, weighted scoring
// ---------------------------------------------------------------------------

describe('calculate — regular signal scoring', () => {
  test('custom_rule contributes confidence by default', () => {
    const result = confidenceCalculator.calculate([
      sig('custom_rule', lib(1, 'Movies'), 90)
    ]);

    expect(result.confidence).toBe(32);
    expect(result.rawConfidence).toBeCloseTo(31.5);
    expect(result.suggestedLibrary).toEqual(lib(1, 'Movies'));
  });

  test('single regular signal: weighted score = (weight/100) * rawScore', () => {
    // semantic_similarity weight=75, rawScore=100 → 75 pts
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100)
    ]);
    expect(result.confidence).toBe(75);
    expect(result.rawConfidence).toBe(75);
    expect(result.isAuthoritative).toBe(false);
    expect(result.requiresAI).toBe(true);
    expect(result.suggestedLibrary).toEqual(lib(1, 'Movies'));
  });

  test('multiple signals for same library accumulate their scores', () => {
    // semantic_similarity(75) + profile_score(60) = 135 → capped at 100
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100),
      sig('profile_score', lib(1, 'Movies'), 100)
    ]);
    expect(result.confidence).toBe(100);
  });

  test('partial rawScore is factored: weight=75, rawScore=80 → 60', () => {
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 80)
    ]);
    expect(result.confidence).toBe(60);
  });

  test('signal without library is excluded from library scoring', () => {
    const result = confidenceCalculator.calculate([
      sig('genre_match', null, 100) // no library
    ]);
    expect(result.confidence).toBe(0);
    expect(result.suggestedLibrary).toBeNull();
    // Still appears in breakdown
    expect(result.breakdown).toHaveLength(1);
  });

  test('signals for different libraries — picks highest-scoring library', () => {
    // Library 1: semantic_similarity (75)
    // Library 2: profile_score (60)
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100),
      sig('profile_score', lib(2, 'TV Shows'), 100)
    ]);
    expect(result.suggestedLibrary).toEqual(lib(1, 'Movies'));
    expect(result.alternativeLibrary).toEqual(lib(2, 'TV Shows'));
    expect(result.confidence).toBe(75);
  });

  test('meetsThreshold is true when confidence >= threshold', () => {
    // profile_score(60) + collection_match(25) = 85 → meets 80 threshold
    const result = confidenceCalculator.calculate([
      sig('profile_score', lib(1, 'Movies'), 100),
      sig('collection_match', lib(1, 'Movies'), 100)
    ]);
    expect(result.meetsThreshold).toBe(true);
  });

  test('meetsThreshold is false when confidence < threshold', () => {
    // profile_score(60) → 60 < 80
    const result = confidenceCalculator.calculate([
      sig('profile_score', lib(1, 'Movies'), 100)
    ]);
    expect(result.meetsThreshold).toBe(false);
  });

  test('threshold value is reflected in result', () => {
    confidenceCalculator.threshold = 65;
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100)
    ]);
    expect(result.threshold).toBe(65);
    expect(result.meetsThreshold).toBe(true); // 75 >= 65
  });

  test('confidence is capped at 100', () => {
    // Pile on many high-weight signals for same library
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100), // 75
      sig('profile_score', lib(1, 'Movies'), 100),       // 60
      sig('collection_match', lib(1, 'Movies'), 100),    // 25
      sig('genre_match', lib(1, 'Movies'), 100)          // 10
    ]);
    expect(result.confidence).toBe(100);
  });

  test('returns alternativeLibraryScore for second-place library', () => {
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100),  // 75
      sig('profile_score', lib(2, 'Anime'), 100)          // 60
    ]);
    expect(result.suggestedLibraryScore).toBeCloseTo(75);
    expect(result.alternativeLibraryScore).toBeCloseTo(60);
  });

  test('uses raw confidence for threshold checks even when display confidence rounds up', () => {
    confidenceCalculator.threshold = 80;
    confidenceCalculator.weights['genre_match'] = 88.5;

    const result = confidenceCalculator.calculate([
      sig('genre_match', lib(1, 'Movies'), 90)
    ]);

    expect(result.rawConfidence).toBeCloseTo(79.65);
    expect(result.confidence).toBe(80);
    expect(result.displayConfidence).toBe(80);
    expect(result.meetsThreshold).toBe(false);
  });

  test('profile scores below the neutral baseline do not increase confidence', () => {
    const belowNeutral = confidenceCalculator.calculate([
      sig('profile_score', lib(1, 'Movies'), 49)
    ]);
    const neutral = confidenceCalculator.calculate([
      sig('profile_score', lib(1, 'Movies'), 50)
    ]);
    const aboveNeutral = confidenceCalculator.calculate([
      sig('profile_score', lib(1, 'Movies'), 75)
    ]);

    expect(belowNeutral.rawConfidence).toBe(0);
    expect(neutral.rawConfidence).toBe(0);
    expect(aboveNeutral.rawConfidence).toBeCloseTo(30);
    expect(aboveNeutral.confidence).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// calculate — conflict detection
// ---------------------------------------------------------------------------

describe('calculate — conflict detection', () => {
  test('hasConflict is true when second library is within 20% of top', () => {
    // Library 1: semantic(75) → score 75
    // Library 2: semantic(75) * 0.93 rawScore → score ~69.75
    // scoreDiff = 5.25, 20% of 75 = 15 → 5.25 < 15 → conflict
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100),
      sig('semantic_similarity', lib(2, 'Anime'), 93)
    ]);
    expect(result.hasConflict).toBe(true);
    expect(result.suggestedLibrary).toEqual(lib(1, 'Movies'));
    expect(result.alternativeLibrary).toEqual(lib(2, 'Anime'));
  });

  test('hasConflict is false when second library is clearly lower', () => {
    // Library 1: semantic(75) → 75
    // Library 2: keyword(10) → 10
    // scoreDiff = 65, 20% of 75 = 15 → 65 < 15 is false → no conflict
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100),
      sig('keyword_match', lib(2, 'Anime'), 100)
    ]);
    expect(result.hasConflict).toBe(false);
  });

  test('hasConflict is false with only one library in signals', () => {
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 100)
    ]);
    expect(result.hasConflict).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculate — breakdown structure
// ---------------------------------------------------------------------------

describe('calculate — breakdown', () => {
  test('each breakdown entry has type, rawScore, weight, isAuthoritative, library', () => {
    const result = confidenceCalculator.calculate([
      sig('semantic_similarity', lib(1, 'Movies'), 90)
    ]);
    expect(result.breakdown[0]).toEqual({
      type: 'semantic_similarity',
      rawScore: 90,
      normalizedScore: 90,
      weight: 75,
      isAuthoritative: false,
      library: 'Movies',
      weightedScore: 67.5
    });
  });

  test('breakdown library is null when signal has no library', () => {
    const result = confidenceCalculator.calculate([
      sig('genre_match', null, 50)
    ]);
    expect(result.breakdown[0].library).toBeNull();
  });

  test('breakdown has isAuthoritative truthy for weight-100 signals with library', () => {
    const result = confidenceCalculator.calculate([
      sig('source_library', lib(1, 'Movies'), 100)
    ]);
    expect(result.breakdown[0].isAuthoritative).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toAIContext
// ---------------------------------------------------------------------------

describe('toAIContext', () => {
  test('authoritative path includes AUTHORITATIVE SIGNAL and no AI message', () => {
    const calc = {
      isAuthoritative: true,
      authoritativeSignal: 'source_library',
      suggestedLibrary: lib(1, 'Movies'),
      breakdown: []
    };
    const text = confidenceCalculator.toAIContext(calc);
    expect(text).toContain('AUTHORITATIVE SIGNAL: source_library');
    expect(text).toContain('"Movies"');
    expect(text).toContain('NOT REQUIRED');
  });

  test('non-authoritative path shows confidence, threshold, and breakdown', () => {
    const calc = {
      isAuthoritative: false,
      confidence: 75,
      threshold: 80,
      meetsThreshold: false,
      suggestedLibrary: lib(1, 'Movies'),
      suggestedLibraryScore: 75,
      hasConflict: false,
      breakdown: [
        { type: 'semantic_similarity', weight: 75, isAuthoritative: false, library: 'Movies' }
      ]
    };
    const text = confidenceCalculator.toAIContext(calc);
    expect(text).toContain('75%');
    expect(text).toContain('80%');
    expect(text).toContain('NO');
    expect(text).toContain('REQUIRED');
    expect(text).toContain('semantic_similarity');
  });

  test('non-authoritative path includes CONFLICT DETECTED when hasConflict is true', () => {
    const calc = {
      isAuthoritative: false,
      confidence: 72,
      displayConfidence: 72,
      threshold: 80,
      meetsThreshold: false,
      suggestedLibrary: lib(1, 'Movies'),
      suggestedLibraryScore: 72,
      hasConflict: true,
      alternativeLibrary: lib(2, 'Anime'),
      alternativeLibraryScore: 68,
      breakdown: []
    };
    const text = confidenceCalculator.toAIContext(calc);
    expect(text).toContain('CONFLICT DETECTED');
    expect(text).toContain('"Anime"');
  });

  test('non-authoritative path omits conflict line when hasConflict is false', () => {
    const calc = {
      isAuthoritative: false,
      confidence: 75,
      displayConfidence: 75,
      threshold: 80,
      meetsThreshold: false,
      suggestedLibrary: lib(1, 'Movies'),
      suggestedLibraryScore: 75,
      hasConflict: false,
      breakdown: []
    };
    const text = confidenceCalculator.toAIContext(calc);
    expect(text).not.toContain('CONFLICT DETECTED');
  });

  test('authoritative conflicts render the dedicated conflict diagnostic', () => {
    const calc = {
      isAuthoritative: false,
      confidence: 0,
      displayConfidence: 0,
      threshold: 80,
      meetsThreshold: false,
      suggestedLibrary: lib(2, 'Anime'),
      suggestedLibraryScore: 0,
      hasConflict: true,
      authoritativeConflict: true,
      authoritativeConflictLibraries: [
        { library: lib(2, 'Anime'), signalTypes: ['source_library'] },
        { library: lib(1, 'Movies'), signalTypes: ['manual_correction'] }
      ],
      breakdown: []
    };
    const text = confidenceCalculator.toAIContext(calc);
    expect(text).toContain('AUTHORITATIVE CONFLICT');
    expect(text).toContain('source_library');
    expect(text).not.toContain('CONFLICT DETECTED');
  });
});

// ---------------------------------------------------------------------------
// loadWeights
// ---------------------------------------------------------------------------

describe('loadWeights', () => {
  test('updates weights from confidence_settings rows', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { setting_key: 'weight_genre_match', setting_value: '50' },
          { setting_key: 'weight_keyword_match', setting_value: '30' }
        ]
      })
      .mockResolvedValueOnce({ rows: [] }); // threshold query returns nothing

    await confidenceCalculator.loadWeights();

    expect(confidenceCalculator.getWeight('genre_match')).toBe(50);
    expect(confidenceCalculator.getWeight('keyword_match')).toBe(30);
  });

  test('updates threshold when confidence_settings has confidence_threshold row', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // weight rows
      .mockResolvedValueOnce({ rows: [{ setting_value: '70' }] }); // threshold

    await confidenceCalculator.loadWeights();
    expect(confidenceCalculator.getThreshold()).toBe(70);
  });

  test('invalid weight value falls back to default', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ setting_key: 'weight_genre_match', setting_value: 'notanumber' }]
      })
      .mockResolvedValueOnce({ rows: [] });

    await confidenceCalculator.loadWeights();
    // parseInt('notanumber') === NaN → falls back to DEFAULT_WEIGHTS['genre_match'] = 10
    expect(confidenceCalculator.getWeight('genre_match')).toBe(DEFAULT_WEIGHTS['genre_match']);
  });

  test('malformed numeric strings are rejected instead of partially parsed', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ setting_key: 'weight_genre_match', setting_value: '15px' }]
      })
      .mockResolvedValueOnce({ rows: [{ setting_value: '1e3watts' }] });

    await confidenceCalculator.loadWeights();

    expect(confidenceCalculator.getWeight('genre_match')).toBe(DEFAULT_WEIGHTS['genre_match']);
    expect(confidenceCalculator.getThreshold()).toBe(DEFAULT_THRESHOLD);
  });

  test('preserves zero-valued persisted settings', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ setting_key: 'weight_genre_match', setting_value: '0' }]
      })
      .mockResolvedValueOnce({ rows: [{ setting_value: '0' }] });

    await confidenceCalculator.loadWeights();

    expect(confidenceCalculator.getWeight('genre_match')).toBe(0);
    expect(confidenceCalculator.getThreshold()).toBe(0);
  });

  test('does not throw when db errors (uses defaults silently)', async () => {
    db.query.mockRejectedValue(new Error('table does not exist'));
    await expect(confidenceCalculator.loadWeights()).resolves.not.toThrow();
    // Weights unchanged from defaults
    expect(confidenceCalculator.getWeight('source_library')).toBe(100);
  });

  test('does not update threshold when row is absent', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await confidenceCalculator.loadWeights();
    expect(confidenceCalculator.getThreshold()).toBe(DEFAULT_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// saveWeights
// ---------------------------------------------------------------------------

describe('saveWeights', () => {
  test('executes BEGIN, one upsert per weight, then COMMIT', async () => {
    await confidenceCalculator.saveWeights({ genre_match: 45, keyword_match: 20 });

    const calls = mockClient.query.mock.calls.map(c => c[0]);
    expect(calls[0]).toBe('BEGIN');
    const upserts = calls.filter(c => typeof c === 'string' && c.includes('INSERT INTO confidence_settings'));
    expect(upserts).toHaveLength(2);
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBe('COMMIT');
  });

  test('upserts the correct key/value pairs', async () => {
    await confidenceCalculator.saveWeights({ genre_match: 45 });

    const upsertCall = mockClient.query.mock.calls.find(
      c => Array.isArray(c) && c[1]?.[0] === 'weight_genre_match'
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall[1][1]).toBe('45');
  });

  test('updates in-memory weights after a successful save', async () => {
    await confidenceCalculator.saveWeights({ genre_match: 99 });
    expect(confidenceCalculator.getWeight('genre_match')).toBe(99);
  });

  test('releases the db client after success', async () => {
    await confidenceCalculator.saveWeights({ genre_match: 40 });
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('ROLLBACKs and releases client on error, then rethrows', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('constraint violation')); // upsert fails

    await expect(confidenceCalculator.saveWeights({ genre_match: 40 })).rejects.toThrow('constraint violation');

    const calls = mockClient.query.mock.calls.map(c => c[0]);
    expect(calls).toContain('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('does not update in-memory weights after a failed save', async () => {
    const originalWeight = confidenceCalculator.getWeight('genre_match');
    mockClient.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('db error'));

    await expect(confidenceCalculator.saveWeights({ genre_match: 99 })).rejects.toThrow();
    expect(confidenceCalculator.getWeight('genre_match')).toBe(originalWeight);
  });
});

// ---------------------------------------------------------------------------
// saveThreshold
// ---------------------------------------------------------------------------

describe('saveThreshold', () => {
  test('calls db.query with the correct upsert SQL and value', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await confidenceCalculator.saveThreshold(65);

    const call = db.query.mock.calls[0];
    expect(call[0]).toMatch(/INSERT INTO confidence_settings/);
    expect(call[1]).toEqual(['65']);
  });

  test('updates in-memory threshold after a successful save', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await confidenceCalculator.saveThreshold(65);
    expect(confidenceCalculator.getThreshold()).toBe(65);
  });

  test('propagates db errors to the caller', async () => {
    db.query.mockRejectedValue(new Error('db error'));
    await expect(confidenceCalculator.saveThreshold(65)).rejects.toThrow('db error');
  });
});
