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

jest.mock('../services/signalCollector', () => {
  const collectAll = jest.fn().mockResolvedValue(undefined);
  const hasSignal = jest.fn().mockReturnValue(false);
  const addSignal = jest.fn();
  const getSignals = jest.fn().mockReturnValue([]);
  const getPatternSignals = jest.fn().mockReturnValue([]);
  const SignalCollector = jest.fn().mockImplementation(() => ({
    collectAll,
    hasSignal,
    addSignal,
    getSignals,
    getPatternSignals,
  }));
  return { SignalCollector, SIGNAL_TYPES: { SEMANTIC_SIMILARITY: 'semantic_similarity' } };
});

jest.mock('../services/ragRetriever', () => ({
  semanticSearch: jest.fn().mockResolvedValue([]),
  getSuggestedLibrary: jest.fn().mockReturnValue(null),
  calculateDynamicWeight: jest.fn().mockReturnValue(0.5),
}));

jest.mock('../services/confidenceCalculator', () => ({
  loadWeights: jest.fn().mockResolvedValue(undefined),
  calculate: jest.fn().mockReturnValue({ confidence: 70, suggestedLibrary: null }),
  toAIContext: jest.fn().mockReturnValue({}),
}));

jest.mock('../services/classificationPhaseService', () => ({ updatePhase: jest.fn() }));
jest.mock('../services/classificationEvidenceService', () => ({
  buildRelatedEvidenceSummary: jest.fn().mockReturnValue(null),
  findExactMatch: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/classificationAiService');
jest.mock('../services/classificationRagLoopService');
jest.mock('../services/classificationUtilsService');
jest.mock('../services/classificationRoutingService');
jest.mock('../services/classificationLearnedCorrectionsService', () => ({ checkLearnedCorrections: jest.fn() }));
jest.mock('../services/libraryRulesService', () => ({ checkLibraryRules: jest.fn() }));
jest.mock('../services/libraryLabelsService', () => ({ matchRules: jest.fn() }));
jest.mock('../services/mediaSync', () => ({ findExistingMedia: jest.fn() }));
jest.mock('../services/contentTypeAnalyzer', () => ({ analyze: jest.fn().mockResolvedValue({}) }));

const { SignalCollector } = require('../services/signalCollector');
const ragRetriever = require('../services/ragRetriever');
const confidenceCalculator = require('../services/confidenceCalculator');
const classificationAiService = require('../services/classificationAiService');
const classificationRagLoopService = require('../services/classificationRagLoopService');
const classificationUtilsService = require('../services/classificationUtilsService');
const classificationRoutingService = require('../services/classificationRoutingService');

const { execute } = require('../services/classificationLegacySignalPathService');

const libraries = [
  { id: 1, name: 'Movies' },
  { id: 2, name: 'Shows' },
];

const baseParams = {
  metadata: { title: 'Test Film', tmdb_id: 111, media_type: 'movie' },
  libraries,
  taskId: null,
  relatedEvidence: [],
  policyResult: null,
};

function makeCollectorInstance() {
  return new SignalCollector();
}

beforeEach(() => {
  SignalCollector.mockClear();
  // Reset shared instance mock functions (all instances share the same fn objects from the factory)
  const tempInst = new SignalCollector();
  tempInst.hasSignal.mockReset().mockReturnValue(false);
  tempInst.addSignal.mockReset();
  tempInst.collectAll.mockReset().mockResolvedValue(undefined);
  tempInst.getSignals.mockReset().mockReturnValue([]);
  tempInst.getPatternSignals.mockReset().mockReturnValue([]);
  SignalCollector.mockClear(); // clear the temp construction from results
  confidenceCalculator.calculate.mockReset().mockReturnValue({ confidence: 70, suggestedLibrary: null });
  classificationUtilsService.isAiTransientAvailabilityError.mockReset().mockReturnValue(false);
  classificationUtilsService.buildPendingRetryResult.mockReset().mockReturnValue({ needs_retry: true });
  classificationRoutingService.ensureDecisionQuestion.mockReset().mockImplementation(async ({ result }) => result);
  classificationRagLoopService.evaluateRagLoopSecondPass.mockReset().mockImplementation(async ({ baselineResult }) => baselineResult);
  classificationAiService.aiClassify.mockReset();
});

describe('classificationLegacySignalPathService.execute', () => {
  it('calls SignalCollector.collectAll with a detectors map containing expected keys', async () => {
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    await execute(baseParams);

    const instance = SignalCollector.mock.results[0].value;
    const collectAllArgs = instance.collectAll.mock.calls[0];
    const detectors = collectAllArgs[2];
    expect(typeof detectors.checkLearnedCorrections).toBe('function');
    expect(typeof detectors.checkLibraryRules).toBe('function');
    expect(typeof detectors.findExistingMedia).toBe('function');
    expect(typeof detectors.matchRules).toBe('function');
    expect(typeof detectors.checkExactMatch).toBe('function');
  });

  it('adds RAG signal when semanticSearch returns results and library is found', async () => {
    const similarItems = [{ libraryId: 1, similarity: 0.9 }];
    ragRetriever.semanticSearch.mockResolvedValue(similarItems);
    ragRetriever.getSuggestedLibrary.mockReturnValue({ libraryId: 1, avgSimilarity: 0.9, voteCount: 1 });
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    await execute(baseParams);

    const instance = SignalCollector.mock.results[0].value;
    expect(instance.addSignal).toHaveBeenCalledWith(
      'semantic_similarity',
      expect.objectContaining({ avgSimilarity: 0.9 }),
      expect.any(Number),
      expect.objectContaining({ id: 1 })
    );
  });

  it('skips RAG signal when SEMANTIC_SIMILARITY already collected', async () => {
    const similarItems = [{ libraryId: 1, similarity: 0.9 }];
    ragRetriever.semanticSearch.mockResolvedValue(similarItems);
    ragRetriever.getSuggestedLibrary.mockReturnValue({ libraryId: 1 });
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    // Make hasSignal return true to skip addSignal
    const instance = makeCollectorInstance();
    instance.hasSignal.mockReturnValue(true);

    await execute(baseParams);

    const inst = SignalCollector.mock.results[0].value;
    expect(inst.addSignal).not.toHaveBeenCalled();
  });

  it('swallows RAG errors silently (no throw, continues to AI)', async () => {
    ragRetriever.semanticSearch.mockRejectedValue(new Error('vector DB offline'));
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    await expect(execute(baseParams)).resolves.not.toThrow();
    expect(classificationAiService.aiClassify).toHaveBeenCalled();
  });

  it('returns AI result through ensureDecisionQuestion when AI succeeds', async () => {
    classificationAiService.aiClassify.mockResolvedValue({
      library: libraries[0], confidence: 80, verified_by_ai: false,
    });

    const out = await execute(baseParams);
    expect(classificationRoutingService.ensureDecisionQuestion).toHaveBeenCalled();
    expect(out).toBeDefined();
  });

  it('returns needs_retry when AI is unavailable and confidence < 50', async () => {
    confidenceCalculator.calculate.mockReturnValue({ confidence: 40, suggestedLibrary: null });
    classificationAiService.aiClassify.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(true);

    const out = await execute(baseParams);
    expect(out.needs_retry).toBe(true);
    expect(classificationUtilsService.buildPendingRetryResult).toHaveBeenCalled();
  });

  it('returns signal_calculation when AI unavailable + confidence ≥ 50 + suggestedLibrary', async () => {
    confidenceCalculator.calculate.mockReturnValue({ confidence: 65, suggestedLibrary: libraries[0] });
    classificationAiService.aiClassify.mockRejectedValue(new Error('AI error'));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(false);
    classificationRoutingService.ensureDecisionQuestion.mockImplementation(async ({ result }) => result);

    const out = await execute(baseParams);
    expect(out.method).toBe('signal_calculation');
  });

  it('returns fallback when AI unavailable + confidence ≥ 50 + no suggestedLibrary', async () => {
    confidenceCalculator.calculate.mockReturnValue({ confidence: 65, suggestedLibrary: null });
    classificationAiService.aiClassify.mockRejectedValue(new Error('AI error'));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(false);
    classificationRoutingService.ensureDecisionQuestion.mockImplementation(async ({ result }) => result);

    const out = await execute(baseParams);
    expect(out.method).toBe('fallback');
  });
});
