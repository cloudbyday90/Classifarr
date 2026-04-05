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

const { PolicyEvaluationPipeline } = require('../../services/policyEvaluationPipeline');

// Lightweight stand-ins for external dependencies
const makePolicyEngine = (overrides = {}) => ({
  getActivePolicies: jest.fn().mockResolvedValue([]),
  evaluatePolicy: jest.fn().mockResolvedValue({ policy_id: 1, score: 70 }),
  ...overrides
});

const makeRagRetriever = (overrides = {}) => ({
  semanticSearch: jest.fn().mockResolvedValue([]),
  ...overrides
});

const makePolicyExclusionService = (overrides = {}) => ({
  applyMediaTypeFilter: jest.fn((policies, _type) => ({ candidatePolicies: policies, skipped: 0 })),
  detectLanguageConflicts: jest.fn(() => ({ languageConflicts: [], languageConflictPolicyIds: new Set() })),
  filterValidEvaluations: jest.fn((evals) => evals.filter(e => e.score > 0)),
  ...overrides
});

const makePolicyCandidateRanker = (overrides = {}) => ({
  rankResults: jest.fn(async (evals) => [...evals].sort((a, b) => b.score - a.score)),
  determineAction: jest.fn((ranked) => ({
    action: ranked.length === 0 ? 'manual' : 'prompt_select',
    confidence: ranked[0]?.score ?? 0,
    ranked
  })),
  ...overrides
});

const makePolicyDecisionBuilder = (overrides = {}) => ({
  normalizeResult: jest.fn((r) => ({ ...r, ranked: r.ranked || [] })),
  ...overrides
});

// Factory: build a pipeline with all deps injected, any subset can be overridden
// eslint-disable-next-line no-unused-vars
function buildPipeline({
  policyEngine,
  ragRetriever,
  policyExclusionService,
  policyCandidateRanker,
  policyDecisionBuilder
} = {}) {
  const pipeline = new PolicyEvaluationPipeline();
  pipeline._policyEngine            = policyEngine             || makePolicyEngine();
  pipeline._ragRetriever            = ragRetriever             || makeRagRetriever();
  pipeline._policyExclusionService  = policyExclusionService   || makePolicyExclusionService();
  pipeline._policyCandidateRanker   = policyCandidateRanker    || makePolicyCandidateRanker();
  pipeline._policyDecisionBuilder   = policyDecisionBuilder    || makePolicyDecisionBuilder();
  return pipeline;
}

// NOTE: PolicyEvaluationPipeline uses module-level singletons via require().
// To unit-test each stage in isolation we call the methods directly with controlled
// inputs rather than injecting dependencies — this keeps the test surface small
// and aligned with the contract described in the JSDoc.

describe('PolicyEvaluationPipeline', () => {
  // ── loadPolicyCandidates ───────────────────────────────────────────────────

  describe('loadPolicyCandidates', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('returns all policies when itemMediaType is absent', async () => {
      // Bootstrap a fresh pipeline with real singletons but mock getActivePolicies
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyEngine = require('../../services/policyEngine');
      const policyExclusionService = require('../../services/policyExclusionService');

      const policies = [{ id: 1 }, { id: 2 }];
      jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue(policies);
      jest.spyOn(policyExclusionService, 'applyMediaTypeFilter').mockReturnValue({ candidatePolicies: policies, skipped: 0 });

      const p = new PEP();
      const result = await p.loadPolicyCandidates({ title: 'Test' });

      expect(result.policies).toEqual(policies);
      expect(result.candidatePolicies).toEqual(policies);
      expect(result.skipped).toBe(0);
      expect(result.itemMediaType).toBeNull();

      jest.restoreAllMocks();
    });

    it('returns filtered candidates when itemMediaType is set', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyEngine = require('../../services/policyEngine');
      const policyExclusionService = require('../../services/policyExclusionService');

      const all = [{ id: 1, library_media_type: 'movie' }, { id: 2, library_media_type: 'show' }];
      const filtered = [all[0]];
      jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue(all);
      jest.spyOn(policyExclusionService, 'applyMediaTypeFilter').mockReturnValue({ candidatePolicies: filtered, skipped: 1 });

      const p = new PEP();
      const result = await p.loadPolicyCandidates({ title: 'T', media_type: 'movie' });

      expect(result.itemMediaType).toBe('movie');
      expect(result.candidatePolicies).toHaveLength(1);
      expect(result.skipped).toBe(1);

      jest.restoreAllMocks();
    });
  });

  // ── buildSharedContext ─────────────────────────────────────────────────────

  describe('buildSharedContext', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('returns empty ragCache when no policy uses RAG', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const p = new PEP();
      const policies = [{ id: 1, trust_rag: false }];
      const { ragCache, anyPolicyUsesRAG } = await p.buildSharedContext(policies, { title: 'T' });
      expect(anyPolicyUsesRAG).toBe(false);
      expect(ragCache.matches).toEqual([]);
    });

    it('fetches RAG matches when at least one policy uses RAG', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const ragRetriever = require('../../services/ragRetriever');
      jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([{ id: 'r1' }]);

      const p = new PEP();
      const policies = [{ id: 1, trust_rag: true, rag_weight: 0.2 }];
      const { ragCache, anyPolicyUsesRAG } = await p.buildSharedContext(policies, { title: 'T' });
      expect(anyPolicyUsesRAG).toBe(true);
      expect(ragCache.matches).toHaveLength(1);

      jest.restoreAllMocks();
    });

    it('returns empty matches when RAG fetch throws', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const ragRetriever = require('../../services/ragRetriever');
      jest.spyOn(ragRetriever, 'semanticSearch').mockRejectedValue(new Error('timeout'));

      const p = new PEP();
      const policies = [{ id: 1, trust_rag: true, rag_weight: 0.2 }];
      const { ragCache } = await p.buildSharedContext(policies, { title: 'T' });
      expect(ragCache.matches).toEqual([]);

      jest.restoreAllMocks();
    });

    it('uses provided ragCache without fetching', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const ragRetriever = require('../../services/ragRetriever');
      const spy = jest.spyOn(ragRetriever, 'semanticSearch');

      const prebuilt = { matches: [{ id: 'cached' }], timestamp: 1234 };
      const p = new PEP();
      const { ragCache } = await p.buildSharedContext([], { title: 'T' }, { ragCache: prebuilt });
      expect(spy).not.toHaveBeenCalled();
      expect(ragCache.matches).toHaveLength(1);

      jest.restoreAllMocks();
    });
  });

  // ── evaluateAllPolicies ────────────────────────────────────────────────────

  describe('evaluateAllPolicies', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('returns one evaluation per policy', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyEngine = require('../../services/policyEngine');
      jest.spyOn(policyEngine, 'evaluatePolicy')
        .mockResolvedValueOnce({ policy_id: 1, score: 60 })
        .mockResolvedValueOnce({ policy_id: 2, score: 80 });

      const p = new PEP();
      const policies = [{ id: 1 }, { id: 2 }];
      const results = await p.evaluateAllPolicies(policies, { title: 'T' }, { matches: [] });
      expect(results).toHaveLength(2);
      expect(results[0].policy_id).toBe(1);
      expect(results[1].policy_id).toBe(2);

      jest.restoreAllMocks();
    });

    it('returns empty array for empty candidates', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const p = new PEP();
      const results = await p.evaluateAllPolicies([], { title: 'T' }, { matches: [] });
      expect(results).toEqual([]);
    });
  });

  // ── applyExclusions ────────────────────────────────────────────────────────

  describe('applyExclusions', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('returns all valid evaluations with no conflicts', () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyExclusionService = require('../../services/policyExclusionService');
      jest.spyOn(policyExclusionService, 'detectLanguageConflicts').mockReturnValue({
        languageConflicts: [],
        languageConflictPolicyIds: new Set()
      });
      jest.spyOn(policyExclusionService, 'filterValidEvaluations').mockReturnValue([{ policy_id: 1, score: 70 }]);

      const p = new PEP();
      const result = p.applyExclusions([{ id: 1 }], [{ policy_id: 1, score: 70 }], { title: 'T', original_language: 'en' });
      expect(result.evaluations).toHaveLength(1);
      expect(result.languageConflicts).toHaveLength(0);

      jest.restoreAllMocks();
    });

    it('removes conflicted policy evaluations', () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyExclusionService = require('../../services/policyExclusionService');
      jest.spyOn(policyExclusionService, 'detectLanguageConflicts').mockReturnValue({
        languageConflicts: [{ policy_id: 5 }],
        languageConflictPolicyIds: new Set([5])
      });
      jest.spyOn(policyExclusionService, 'filterValidEvaluations').mockReturnValue([]);

      const p = new PEP();
      const result = p.applyExclusions([{ id: 5 }], [{ policy_id: 5, score: 80 }], { title: 'T', original_language: 'ja' });
      expect(result.evaluations).toHaveLength(0);
      expect(result.languageConflicts).toHaveLength(1);

      jest.restoreAllMocks();
    });
  });

  // ── rankAndDecide ──────────────────────────────────────────────────────────

  describe('rankAndDecide', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('returns manual with empty ranked when evaluations is empty', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const p = new PEP();
      const result = await p.rankAndDecide([], [], false, { matches: [] });
      expect(result.action).toBe('manual');
      expect(result.confidence).toBe(0);
    });

    it('delegates non-empty evaluations to policyCandidateRanker', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyCandidateRanker = require('../../services/policyCandidateRanker');
      const rankSpy = jest.spyOn(policyCandidateRanker, 'rankResults').mockResolvedValue([{ policy_id: 1, score: 75 }]);
      const decideSpy = jest.spyOn(policyCandidateRanker, 'determineAction').mockReturnValue({
        action: 'prompt_select', confidence: 75, ranked: []
      });

      const p = new PEP();
      const result = await p.rankAndDecide([{ policy_id: 1, score: 75 }], [], false, { matches: [] });
      expect(rankSpy).toHaveBeenCalled();
      expect(decideSpy).toHaveBeenCalled();
      expect(result.action).toBe('prompt_select');

      jest.restoreAllMocks();
    });

    it('includes ragCache in result when anyPolicyUsesRAG is true', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyCandidateRanker = require('../../services/policyCandidateRanker');
      jest.spyOn(policyCandidateRanker, 'rankResults').mockResolvedValue([{ policy_id: 1, score: 80 }]);
      jest.spyOn(policyCandidateRanker, 'determineAction').mockReturnValue({ action: 'auto_classify', confidence: 80, ranked: [] });

      const ragCache = { matches: [{ id: 'r1' }], timestamp: 999 };
      const p = new PEP();
      const result = await p.rankAndDecide([{ policy_id: 1, score: 80 }], [], true, ragCache);
      expect(result.ragCache).toBeDefined();
      expect(result.ragCache.matches).toHaveLength(1);

      jest.restoreAllMocks();
    });

    it('omits ragCache matches when anyPolicyUsesRAG is false', async () => {
      const { PolicyEvaluationPipeline: PEP } = require('../../services/policyEvaluationPipeline');
      const policyCandidateRanker = require('../../services/policyCandidateRanker');
      jest.spyOn(policyCandidateRanker, 'rankResults').mockResolvedValue([{ policy_id: 1, score: 80 }]);
      jest.spyOn(policyCandidateRanker, 'determineAction').mockReturnValue({ action: 'auto_classify', confidence: 80, ranked: [] });

      const p = new PEP();
      const result = await p.rankAndDecide([{ policy_id: 1, score: 80 }], [], false, { matches: [{ id: 'r1' }] });
      expect(result.ragCache.matches).toEqual([]);

      jest.restoreAllMocks();
    });
  });
});
