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

const { PolicyCandidateRanker, POLICY_PROMPT_SELECT_MIN_CONFIDENCE } = require('../../services/policyCandidateRanker');

// Helper to build a minimal evaluation object with threshold fields
function makeEval({ id = 1, score = 50, auto = 90, prompt = 70 } = {}) {
  return {
    policy_id: id,
    library_id: id,
    library_name: `Library ${id}`,
    policy_name: `Policy ${id}`,
    score,
    auto_classify_threshold: auto,
    prompt_threshold: prompt,
    scores: {},
    weights: {},
    breakdown: [],
    agreement: null
  };
}

describe('PolicyCandidateRanker', () => {
  let ranker;

  beforeEach(() => {
    ranker = new PolicyCandidateRanker();
  });

  // ── rankResults ────────────────────────────────────────────────────────────

  describe('rankResults', () => {
    it('returns empty array when evaluations is empty', async () => {
      const result = await ranker.rankResults([]);
      expect(result).toEqual([]);
    });

    it('filters out evaluations with score <= 0', async () => {
      const evals = [makeEval({ id: 1, score: 0 }), makeEval({ id: 2, score: -10 })];
      const result = await ranker.rankResults(evals);
      expect(result).toHaveLength(0);
    });

    it('sorts highest score first', async () => {
      const evals = [
        makeEval({ id: 1, score: 40 }),
        makeEval({ id: 2, score: 80 }),
        makeEval({ id: 3, score: 60 }),
      ];
      const ranked = await ranker.rankResults(evals);
      expect(ranked.map(e => e.policy_id)).toEqual([2, 3, 1]);
    });

    it('preserves a single passing evaluation', async () => {
      const evals = [makeEval({ id: 7, score: 55 })];
      const ranked = await ranker.rankResults(evals);
      expect(ranked).toHaveLength(1);
      expect(ranked[0].policy_id).toBe(7);
    });

    it('does not mutate the original array', async () => {
      const evals = [makeEval({ id: 1, score: 40 }), makeEval({ id: 2, score: 80 })];
      const copy = [...evals];
      await ranker.rankResults(evals);
      expect(evals).toEqual(copy);
    });
  });

  // ── determineAction ────────────────────────────────────────────────────────

  describe('determineAction', () => {
    it('returns manual with confidence 0 when ranked is empty', () => {
      const result = ranker.determineAction([]);
      expect(result.action).toBe('manual');
      expect(result.confidence).toBe(0);
    });

    it('returns auto_classify when score >= auto_classify_threshold', () => {
      const ranked = [makeEval({ score: 92, auto: 90, prompt: 70 })];
      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('auto_classify');
      expect(result.confidence).toBe(92);
    });

    it('returns prompt_confirm when score >= prompt_threshold but < auto_classify_threshold', () => {
      const ranked = [makeEval({ score: 75, auto: 90, prompt: 70 })];
      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('prompt_confirm');
      expect(result.confidence).toBe(75);
    });

    it('returns prompt_select when score >= POLICY_PROMPT_SELECT_MIN_CONFIDENCE but < prompt_threshold', () => {
      const ranked = [makeEval({ score: POLICY_PROMPT_SELECT_MIN_CONFIDENCE, auto: 90, prompt: 70 })];
      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('prompt_select');
      expect(result.confidence).toBe(POLICY_PROMPT_SELECT_MIN_CONFIDENCE);
    });

    it('returns manual when score < POLICY_PROMPT_SELECT_MIN_CONFIDENCE', () => {
      const ranked = [makeEval({ score: POLICY_PROMPT_SELECT_MIN_CONFIDENCE - 1, auto: 90, prompt: 70 })];
      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('manual');
    });

    it('ranked array is preserved in result', () => {
      const ranked = [
        makeEval({ id: 1, score: 92, auto: 90, prompt: 70 }),
        makeEval({ id: 2, score: 75, auto: 90, prompt: 70 }),
      ];
      const result = ranker.determineAction(ranked);
      expect(result.ranked).toHaveLength(2);
    });

    it('includes library info for auto_classify', () => {
      const ranked = [makeEval({ id: 5, score: 95, auto: 90, prompt: 70 })];
      const result = ranker.determineAction(ranked);
      expect(result.library).toBeDefined();
      expect(result.library.library_id).toBe(5);
    });

    it('omits library for prompt_select', () => {
      const ranked = [makeEval({ score: POLICY_PROMPT_SELECT_MIN_CONFIDENCE, auto: 90, prompt: 70 })];
      const result = ranker.determineAction(ranked);
      expect(result.library).toBeUndefined();
    });

    it('omits library for manual', () => {
      const ranked = [makeEval({ score: 5, auto: 90, prompt: 70 })];
      const result = ranker.determineAction(ranked);
      expect(result.library).toBeUndefined();
    });

    it('POLICY_PROMPT_SELECT_MIN_CONFIDENCE is exported and is 40', () => {
      expect(POLICY_PROMPT_SELECT_MIN_CONFIDENCE).toBe(40);
    });
  });
});
