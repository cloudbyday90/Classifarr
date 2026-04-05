/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Extended tests for FeedbackAnalysis service.
 * Covers the previously-untested DB-backed methods.
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() }
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../utils/metadataNormalization', () => ({
  normalizeMetadataList: jest.fn(arr =>
    arr.map(v => (typeof v === 'object' && v !== null ? v.name || v.title || '' : v)).filter(Boolean)
  )
}));

const db = require('../config/database');
const feedbackAnalysis = require('../services/feedbackAnalysis');

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------
function makeFeedback(overrides = {}) {
  return {
    id: 1,
    tmdb_id: 100,
    media_type: 'movie',
    title: 'Test Movie',
    item_metadata: { genres: [], keywords: [], production_companies: [] },
    prompt_type: 'prompt_select',
    original_scores: { preset: 70, pattern: 0, rag: 0, history: 0 },
    top_suggestion_library_id: 5,
    top_suggestion_score: 72,
    selected_library_id: 5,
    selected_policy_id: 1,
    was_correction: false,
    user_reason: null,
    user_reason_text: null,
    signal_analysis: {},
    patterns_created: [],
    source: 'web',
    prompted_at: '2026-04-01T10:00:00.000Z',
    responded_at: '2026-04-01T10:00:30.000Z',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// recordFeedback
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.recordFeedback', () => {
  beforeEach(() => jest.clearAllMocks());

  test('inserts feedback row and returns the new id', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })   // INSERT feedback
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });   // updateLearningStats → getAllFeedback (first call)

    // updateLearningStats itself does a big SELECT then an UPSERT
    db.query
      .mockResolvedValueOnce({ rows: [] }) // getAllFeedback returns empty → early return
    ;

    const id = await feedbackAnalysis.recordFeedback({
      tmdb_id: 100,
      media_type: 'movie',
      title: 'Test Movie',
      selected_policy_id: 1,
      was_correction: false,
      prompted_at: '2026-04-01T10:00:00.000Z',
      responded_at: '2026-04-01T10:00:30.000Z'
    });

    expect(id).toBe(42);
    expect(db.query).toHaveBeenCalled();
    // First call should be the INSERT
    const insertCall = db.query.mock.calls[0][0];
    expect(insertCall).toMatch(/INSERT INTO policy_feedback_log/i);
  });

  test('calculates response_time_seconds from timestamps', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [] }); // updateLearningStats

    await feedbackAnalysis.recordFeedback({
      tmdb_id: 200,
      selected_policy_id: 1,
      prompted_at: '2026-04-01T10:00:00.000Z',
      responded_at: '2026-04-01T10:02:00.000Z'  // 120 seconds later
    });

    const params = db.query.mock.calls[0][1];
    // response_time_seconds is the last param (index 18)
    expect(params[18]).toBe(120);
  });

  test('records null response_time_seconds for negative diff (clock skew)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 11 }] })
      .mockResolvedValueOnce({ rows: [] });

    await feedbackAnalysis.recordFeedback({
      prompted_at: '2026-04-01T10:05:00.000Z',
      responded_at: '2026-04-01T10:00:00.000Z',  // Before prompt_at
      selected_policy_id: 1
    });

    const params = db.query.mock.calls[0][1];
    expect(params[18]).toBeNull();
  });

  test('records null response_time_seconds for invalid timestamps', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 12 }] })
      .mockResolvedValueOnce({ rows: [] });

    await feedbackAnalysis.recordFeedback({
      prompted_at: 'not-a-date',
      responded_at: '2026-04-01T10:00:00.000Z',
      selected_policy_id: 1
    });

    const params = db.query.mock.calls[0][1];
    expect(params[18]).toBeNull();
  });

  test('skips updateLearningStats when no selected_policy_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 13 }] });

    await feedbackAnalysis.recordFeedback({ tmdb_id: 1 });

    // Only one DB call (the INSERT)
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('throws on db error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB insert failed'));
    await expect(feedbackAnalysis.recordFeedback({ tmdb_id: 1 })).rejects.toThrow('DB insert failed');
  });
});

// ---------------------------------------------------------------------------
// analyzePolicy
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.analyzePolicy', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns early with insufficient-feedback message when below threshold', async () => {
    db.query.mockResolvedValueOnce({ rows: [makeFeedback()] }); // only 1 row, threshold=5

    const result = await feedbackAnalysis.analyzePolicy(1, { minFeedback: 5 });

    expect(result.suggestions).toHaveLength(0);
    expect(result.message).toMatch(/insufficient/i);
    expect(result.feedbackCount).toBe(1);
  });

  test('accepts custom minFeedback option', async () => {
    // Provide exactly 2 feedback rows; request minFeedback=2 so it proceeds.
    // Spy on storeSuggestions to avoid the deep db chain it requires.
    const rows = [makeFeedback(), makeFeedback({ id: 2 })];
    jest.spyOn(feedbackAnalysis, 'storeSuggestions').mockResolvedValueOnce([]);

    db.query
      .mockResolvedValueOnce({ rows })                         // getAll feedback
      .mockResolvedValueOnce({ rows: [{ library_id: 5 }] })   // detectFailurePatterns → policyLibrary
      .mockResolvedValueOnce({ rows: [] })                    // correctionsTowardPolicy
      .mockResolvedValueOnce({ rows: [{ auto_classify_threshold: 80, prompt_threshold: 65 }] }) // analyzeThresholds
    ;

    const result = await feedbackAnalysis.analyzePolicy(1, { minFeedback: 2 });
    expect(result.policyId).toBe(1);
    expect(typeof result.feedbackCount).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// detectFailurePatterns
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.detectFailurePatterns', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns empty patterns when no corrections present', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ library_id: 5 }] }) // policyLibraryResult
      .mockResolvedValueOnce({ rows: [] });                  // correctionsTowardPolicy

    // Use auto_classify prompt type so autoRate >= 0.3, preventing low_auto_classification_rate trigger
    const feedback = [makeFeedback({ was_correction: false, prompt_type: 'auto_classify' })];
    const result = await feedbackAnalysis.detectFailurePatterns(1, feedback);

    expect(result.falsePositives).toHaveLength(0);
    expect(result.missedPositives).toHaveLength(0);
    expect(result.thresholdIssues).toHaveLength(0);
  });

  test('detects high_false_positive_rate threshold issue', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ library_id: 5 }] })
      .mockResolvedValueOnce({ rows: [] });

    // 80% correction rate + high average score → should flag threshold issue
    const feedback = Array.from({ length: 10 }, (_, i) =>
      makeFeedback({ was_correction: i < 8, top_suggestion_score: 80 })
    );

    const result = await feedbackAnalysis.detectFailurePatterns(1, feedback);
    const highFP = result.thresholdIssues.find(t => t.issue === 'high_false_positive_rate');
    expect(highFP).toBeDefined();
  });

  test('detects low_auto_classification_rate threshold issue', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ library_id: 5 }] })
      .mockResolvedValueOnce({ rows: [] });

    // 0 corrections (<10%) and 0 auto-classified (<30%) out of 10 → triggers low_auto_classification_rate
    // correctionRate must be strictly < 0.1, so use 0 corrections
    const feedback = Array.from({ length: 10 }, (_, i) =>
      makeFeedback({ id: i + 1, was_correction: false, prompt_type: 'prompt_select', top_suggestion_score: 60 })
    );

    const result = await feedbackAnalysis.detectFailurePatterns(1, feedback);
    const lowAuto = result.thresholdIssues.find(t => t.issue === 'low_auto_classification_rate');
    expect(lowAuto).toBeDefined();
  });

  test('returns default empty patterns on db error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const result = await feedbackAnalysis.detectFailurePatterns(1, [makeFeedback()]);
    expect(result.falsePositives).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeSignalEffectiveness
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.analyzeSignalEffectiveness', () => {
  test('calculates accuracy per signal', async () => {
    const feedback = [
      makeFeedback({ was_correction: false, original_scores: { preset: 80, pattern: 60, rag: 0, history: 0 } }),
      makeFeedback({ was_correction: true,  original_scores: { preset: 40, pattern: 0,  rag: 0, history: 0 } })
    ];

    const result = await feedbackAnalysis.analyzeSignalEffectiveness(1, feedback);

    expect(result.preset).toBeDefined();
    expect(result.preset.correct).toBe(1);
    expect(result.preset.incorrect).toBe(1);
    expect(result.preset.accuracy).toBe(0.5);
  });

  test('returns empty object on thrown error', async () => {
    // Pass a non-iterable to force an internal throw
    const result = await feedbackAnalysis.analyzeSignalEffectiveness(1, null);
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// detectNewPatterns
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.detectNewPatterns', () => {
  test('returns empty array when no corrections toward this policy', async () => {
    const feedback = [makeFeedback({ was_correction: false })];
    const result = await feedbackAnalysis.detectNewPatterns(1, feedback);
    expect(result).toEqual([]);
  });

  test('returns empty array on error', async () => {
    const result = await feedbackAnalysis.detectNewPatterns(1, null);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateLearningStats
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.updateLearningStats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when no feedback exists for policy', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await feedbackAnalysis.updateLearningStats(1);
    expect(result).toBeNull();
  });

  test('inserts/upserts stats and returns row', async () => {
    const now = new Date();
    const pastDate = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago

    const feedback = [
      makeFeedback({ was_correction: false, prompt_type: 'auto_classify', prompted_at: now.toISOString() }),
      makeFeedback({ id: 2, was_correction: true, prompt_type: 'prompt_select', prompted_at: pastDate })
    ];

    db.query
      .mockResolvedValueOnce({ rows: feedback })           // getAllFeedback
      .mockResolvedValueOnce({ rows: [{ accuracy_rate: 0.5, trend: 'stable' }] }); // UPSERT result

    const result = await feedbackAnalysis.updateLearningStats(1);
    expect(result).toBeDefined();
    expect(result.accuracy_rate).toBeDefined();
  });

  test('throws on db error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB failed'));
    await expect(feedbackAnalysis.updateLearningStats(1)).rejects.toThrow('DB failed');
  });

  test('detects improving trend', async () => {
    const now = new Date();
    // 5 correct recent + 5 older incorrect
    const feedback = [
      // Recent (within 7 days) - all correct
      ...Array.from({ length: 5 }, (_, i) => makeFeedback({
        id: i + 1,
        was_correction: false,
        prompted_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
      })),
      // Older (8–30 days) - all corrections
      ...Array.from({ length: 5 }, (_, i) => makeFeedback({
        id: 10 + i,
        was_correction: true,
        prompted_at: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString()
      }))
    ];

    db.query
      .mockResolvedValueOnce({ rows: feedback })
      .mockResolvedValueOnce({ rows: [{ trend: 'improving' }] });

    await feedbackAnalysis.updateLearningStats(1);
    // Check that the UPSERT was called with 'improving' trend param
    const upsertCall = db.query.mock.calls[1];
    const trendParam = upsertCall[1].find(p => p === 'improving' || p === 'stable' || p === 'declining');
    expect(trendParam).toBe('improving');
  });
});

// ---------------------------------------------------------------------------
// getPendingSuggestions
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.getPendingSuggestions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns array of pending suggestions from db', async () => {
    const rows = [
      { id: 1, suggestion_type: 'adjust_threshold', confidence: 0.8 },
      { id: 2, suggestion_type: 'adjust_weight', confidence: 0.6 }
    ];
    db.query.mockResolvedValueOnce({ rows });

    const result = await feedbackAnalysis.getPendingSuggestions(1);

    expect(result).toHaveLength(2);
    expect(result[0].suggestion_type).toBe('adjust_threshold');
    expect(db.query.mock.calls[0][0]).toMatch(/status = 'pending'/);
  });

  test('returns empty array when no pending suggestions', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await feedbackAnalysis.getPendingSuggestions(1);
    expect(result).toEqual([]);
  });

  test('throws on db error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB query failed'));
    await expect(feedbackAnalysis.getPendingSuggestions(1)).rejects.toThrow('DB query failed');
  });
});

// ---------------------------------------------------------------------------
// rejectSuggestion
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.rejectSuggestion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates suggestion status to rejected and returns success object', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE doesn't need RETURNING

    const result = await feedbackAnalysis.rejectSuggestion(5, 2, 'Not relevant');

    expect(result.success).toBe(true);
    expect(result.status).toBe('rejected');
    expect(result.suggestionId).toBe(5);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE policy_tuning_suggestions/i);
    expect(sql).toMatch(/rejected/i);
  });

  test('throws on db error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB update failed'));
    await expect(feedbackAnalysis.rejectSuggestion(1, 1, 'reason')).rejects.toThrow('DB update failed');
  });
});

// ---------------------------------------------------------------------------
// runFullAnalysis
// ---------------------------------------------------------------------------
describe('FeedbackAnalysis.runFullAnalysis', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 0 policiesAnalyzed when no active policies exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await feedbackAnalysis.runFullAnalysis();
    expect(result.policiesAnalyzed).toBe(0);
    expect(result.results).toEqual([]);
  });

  test('analyzes each active policy and returns per-policy results', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Policy A' }, { id: 2, name: 'Policy B' }] })
      // analyzePolicy for policy 1: insufficient feedback
      .mockResolvedValueOnce({ rows: [] })
      // analyzePolicy for policy 2: insufficient feedback
      .mockResolvedValueOnce({ rows: [] });

    const result = await feedbackAnalysis.runFullAnalysis();
    expect(result.policiesAnalyzed).toBe(2);
    expect(result.results).toHaveLength(2);
  });
});
