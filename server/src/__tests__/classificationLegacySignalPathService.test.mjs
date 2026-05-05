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
const mockSignalCollector = { SignalCollector, SIGNAL_TYPES: { SEMANTIC_SIMILARITY: 'semantic_similarity' } };

const mockConfidenceCalculator = {
  loadWeights: jest.fn().mockResolvedValue(undefined),
  calculate: jest.fn().mockReturnValue({ confidence: 70, suggestedLibrary: null }),
  toAIContext: jest.fn().mockReturnValue({}),
};

const ragRetriever = {
  semanticSearch: jest.fn().mockResolvedValue([]),
  getSuggestedLibrary: jest.fn().mockReturnValue(null),
  calculateDynamicWeight: jest.fn().mockReturnValue(0.5),
};
const classificationPhaseService = {
  updatePhase: jest.fn(),
};

const classificationEvidenceService = {
  buildRelatedEvidenceSummary: jest.fn().mockReturnValue(null),
  findExactMatch: jest.fn().mockResolvedValue(null),
};

const mockClassificationAiService = { aiClassify: jest.fn() };

const mockClassificationLearnedCorrectionsService = { checkLearnedCorrections: jest.fn() };
const mockLibraryRulesService = { checkLibraryRules: jest.fn() };
const mockLibraryLabelsService = { matchRules: jest.fn() };
const mockMediaSync = { findExistingMedia: jest.fn() };
const mockContentTypeAnalyzer = { analyze: jest.fn().mockResolvedValue({}) };

const isAiTransientAvailabilityError = jest.fn();
const buildPendingRetryResult = jest.fn();
const evaluateRagLoopSecondPass = jest.fn();

const classificationUtilsService = {
  isAiTransientAvailabilityError,
  buildPendingRetryResult,
};

const classificationRagLoopService = {
  evaluateRagLoopSecondPass,
};

const ensureDecisionQuestion = jest.fn();

jest.unstable_mockModule('../services/signalCollector.mjs', () => ({ ...mockSignalCollector, default: mockSignalCollector }));

jest.unstable_mockModule('../services/confidenceCalculator.mjs', () => ({ ...mockConfidenceCalculator, default: mockConfidenceCalculator }));

jest.unstable_mockModule('../services/classificationAiService.mjs', () => ({ ...mockClassificationAiService }));

jest.unstable_mockModule('../services/classificationLearnedCorrectionsService.mjs', () => ({ ...mockClassificationLearnedCorrectionsService, default: mockClassificationLearnedCorrectionsService }));

jest.unstable_mockModule('../services/libraryRulesService.mjs', () => ({ ...mockLibraryRulesService, default: mockLibraryRulesService }));

jest.unstable_mockModule('../services/libraryLabelsService.mjs', () => ({ ...mockLibraryLabelsService, default: mockLibraryLabelsService }));

jest.unstable_mockModule('../services/mediaSync.mjs', () => ({ ...mockMediaSync, default: mockMediaSync }));

jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => ({ ...mockContentTypeAnalyzer, default: mockContentTypeAnalyzer }));

jest.unstable_mockModule('../services/classificationRagLoopService.mjs', () => ({ ...classificationRagLoopService, default: classificationRagLoopService }));

jest.unstable_mockModule('../services/classificationUtilsService.mjs', () => ({ ...classificationUtilsService }));

jest.unstable_mockModule('../services/classificationPhaseService.mjs', () => ({ ...classificationPhaseService, default: classificationPhaseService }));

jest.unstable_mockModule('../services/classificationEvidenceService.mjs', () => ({ ...classificationEvidenceService, default: classificationEvidenceService }));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => ({ ...ragRetriever, default: ragRetriever }));

jest.unstable_mockModule('../services/classificationRoutingService.mjs', () => ({ ensureDecisionQuestion }));

const { SignalCollector: SignalCollectorRef } = mockSignalCollector;
const confidenceCalculator = mockConfidenceCalculator;
const classificationAiService = mockClassificationAiService;

let execute;
let classificationRoutingService;

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

beforeAll(async () => {
  classificationRoutingService = await import('../services/classificationRoutingService.mjs');
  ({ execute } = await import('../services/classificationLegacySignalPathService.mjs'));
});

function makeCollectorInstance() {
  return new SignalCollectorRef();
}

beforeEach(() => {
  SignalCollectorRef.mockClear();
  const tempInst = new SignalCollectorRef();
  tempInst.hasSignal.mockReset().mockReturnValue(false);
  tempInst.addSignal.mockReset();
  tempInst.collectAll.mockReset().mockResolvedValue(undefined);
  tempInst.getSignals.mockReset().mockReturnValue([]);
  tempInst.getPatternSignals.mockReset().mockReturnValue([]);
  SignalCollectorRef.mockClear();
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

    const instance = SignalCollectorRef.mock.results[0].value;
    const collectAllArgs = instance.collectAll.mock.calls[0];
    const detectors = collectAllArgs[2];
    expect(typeof detectors.checkLearnedCorrections).toBe('function');
    expect(typeof detectors.checkLibraryRules).toBe('function');
    expect(typeof detectors.findExistingMedia).toBe('function');
    expect(typeof detectors.matchRules).toBe('function');
    expect(typeof detectors.checkExactMatch).toBe('function');
  });

  it('uses an injected media sync loader for findExistingMedia detectors', async () => {
    const injectedMediaSyncService = { findExistingMedia: jest.fn().mockResolvedValue({ id: 901 }) };
    const loadMediaSyncService = jest.fn().mockResolvedValue(injectedMediaSyncService);
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    await execute({
      ...baseParams,
      loadMediaSyncService,
    });

    const instance = SignalCollectorRef.mock.results[0].value;
    const detectors = instance.collectAll.mock.calls[0][2];
    await expect(detectors.findExistingMedia('movie', 123)).resolves.toEqual({ id: 901 });
    expect(loadMediaSyncService).toHaveBeenCalledTimes(1);
    expect(injectedMediaSyncService.findExistingMedia).toHaveBeenCalledWith('movie', 123);
  });

  it('adds RAG signal when semanticSearch returns results and library is found', async () => {
    const similarItems = [{ libraryId: 1, similarity: 0.9 }];
    ragRetriever.semanticSearch.mockResolvedValue(similarItems);
    ragRetriever.getSuggestedLibrary.mockReturnValue({ libraryId: 1, avgSimilarity: 0.9, voteCount: 1 });
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    await execute(baseParams);

    const instance = SignalCollectorRef.mock.results[0].value;
    expect(instance.addSignal).toHaveBeenCalledWith(
      'semantic_similarity',
      expect.objectContaining({ avgSimilarity: 0.9 }),
      expect.any(Number),
      expect.objectContaining({ id: 1 }),
    );
  });

  it('skips RAG signal when SEMANTIC_SIMILARITY already collected', async () => {
    const similarItems = [{ libraryId: 1, similarity: 0.9 }];
    ragRetriever.semanticSearch.mockResolvedValue(similarItems);
    ragRetriever.getSuggestedLibrary.mockReturnValue({ libraryId: 1 });
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    const instance = makeCollectorInstance();
    instance.hasSignal.mockReturnValue(true);

    await execute(baseParams);

    const inst = SignalCollectorRef.mock.results[0].value;
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

  it('returns signal_calculation when AI unavailable + confidence >= 50 + suggestedLibrary', async () => {
    confidenceCalculator.calculate.mockReturnValue({ confidence: 65, suggestedLibrary: libraries[0] });
    classificationAiService.aiClassify.mockRejectedValue(new Error('AI error'));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(false);
    classificationRoutingService.ensureDecisionQuestion.mockImplementation(async ({ result }) => result);

    const out = await execute(baseParams);
    expect(out.method).toBe('signal_calculation');
  });

  it('returns fallback when AI unavailable + confidence >= 50 + no suggestedLibrary', async () => {
    confidenceCalculator.calculate.mockReturnValue({ confidence: 65, suggestedLibrary: null });
    classificationAiService.aiClassify.mockRejectedValue(new Error('AI error'));
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValue(false);
    classificationRoutingService.ensureDecisionQuestion.mockImplementation(async ({ result }) => result);

    const out = await execute(baseParams);
    expect(out.method).toBe('fallback');
  });
});
