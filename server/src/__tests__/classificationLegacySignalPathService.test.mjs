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
import { createNamedMockModule, createServiceStubs } from './helpers/mockFactory.mjs';

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

const mockConfidenceCalculator = createServiceStubs(['loadWeights', 'calculate', 'toAIContext'], {
  loadWeights: jest.fn().mockResolvedValue(undefined),
  calculate: jest.fn().mockReturnValue({ confidence: 70, suggestedLibrary: null }),
  toAIContext: jest.fn().mockReturnValue({}),
});

const ragRetriever = createServiceStubs(['semanticSearch', 'getSuggestedLibrary', 'calculateDynamicWeight'], {
  semanticSearch: jest.fn().mockResolvedValue([]),
  getSuggestedLibrary: jest.fn().mockReturnValue(null),
  calculateDynamicWeight: jest.fn().mockReturnValue(0.5),
});
const classificationProgressStageService = createServiceStubs(['updateStage']);

const classificationEvidenceService = createServiceStubs(['buildRelatedEvidenceSummary', 'findExactMatch'], {
  buildRelatedEvidenceSummary: jest.fn().mockReturnValue(null),
  findExactMatch: jest.fn().mockResolvedValue(null),
});

const mockClassificationAiService = createServiceStubs(['aiClassify']);

const mockClassificationLearnedCorrectionsService = createServiceStubs(['checkLearnedCorrections']);
const mockLibraryRulesService = createServiceStubs(['checkLibraryRules']);
const mockLibraryLabelsService = createServiceStubs(['matchRules']);
const mediaSyncLibraryStateService = createServiceStubs(['findExistingMedia']);
const mockContentTypeAnalyzer = createServiceStubs(['analyze'], {
  analyze: jest.fn().mockResolvedValue({}),
});

const isAiTransientAvailabilityError = jest.fn();
const buildPendingRetryResult = jest.fn();
const evaluateRagLoopSecondPass = jest.fn();

const classificationUtilsService = createServiceStubs(['isAiTransientAvailabilityError', 'buildPendingRetryResult'], {
  isAiTransientAvailabilityError,
  buildPendingRetryResult,
});

const classificationRagLoopService = createServiceStubs(['evaluateRagLoopSecondPass'], {
  evaluateRagLoopSecondPass,
});

const mockClassificationRoutingService = createServiceStubs(['ensureDecisionQuestion']);

jest.unstable_mockModule('../services/signalCollector.mjs', () => createNamedMockModule('SIGNAL_TYPES', mockSignalCollector));

jest.unstable_mockModule('../services/confidenceCalculator.mjs', () => createNamedMockModule('confidenceCalculator', mockConfidenceCalculator));

jest.unstable_mockModule('../services/classificationAiService.mjs', () => createNamedMockModule('classificationAiService', mockClassificationAiService));
jest.unstable_mockModule('../services/classificationLearnedCorrectionsService.mjs', () => createNamedMockModule('classificationLearnedCorrectionsService', mockClassificationLearnedCorrectionsService));

jest.unstable_mockModule('../services/libraryRulesService.mjs', () => createNamedMockModule('libraryRulesService', mockLibraryRulesService));

jest.unstable_mockModule('../services/libraryLabelsService.mjs', () => createNamedMockModule('libraryLabelsService', mockLibraryLabelsService));

jest.unstable_mockModule('../services/mediaSyncLibraryStateService.mjs', () => createNamedMockModule('mediaSyncLibraryStateService', mediaSyncLibraryStateService));

jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => createNamedMockModule('contentTypeAnalyzer', mockContentTypeAnalyzer));

jest.unstable_mockModule('../services/classificationRagLoopService.mjs', () => createNamedMockModule('classificationRagLoopService', classificationRagLoopService));

jest.unstable_mockModule('../services/classificationUtilsService.mjs', () => createNamedMockModule('classificationUtilsService', classificationUtilsService));

jest.unstable_mockModule('../services/classificationProgressStageService.mjs', () => createNamedMockModule('classificationProgressStageService', classificationProgressStageService));

jest.unstable_mockModule('../services/classificationEvidenceService.mjs', () => createNamedMockModule('classificationEvidenceService', classificationEvidenceService));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => createNamedMockModule('ragRetriever', ragRetriever));

jest.unstable_mockModule('../services/classificationRoutingService.mjs', () => createNamedMockModule('classificationRoutingService', mockClassificationRoutingService));
const { SignalCollector: SignalCollectorRef } = mockSignalCollector;
const confidenceCalculator = mockConfidenceCalculator;
const classificationAiService = mockClassificationAiService;
const classificationRoutingService = mockClassificationRoutingService;
const { execute } = await import('../services/classificationLegacySignalPathService.mjs');

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
  it('calls SignalCollector.collectAll with direct collaborator detectors', async () => {
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    await execute(baseParams);

    const instance = SignalCollectorRef.mock.results[0].value;
    const collectAllArgs = instance.collectAll.mock.calls[0];
    const detectors = collectAllArgs[2];
    expect(detectors.classificationLearnedCorrectionsService).toBe(mockClassificationLearnedCorrectionsService);
    expect(detectors.libraryRulesService).toBe(mockLibraryRulesService);
    expect(detectors.libraryLabelsService.matchRules).toBe(mockLibraryLabelsService.matchRules);
    expect(detectors.mediaSyncLibraryStateService).toBe(mediaSyncLibraryStateService);
    expect(detectors.contentTypeAnalyzer).toBe(mockContentTypeAnalyzer);
    expect(detectors.classificationEvidenceService).toBe(classificationEvidenceService);
  });

  it('uses an injected media-sync library state service for direct detectors', async () => {
    const injectedMediaSyncLibraryStateService = { findExistingMedia: jest.fn().mockResolvedValue({ id: 901 }) };
    classificationAiService.aiClassify.mockResolvedValue({ library: libraries[0], confidence: 75, verified_by_ai: false });

    await execute({
      ...baseParams,
      mediaSyncLibraryStateService: injectedMediaSyncLibraryStateService,
    });

    const instance = SignalCollectorRef.mock.results[0].value;
    const detectors = instance.collectAll.mock.calls[0][2];
    await expect(detectors.mediaSyncLibraryStateService.findExistingMedia(123, 'movie')).resolves.toEqual({ id: 901 });
    expect(injectedMediaSyncLibraryStateService.findExistingMedia).toHaveBeenCalledWith(123, 'movie');
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
