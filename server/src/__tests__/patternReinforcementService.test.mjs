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
import { createMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockEmbeddingRouter = { getConfig: jest.fn() };
const mockLoggerObj = {
  createLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  })
};

jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createMockModule(mockEmbeddingRouter));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerObj));

const db = mockDb;
const embeddingRouter = mockEmbeddingRouter;
const { default: svc } = await import('../services/patternReinforcementService.mjs');

beforeEach(() => {
  db.query.mockReset();
  embeddingRouter.getConfig.mockReset();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// isEnabled
// ---------------------------------------------------------------------------

describe('isEnabled', () => {
  test('returns true when pattern_mining_enabled=true', async () => {
    embeddingRouter.getConfig.mockResolvedValueOnce({ pattern_mining_enabled: true });
    expect(await svc.isEnabled()).toBe(true);
  });

  test('returns false when pattern_mining_enabled=false', async () => {
    embeddingRouter.getConfig.mockResolvedValueOnce({ pattern_mining_enabled: false });
    expect(await svc.isEnabled()).toBe(false);
  });

  test('returns false on error', async () => {
    embeddingRouter.getConfig.mockRejectedValueOnce(new Error('fail'));
    expect(await svc.isEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reinforceOnAccept
// ---------------------------------------------------------------------------

describe('reinforceOnAccept', () => {
  test('does nothing when disabled', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(false);
    await svc.reinforceOnAccept(1, [{ pattern_id: 5 }], 2);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('does nothing with empty patternSignals', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
    await svc.reinforceOnAccept(1, [], 2);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('boosts correct signal and decays incorrect', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
    jest.spyOn(svc, 'logPatternMatch').mockResolvedValue();
    const boost = jest.spyOn(svc, 'boostConfidence').mockResolvedValue();
    const decay = jest.spyOn(svc, 'decayConfidence').mockResolvedValue();

    const signals = [
      { pattern_id: 10, library: { id: 1 }, pattern_value: 'Marvel', confidence: 80 },
      { pattern_id: 20, library: { id: 2 }, pattern_value: 'Disney', confidence: 60 }
    ];
    await svc.reinforceOnAccept(99, signals, 1); // selected library = 1

    expect(boost).toHaveBeenCalledWith(10); // signal 10 matches selected
    expect(decay).toHaveBeenCalledWith(20); // signal 20 does not match
  });

  test('swallows errors', async () => {
    jest.spyOn(svc, 'isEnabled').mockRejectedValueOnce(new Error('boom'));
    await expect(svc.reinforceOnAccept(1, [{ pattern_id: 5 }], 2)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// reinforceOnCorrection
// ---------------------------------------------------------------------------

describe('reinforceOnCorrection', () => {
  test('does nothing when disabled', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(false);
    await svc.reinforceOnCorrection(1, [{ pattern_id: 5 }], 2);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('decays signals that pointed to wrong library', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
    jest.spyOn(svc, 'logPatternMatch').mockResolvedValue();
    const boost = jest.spyOn(svc, 'boostConfidence').mockResolvedValue();
    const decay = jest.spyOn(svc, 'decayConfidence').mockResolvedValue();

    const signals = [
      { pattern_id: 10, library: { id: 3 }, pattern_value: 'Horror', confidence: 55 }
    ];
    await svc.reinforceOnCorrection(99, signals, 1); // correctedLibraryId=1, pattern→3

    // signal.library.id (3) !== correctedLibraryId (1) → isCorrect=false → decay
    expect(decay).toHaveBeenCalledWith(10);
    expect(boost).not.toHaveBeenCalled();
  });

  test('boosts signal that agrees with corrected library', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
    jest.spyOn(svc, 'logPatternMatch').mockResolvedValue();
    const boost = jest.spyOn(svc, 'boostConfidence').mockResolvedValue();
    const decay = jest.spyOn(svc, 'decayConfidence').mockResolvedValue();

    const signals = [
      { pattern_id: 15, library: { id: 1 }, pattern_value: 'Drama', confidence: 70 }
    ];
    await svc.reinforceOnCorrection(99, signals, 1);

    expect(boost).toHaveBeenCalledWith(15);
    expect(decay).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// logPatternMatch
// ---------------------------------------------------------------------------

describe('logPatternMatch', () => {
  test('inserts log row and updates last_seen_at', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })  // INSERT
      .mockResolvedValueOnce({ rows: [] });       // UPDATE last_seen_at
    await svc.logPatternMatch(1, 2, 'Marvel', 80, true, true);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][1]).toEqual([1, 2, 'Marvel', 80, true, true]);
  });

  test('falls back to 5-column insert when was_correct column missing', async () => {
    const err = new Error('column "was_correct" of relation "pattern_match_log" does not exist');
    db.query
      .mockRejectedValueOnce(err)          // first INSERT fails
      .mockResolvedValueOnce({ rows: [] }) // fallback INSERT succeeds
      .mockResolvedValueOnce({ rows: [] }); // UPDATE last_seen_at (not called in fallback path)
    await svc.logPatternMatch(1, 2, 'Marvel', 80, true, true);
    // Second call should be the 5-column fallback
    expect(db.query.mock.calls[1][1]).toEqual([1, 2, 'Marvel', 80, true]);
  });
});

// ---------------------------------------------------------------------------
// boostConfidence
// ---------------------------------------------------------------------------

describe('boostConfidence', () => {
  test('updates discovered_patterns with LEAST(MAX, confidence + BOOST)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await svc.boostConfidence(5);
    expect(db.query).toHaveBeenCalledTimes(1);
    // Params: [MAX_CONFIDENCE=95, CONFIDENCE_BOOST=5, patternId=5]
    expect(db.query.mock.calls[0][1]).toEqual([95, 5, 5]);
  });

  test('swallows errors', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    await expect(svc.boostConfidence(5)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// decayConfidence
// ---------------------------------------------------------------------------

describe('decayConfidence', () => {
  test('decays and deprecates when below MIN_CONFIDENCE', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ confidence: '25', pattern_type: 'genre', pattern_value: 'Horror' }]
    });
    jest.spyOn(svc, 'deprecatePattern').mockResolvedValueOnce();
    await svc.decayConfidence(7);
    expect(svc.deprecatePattern).toHaveBeenCalledWith(7, expect.objectContaining({ confidence: '25' }));
  });

  test('does not deprecate when confidence still above MIN_CONFIDENCE', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ confidence: '50', pattern_type: 'genre', pattern_value: 'Action' }]
    });
    jest.spyOn(svc, 'deprecatePattern').mockResolvedValueOnce();
    await svc.decayConfidence(8);
    expect(svc.deprecatePattern).not.toHaveBeenCalled();
  });

  test('swallows errors', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    await expect(svc.decayConfidence(8)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deprecatePattern
// ---------------------------------------------------------------------------

describe('deprecatePattern', () => {
  test('updates status to decayed', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await svc.deprecatePattern(9, { pattern_type: 'genre', pattern_value: 'Horror', confidence: '20' });
    expect(db.query.mock.calls[0][1]).toEqual([9]);
  });

  test('swallows errors', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    await expect(svc.deprecatePattern(9, {})).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveConflicts
// ---------------------------------------------------------------------------

describe('resolveConflicts', () => {
  test('returns {resolved:0} when disabled', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(false);
    expect(await svc.resolveConflicts()).toEqual({ resolved: 0 });
  });

  test('deprecates lower-confidence conflicting patterns', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
    db.query
      .mockResolvedValueOnce({
        rows: [{
          pattern_type: 'studio',
          pattern_value: 'Marvel',
          conflict_count: '2',
          pattern_ids: [10, 11],
          confidences: [80, 50],
          library_names: ['Movies', 'Kids']
        }]
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE deprecate

    const result = await svc.resolveConflicts();
    expect(result.resolved).toBe(1);
    expect(db.query.mock.calls[1][1]).toEqual([[11]]);
  });

  test('throws on DB error', async () => {
    jest.spyOn(svc, 'isEnabled').mockResolvedValueOnce(true);
    db.query.mockRejectedValueOnce(new Error('DB error'));
    await expect(svc.resolveConflicts()).rejects.toThrow('DB error');
  });
});

// ---------------------------------------------------------------------------
// getPatternAccuracy
// ---------------------------------------------------------------------------

describe('getPatternAccuracy', () => {
  test('returns accuracy stats for a pattern', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        total_uses: '10',
        times_used: '8',
        correct_predictions: '7',
        incorrect_predictions: '3',
        accuracy_percentage: '70.00'
      }]
    });
    const result = await svc.getPatternAccuracy(5);
    expect(result.total_uses).toBe('10');
    expect(result.accuracy_percentage).toBe('70.00');
  });

  test('returns zero stats when no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await svc.getPatternAccuracy(999);
    expect(result.total_uses).toBe(0);
    expect(result.accuracy_percentage).toBe(0);
  });

  test('returns zero stats on error', async () => {
    db.query.mockRejectedValueOnce(new Error('column missing'));
    const result = await svc.getPatternAccuracy(5);
    expect(result.accuracy_percentage).toBe(0);
  });
});