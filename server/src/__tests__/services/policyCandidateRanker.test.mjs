import { jest } from '@jest/globals';
import { policyOverlapMetricsCollector } from '../../services/policyOverlapMetricsCollector.mjs';

const maybePersistSnapshot = jest.fn();
jest.unstable_mockModule('../../services/policyOverlapMetricsSnapshotService.mjs', () => ({
  policyOverlapMetricsSnapshotService: {
    maybePersistSnapshot,
  },
}));

const {
  PolicyCandidateRanker,
  POLICY_CLOSE_SCORE_MARGIN,
  POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
} = await import('../../services/policyCandidateRanker.mjs');

function makeEval({ id = 1, score = 50, auto = 90, prompt = 70, primaryViability = null, candidateDiagnostics = null } = {}) {
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
    agreement: null,
    candidate_diagnostics: candidateDiagnostics || (primaryViability ? { primary_viability: primaryViability } : null),
  };
}

describe('PolicyCandidateRanker', () => {
  let ranker;

  beforeEach(() => {
    ranker = new PolicyCandidateRanker();
    policyOverlapMetricsCollector.reset();
  });

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

    it('calibrates weak evidence before sorting', async () => {
      const evals = [
        makeEval({
          id: 1,
          score: 92,
          candidateDiagnostics: {
            primary_viability: 'compatibility_only',
            evidence_class: 'compatibility',
          },
        }),
        makeEval({
          id: 2,
          score: 70,
          candidateDiagnostics: {
            primary_viability: 'identity_evidence',
            evidence_class: 'identity',
          },
        }),
      ];

      const ranked = await ranker.rankResults(evals);
      expect(ranked.map(e => e.policy_id)).toEqual([2, 1]);
      expect(ranked[1]).toEqual(expect.objectContaining({
        raw_score: 92,
        score: 55,
      }));
      expect(ranked[1].candidate_diagnostics.score_calibration).toEqual(expect.objectContaining({
        applied: true,
        reason_code: 'compatibility_only',
      }));
    });

    it('filters negative conflicts after calibration', async () => {
      const ranked = await ranker.rankResults([
        makeEval({
          id: 1,
          score: 94,
          candidateDiagnostics: {
            primary_viability: 'rag_improved',
            evidence_class: 'negative_conflict',
          },
        }),
        makeEval({
          id: 2,
          score: 65,
          candidateDiagnostics: {
            primary_viability: 'identity_evidence',
            evidence_class: 'identity',
          },
        }),
      ]);

      expect(ranked.map(e => e.policy_id)).toEqual([2]);
    });

    it('retains an identity candidate when observed profile absence is advisory', async () => {
      const ranked = await ranker.rankResults([
        makeEval({
          id: 1,
          score: 80,
          candidateDiagnostics: {
            primary_viability: 'identity_evidence',
            evidence_class: 'identity',
            primary_anchor_eligible: true,
            profile_hard_excluded: false,
            profile_observed_absence: true,
            profile_observed_absence_advisory: true,
          },
        }),
      ]);

      expect(ranked).toEqual([expect.objectContaining({
        policy_id: 1,
        raw_score: 80,
        score: 80,
      })]);
    });

    it('uses deterministic secondary ordering for equal scores', async () => {
      const evals = [
        makeEval({ id: 2, score: 80 }),
        makeEval({ id: 1, score: 80 }),
      ];

      const ranked = await ranker.rankResults(evals);
      expect(ranked.map((evaluation) => evaluation.policy_id)).toEqual([1, 2]);
    });

    it('does not use mutable library or policy labels as a ranking key', async () => {
      const first = {
        ...makeEval({ id: 1, score: 80 }),
        source: 'first',
        library_name: 'Renamed destination',
        policy_name: 'Renamed policy',
      };
      const second = {
        ...makeEval({ id: 1, score: 80 }),
        source: 'second',
        library_name: 'Another destination',
        policy_name: 'Another policy',
      };

      const ranked = await ranker.rankResults([first, second]);

      expect(ranked.map((evaluation) => evaluation.source)).toEqual(['first', 'second']);
    });

    it('normalizes invalid thresholds on ranked evaluations', async () => {
      const ranked = await ranker.rankResults([
        makeEval({ id: 1, score: 88, auto: 120, prompt: null }),
      ]);

      expect(ranked[0].auto_classify_threshold).toBe(95);
      expect(ranked[0].prompt_threshold).toBe(95);
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

    it('uses conservative fallback thresholds instead of null coercion', () => {
      const ranked = [makeEval({ score: 50, auto: null, prompt: null })];
      const result = ranker.determineAction(ranked);

      expect(result.action).toBe('prompt_select');
      expect(result.thresholds).toEqual({
        auto_classify: 95,
        prompt: 95,
        prompt_select: 40,
      });
    });

    it('degrades exact top-score ties to prompt_select', () => {
      const ranked = [
        makeEval({ id: 1, score: 90, auto: 85, prompt: 60 }),
        makeEval({ id: 2, score: 90, auto: 85, prompt: 60 }),
      ];

      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('prompt_select');
      expect(result.library).toBeUndefined();
    });

    it('degrades near ties within the close-score margin to prompt_select', () => {
      const ranked = [
        makeEval({ id: 1, score: 90, auto: 85, prompt: 60 }),
        makeEval({ id: 2, score: 90 - (POLICY_CLOSE_SCORE_MARGIN / 2), auto: 85, prompt: 60 }),
      ];

      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('prompt_select');
      expect(result.library).toBeUndefined();
    });

    it('forces manual review when ambiguous top candidates are weak overlap only', () => {
      const ranked = [
        makeEval({ id: 1, score: 90, auto: 85, prompt: 60, primaryViability: 'compatibility_only' }),
        makeEval({ id: 2, score: 90, auto: 85, prompt: 60, primaryViability: 'profile_only' }),
      ];

      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('manual');
      expect(result.decisionDiagnostics).toEqual(expect.objectContaining({
        requires_manual_review: true,
        reason_code: 'weak_evidence_overlap',
      }));
    });

    it('degrades weak top candidates from confirmable bands to prompt_select', () => {
      const ranked = [
        makeEval({ id: 1, score: 78, auto: 85, prompt: 60, primaryViability: 'profile_only' }),
      ];

      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('prompt_select');
      expect(result.decisionDiagnostics).toEqual(expect.objectContaining({
        requires_manual_review: true,
        reason_code: 'weak_evidence_primary',
      }));
      expect(policyOverlapMetricsCollector.getSnapshot()).toEqual(expect.objectContaining({
        total_decisions: 1,
        weak_evidence_primary_count: 1,
      }));
    });

    it('degrades rag-only candidates from confirmable bands to prompt_select', () => {
      const ranked = [
        makeEval({ id: 1, score: 72, auto: 85, prompt: 60, primaryViability: 'rag_improved' }),
      ];

      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('prompt_select');
      expect(result.library).toBeUndefined();
      expect(result.decisionDiagnostics).toEqual(expect.objectContaining({
        requires_manual_review: true,
        reason_code: 'weak_evidence_primary',
      }));
    });

    it('degrades profile-excluded candidates even when score reaches auto band', () => {
      const ranked = [
        makeEval({
          id: 1,
          score: 92,
          auto: 85,
          prompt: 60,
          candidateDiagnostics: {
            primary_viability: 'rag_improved',
            primary_anchor_eligible: false,
            profile_hard_excluded: true,
          },
        }),
      ];

      const result = ranker.determineAction(ranked);
      expect(result.action).toBe('prompt_select');
      expect(result.library).toBeUndefined();
      expect(result.decisionDiagnostics).toEqual(expect.objectContaining({
        requires_manual_review: true,
        reason_code: 'weak_evidence_primary',
      }));
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
