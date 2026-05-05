/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Delegation Contract Tests
 * =========================
 * classification.js is a facade: many of its public methods simply forward to a
 * dedicated sub-service.  These tests pin that contract so that:
 *
 *   1. A refactor that breaks a delegation chain fails immediately here.
 *   2. Authors of integration/unit tests can look here to find the CORRECT
 *      spy target.  Rule: spy on the implementing sub-service, not the wrapper.
 *
 * Example: to control getRagLoopConfig in an integration test, spy on
 *   classificationRagLoopService.getRagLoopConfig   ✓
 * NOT
 *   classificationService.getRagLoopConfig           ✗  (silently ignored)
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };

const mockLoggerModule = {
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
};

const mockSignalCollector = {
    SignalCollector: jest.fn().mockImplementation(() => ({
        collectAll: jest.fn(),
        getSignals: jest.fn().mockReturnValue([]),
        getPatternSignals: jest.fn().mockReturnValue([]),
        hasSignal: jest.fn().mockReturnValue(false),
        addSignal: jest.fn()
    })),
    SIGNAL_TYPES: {}
};

const mockPolicyQuestionBuilder = { build: jest.fn() };

const mockRagLogger = { logStageEvent: jest.fn(), logOperation: jest.fn() };

const mockMetadataNormalization = {
    normalizeMetadataList: jest.fn().mockReturnValue([]),
    normalizeMetadataListLower: jest.fn().mockReturnValue([])
};

const mockRagLoopMetricsCollector = {
    recordEvaluation: jest.fn(),
    shouldAttemptAutoRecover: jest.fn().mockReturnValue({ shouldRecover: false }),
    evaluateAutoFallback: jest.fn().mockReturnValue({
        shouldFallback: false, shouldPersistBreachCount: false,
        breachDetected: false, nextBreachCount: 0,
        thresholds: {}, observedMetrics: {}, breachReasonCodes: []
    })
};

const mockRagLoopResilienceManager = {
    canRun: jest.fn().mockReturnValue({ allowed: true }),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    reset: jest.fn()
};

const mockRagLoopConfig = {
    validateAndNormalizeRagLoopConfig: jest.fn().mockReturnValue({ normalizedConfig: {}, warnings: [] })
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];

const mockRagLoopHelpers = {
    RAG_LOOP_FALLBACK_ACTIONS: {},
    RAG_LOOP_REASON_CODES: {},
    applyOrShadowDecision: jest.fn(),
    buildRagLoopTrace: jest.fn().mockReturnValue(null),
    classifyDbSqlState: jest.fn(),
    comparePassResults: jest.fn(),
    detectRagConflict: jest.fn(),
    evaluatePolicyRecheckGate: jest.fn(),
    expandRetrievalMetadata: jest.fn(),
    extractVerifiableEvidence: jest.fn(),
    getRecheckEligibility: jest.fn(),
    getMetadataCompleteness: jest.fn(),
    isRetryableDbConflictError: jest.fn(),
    isAiRerunEligible: jest.fn(),
    isLearningEligible: jest.fn(),
    isMetadataEnrichmentEligible: jest.fn(),
    resolvePolicyContextOrFallback: jest.fn().mockReturnValue({}),
    resolveConflictDecision: jest.fn(),
    selectRetryStrategy: jest.fn(),
    shouldTriggerSecondPass: jest.fn().mockReturnValue({ trigger: null, run: false }),
    summarizePassDiagnostics: jest.fn().mockReturnValue({})
};

const mockOperationController = {
    OperationController: jest.fn().mockImplementation(() => ({ run: jest.fn() }))
};

const mockClassificationRagLoopService = {
    getRagLoopConfig: jest.fn(),
    getCurrentAppVersion: jest.fn(),
    getCurrentImageTag: jest.fn(),
    getRecentFallbackDiagnostics: jest.fn(),
    buildAutoFallbackIncidentPayload: jest.fn(),
    persistAutoFallbackBreachCount: jest.fn(),
    maybeApplyRolloutAutomation: jest.fn(),
    buildFreshSecondPassBaseResult: jest.fn(),
    buildPolicyRecheckCandidate: jest.fn(),
    buildAiRerunCandidate: jest.fn(),
    evaluateRagLoopSecondPass: jest.fn()
};

const mockClassificationMetadataService = {
    parseOverseerrPayload: jest.fn(),
    enrichWithTMDB: jest.fn(),
    getTavilyConfig: jest.fn(),
    mergeMetadataForRecheck: jest.fn(),
    enrichWithWebSearch: jest.fn(),
    detectEventTypesFromMetadata: jest.fn(),
    mightBeAnime: jest.fn()
};

const mockClassificationUtilsService = {
    resolveRagLoopTimeout: jest.fn(),
    withTimeout: jest.fn(),
    sleep: jest.fn(),
    withRetryableDbConflict: jest.fn(),
    isAiTransientAvailabilityError: jest.fn(),
    buildParseDiagnostics: jest.fn(),
    buildPendingRetryResult: jest.fn(),
    resolveRetryReason: jest.fn()
};

const mockClassificationAiService = {
    aiClassify: jest.fn(),
    normalizeAiResponseLine: jest.fn(),
    buildAiRepairPrompt: jest.fn(),
    attemptAiResponseRepair: jest.fn()
};

const mockClassificationPersistenceService = {
    isRealtimeEmbeddingEnabled: jest.fn(),
    logClassification: jest.fn(),
    persistRagLoopStageEvents: jest.fn(),
    rebindRetryLineage: jest.fn(),
    deriveClassificationPersistenceState: jest.fn(),
    normalizePolicyQuestion: jest.fn()
};

const mockClassificationRoutingService = {
    ensureDecisionQuestion: jest.fn(),
    routeToArr: jest.fn(),
    normalizeSettings: jest.fn(),
    normalizeQualityProfileId: jest.fn(),
    resolveRoutingConfig: jest.fn(),
    isSettingsEmpty: jest.fn(),
    resolveDefaultQualityProfile: jest.fn(),
    resolveDefaultRootFolder: jest.fn(),
    suggestSeriesType: jest.fn()
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/ollama.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/radarr.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/sonarr.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/discordBot.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/tavily.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/mediaSync.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/clarificationService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/classificationPhaseService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/classificationRetryService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/aiRouter.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/signalCollector.mjs', () => ({ ...mockSignalCollector, default: mockSignalCollector }));

jest.unstable_mockModule('../services/confidenceCalculator.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/embeddingService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/classificationEvidenceReinforcementService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/policyEngine.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/policyQuestionBuilder.mjs', () => ({ ...mockPolicyQuestionBuilder, default: mockPolicyQuestionBuilder }));

jest.unstable_mockModule('../services/classificationEvidenceService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/providerLock.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/aiPromptBuilder.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/aiResponseParser.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../utils/ragLogger.mjs', () => ({ ...mockRagLogger, default: mockRagLogger }));

jest.unstable_mockModule('../utils/metadataNormalization.mjs', () => ({ ...mockMetadataNormalization, default: mockMetadataNormalization }));

jest.unstable_mockModule('../services/ragLoopMetricsCollector.mjs', () => ({ ...mockRagLoopMetricsCollector, default: mockRagLoopMetricsCollector }));

jest.unstable_mockModule('../services/ragLoopResilienceManager.mjs', () => ({ ...mockRagLoopResilienceManager, default: mockRagLoopResilienceManager }));

jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

jest.unstable_mockModule('../utils/ragLoopHelpers.mjs', () => ({ ...mockRagLoopHelpers, default: mockRagLoopHelpers }));

jest.unstable_mockModule('../utils/operationController.mjs', () => ({ ...mockOperationController, default: mockOperationController }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLoggerModule, default: mockLoggerModule }));

jest.unstable_mockModule('../services/classificationRagLoopService.mjs', () => ({ ...mockClassificationRagLoopService, default: mockClassificationRagLoopService }));

jest.unstable_mockModule('../services/classificationMetadataService.mjs', () => ({ ...mockClassificationMetadataService, default: mockClassificationMetadataService }));

jest.unstable_mockModule('../services/classificationUtilsService.mjs', () => ({ ...mockClassificationUtilsService }));

jest.unstable_mockModule('../services/classificationAiService.mjs', () => ({ ...mockClassificationAiService, default: mockClassificationAiService }));

jest.unstable_mockModule('../services/classificationPersistenceService.mjs', () => ({ ...mockClassificationPersistenceService, default: mockClassificationPersistenceService }));

jest.unstable_mockModule('../services/classificationRoutingService.mjs', () => ({ ...mockClassificationRoutingService }));

const { default: classificationService } = await import('../services/classification.mjs');
const { normalizeClassificationServiceConfig } = await import('../services/classificationServiceCore.mjs');
const classificationRagLoopService = mockClassificationRagLoopService;
const classificationMetadataService = mockClassificationMetadataService;
const classificationUtilsService = mockClassificationUtilsService;
const classificationAiService = mockClassificationAiService;
const classificationPersistenceService = mockClassificationPersistenceService;
const classificationRoutingService = mockClassificationRoutingService;

const SENTINEL = Object.freeze({ __sentinel: true });

function impl(service, method) {
    if (typeof service[method] !== 'function') {
        throw new Error(`No auto-mock found for ${method} — check jest.mock() setup`);
    }
    return service[method];
}

async function assertDelegates(wrapperFn, targetFn, ...args) {
    targetFn.mockResolvedValue(SENTINEL);
    const result = await wrapperFn(...args);
    expect(targetFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(SENTINEL);
}

function assertDelegatesSync(wrapperFn, targetFn, ...args) {
    targetFn.mockReturnValue(SENTINEL);
    const result = wrapperFn(...args);
    expect(targetFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(SENTINEL);
}

describe('classificationService core config normalization', () => {
    test('accepts grouped dependency bundles while preserving flat-key precedence', () => {
        const groupedDb = { grouped: 'db' };
        const explicitDb = { explicit: 'db' };
        const groupedTmdbService = { grouped: 'tmdb' };
        const groupedMetadataService = { grouped: 'metadata' };
        const explicitMetadataService = { explicit: 'metadata' };
        const groupedLoggerFactory = jest.fn();
        const groupedIdleLoader = jest.fn();

        const normalized = normalizeClassificationServiceConfig({
            infrastructure: {
                db: groupedDb,
                tmdbService: groupedTmdbService,
            },
            domainServices: {
                classificationMetadataService: groupedMetadataService,
            },
            utilities: {
                createLogger: groupedLoggerFactory,
            },
            loaders: {
                loadIdleDetector: groupedIdleLoader,
            },
            db: explicitDb,
            classificationMetadataService: explicitMetadataService,
        });

        expect(normalized.db).toBe(explicitDb);
        expect(normalized.tmdbService).toBe(groupedTmdbService);
        expect(normalized.classificationMetadataService).toBe(explicitMetadataService);
        expect(normalized.createLogger).toBe(groupedLoggerFactory);
        expect(normalized.loadIdleDetector).toBe(groupedIdleLoader);
    });
});

describe('classificationService delegation contracts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================================================
    // classificationRagLoopService — 11 delegations
    //
    // INTEGRATION TEST NOTE: When mocking any of these in an integration test,
    // spy on classificationRagLoopService.<method>, NOT classificationService.<method>.
    // The wrapper is bypassed entirely once evaluateRagLoopSecondPass delegates
    // to the sub-service, which then calls its own getRagLoopConfig directly.
    // =========================================================================
    describe('classificationRagLoopService delegations', () => {
        test('getRagLoopConfig', async () => {
            await assertDelegates(
                () => classificationService.getRagLoopConfig(),
                impl(classificationRagLoopService, 'getRagLoopConfig')
            );
        });

        test('getCurrentAppVersion', () => {
            assertDelegatesSync(
                () => classificationService.getCurrentAppVersion(),
                impl(classificationRagLoopService, 'getCurrentAppVersion')
            );
        });

        test('getCurrentImageTag', () => {
            assertDelegatesSync(
                () => classificationService.getCurrentImageTag(),
                impl(classificationRagLoopService, 'getCurrentImageTag')
            );
        });

        test('getRecentFallbackDiagnostics passes limit argument', async () => {
            impl(classificationRagLoopService, 'getRecentFallbackDiagnostics').mockResolvedValue(SENTINEL);
            const result = await classificationService.getRecentFallbackDiagnostics(10);
            expect(classificationRagLoopService.getRecentFallbackDiagnostics).toHaveBeenCalledWith(10);
            expect(result).toBe(SENTINEL);
        });

        test('buildAutoFallbackIncidentPayload passes params', () => {
            const params = { a: 1 };
            impl(classificationRagLoopService, 'buildAutoFallbackIncidentPayload').mockReturnValue(SENTINEL);
            const result = classificationService.buildAutoFallbackIncidentPayload(params);
            expect(classificationRagLoopService.buildAutoFallbackIncidentPayload).toHaveBeenCalledWith(params);
            expect(result).toBe(SENTINEL);
        });

        test('persistAutoFallbackBreachCount passes params', async () => {
            const params = { b: 2 };
            await assertDelegates(
                () => classificationService.persistAutoFallbackBreachCount(params),
                impl(classificationRagLoopService, 'persistAutoFallbackBreachCount'),
                params
            );
            expect(classificationRagLoopService.persistAutoFallbackBreachCount).toHaveBeenCalledWith(params);
        });

        test('maybeApplyRolloutAutomation passes params', async () => {
            const params = { c: 3 };
            await assertDelegates(
                () => classificationService.maybeApplyRolloutAutomation(params),
                impl(classificationRagLoopService, 'maybeApplyRolloutAutomation'),
                params
            );
            expect(classificationRagLoopService.maybeApplyRolloutAutomation).toHaveBeenCalledWith(params);
        });

        test('buildFreshSecondPassBaseResult passes baselineResult', () => {
            const baselineResult = { library: { id: 1 } };
            impl(classificationRagLoopService, 'buildFreshSecondPassBaseResult').mockReturnValue(SENTINEL);
            const result = classificationService.buildFreshSecondPassBaseResult(baselineResult);
            expect(classificationRagLoopService.buildFreshSecondPassBaseResult).toHaveBeenCalledWith(baselineResult);
            expect(result).toBe(SENTINEL);
        });

        test('buildPolicyRecheckCandidate passes params', () => {
            const params = { d: 4 };
            impl(classificationRagLoopService, 'buildPolicyRecheckCandidate').mockReturnValue(SENTINEL);
            const result = classificationService.buildPolicyRecheckCandidate(params);
            expect(classificationRagLoopService.buildPolicyRecheckCandidate).toHaveBeenCalledWith(params);
            expect(result).toBe(SENTINEL);
        });

        test('buildAiRerunCandidate passes params', () => {
            const params = { e: 5 };
            impl(classificationRagLoopService, 'buildAiRerunCandidate').mockReturnValue(SENTINEL);
            const result = classificationService.buildAiRerunCandidate(params);
            expect(classificationRagLoopService.buildAiRerunCandidate).toHaveBeenCalledWith(params);
            expect(result).toBe(SENTINEL);
        });

        test('evaluateRagLoopSecondPass passes full params object', async () => {
            const params = {
                metadata: { tmdb_id: 1 },
                libraries: [],
                baselineResult: { library: { id: 1 }, confidence: 70 }
            };
            await assertDelegates(
                () => classificationService.evaluateRagLoopSecondPass(params),
                impl(classificationRagLoopService, 'evaluateRagLoopSecondPass'),
                params
            );
            expect(classificationRagLoopService.evaluateRagLoopSecondPass).toHaveBeenCalledWith(params);
        });
    });

    // =========================================================================
    // classificationMetadataService — 7 delegations
    // =========================================================================
    describe('classificationMetadataService delegations', () => {
        test('parseOverseerrPayload passes payload', async () => {
            const payload = { requestId: 42 };
            await assertDelegates(
                () => classificationService.parseOverseerrPayload(payload),
                impl(classificationMetadataService, 'parseOverseerrPayload'),
                payload
            );
            expect(classificationMetadataService.parseOverseerrPayload).toHaveBeenCalledWith(payload);
        });

        test('enrichWithTMDB passes tmdbId and mediaType', async () => {
            impl(classificationMetadataService, 'enrichWithTMDB').mockResolvedValue(SENTINEL);
            const result = await classificationService.enrichWithTMDB(9999, 'movie');
            expect(classificationMetadataService.enrichWithTMDB).toHaveBeenCalledWith(9999, 'movie');
            expect(result).toBe(SENTINEL);
        });

        test('getTavilyConfig', async () => {
            await assertDelegates(
                () => classificationService.getTavilyConfig(),
                impl(classificationMetadataService, 'getTavilyConfig')
            );
        });

        test('mergeMetadataForRecheck passes both metadata objects', () => {
            const orig = { title: 'A' };
            const enriched = { genres: ['Drama'] };
            impl(classificationMetadataService, 'mergeMetadataForRecheck').mockReturnValue(SENTINEL);
            const result = classificationService.mergeMetadataForRecheck(orig, enriched);
            expect(classificationMetadataService.mergeMetadataForRecheck).toHaveBeenCalledWith(orig, enriched);
            expect(result).toBe(SENTINEL);
        });

        test('enrichWithWebSearch passes metadata', async () => {
            const metadata = { title: 'B' };
            await assertDelegates(
                () => classificationService.enrichWithWebSearch(metadata),
                impl(classificationMetadataService, 'enrichWithWebSearch'),
                metadata
            );
            expect(classificationMetadataService.enrichWithWebSearch).toHaveBeenCalledWith(metadata);
        });

        test('detectEventTypesFromMetadata passes metadata', () => {
            const metadata = { title: 'C' };
            impl(classificationMetadataService, 'detectEventTypesFromMetadata').mockReturnValue(SENTINEL);
            const result = classificationService.detectEventTypesFromMetadata(metadata);
            expect(classificationMetadataService.detectEventTypesFromMetadata).toHaveBeenCalledWith(metadata);
            expect(result).toBe(SENTINEL);
        });

        test('mightBeAnime passes metadata', () => {
            const metadata = { title: 'D' };
            impl(classificationMetadataService, 'mightBeAnime').mockReturnValue(SENTINEL);
            const result = classificationService.mightBeAnime(metadata);
            expect(classificationMetadataService.mightBeAnime).toHaveBeenCalledWith(metadata);
            expect(result).toBe(SENTINEL);
        });
    });

    // =========================================================================
    // classificationUtilsService — 8 delegations
    // =========================================================================
    describe('classificationUtilsService delegations', () => {
        test('resolveRagLoopTimeout passes config', () => {
            const config = { rag_loop_timeout_ms: 5000 };
            impl(classificationUtilsService, 'resolveRagLoopTimeout').mockReturnValue(5000);
            const result = classificationService.resolveRagLoopTimeout(config);
            expect(classificationUtilsService.resolveRagLoopTimeout).toHaveBeenCalledWith(config);
            expect(result).toBe(5000);
        });

        test('withTimeout passes operationOrPromise, timeoutMs, timeoutMessage', async () => {
            const op = jest.fn();
            impl(classificationUtilsService, 'withTimeout').mockResolvedValue(SENTINEL);
            const result = await classificationService.withTimeout(op, 3000, 'test_timeout');
            expect(classificationUtilsService.withTimeout).toHaveBeenCalledWith(op, 3000, 'test_timeout');
            expect(result).toBe(SENTINEL);
        });

        test('sleep passes ms', async () => {
            impl(classificationUtilsService, 'sleep').mockResolvedValue(SENTINEL);
            const result = await classificationService.sleep(100);
            expect(classificationUtilsService.sleep).toHaveBeenCalledWith(100);
            expect(result).toBe(SENTINEL);
        });

        test('withRetryableDbConflict passes operation and options', async () => {
            const op = jest.fn();
            const opts = { maxRetries: 3 };
            impl(classificationUtilsService, 'withRetryableDbConflict').mockResolvedValue(SENTINEL);
            const result = await classificationService.withRetryableDbConflict(op, opts);
            expect(classificationUtilsService.withRetryableDbConflict).toHaveBeenCalledWith(op, opts);
            expect(result).toBe(SENTINEL);
        });

        test('isAiTransientAvailabilityError passes error', () => {
            const err = new Error('overloaded');
            impl(classificationUtilsService, 'isAiTransientAvailabilityError').mockReturnValue(true);
            const result = classificationService.isAiTransientAvailabilityError(err);
            expect(classificationUtilsService.isAiTransientAvailabilityError).toHaveBeenCalledWith(err);
            expect(result).toBe(true);
        });

        test('buildParseDiagnostics passes params', () => {
            const params = { raw: 'x' };
            impl(classificationUtilsService, 'buildParseDiagnostics').mockReturnValue(SENTINEL);
            const result = classificationService.buildParseDiagnostics(params);
            expect(classificationUtilsService.buildParseDiagnostics).toHaveBeenCalledWith(params);
            expect(result).toBe(SENTINEL);
        });

        test('buildPendingRetryResult passes params', () => {
            const params = { confidence: 40 };
            impl(classificationUtilsService, 'buildPendingRetryResult').mockReturnValue(SENTINEL);
            const result = classificationService.buildPendingRetryResult(params);
            expect(classificationUtilsService.buildPendingRetryResult).toHaveBeenCalledWith(params);
            expect(result).toBe(SENTINEL);
        });

        test('resolveRetryReason passes error', () => {
            const err = new Error('db gone');
            impl(classificationUtilsService, 'resolveRetryReason').mockReturnValue('db_unavailable');
            const result = classificationService.resolveRetryReason(err);
            expect(classificationUtilsService.resolveRetryReason).toHaveBeenCalledWith(err);
            expect(result).toBe('db_unavailable');
        });
    });

    // =========================================================================
    // classificationAiService — 3 delegations
    // =========================================================================
    describe('classificationAiService delegations', () => {
        test('normalizeAiResponseLine passes value', () => {
            impl(classificationAiService, 'normalizeAiResponseLine').mockReturnValue('normalized');
            const result = classificationService.normalizeAiResponseLine('  raw  ');
            expect(classificationAiService.normalizeAiResponseLine).toHaveBeenCalledWith('  raw  ');
            expect(result).toBe('normalized');
        });

        test('buildAiRepairPrompt passes all named params', () => {
            const params = { response: 'r', libraries: [], signalContext: {}, mode: 'classify' };
            impl(classificationAiService, 'buildAiRepairPrompt').mockReturnValue(SENTINEL);
            const result = classificationService.buildAiRepairPrompt(params);
            expect(classificationAiService.buildAiRepairPrompt).toHaveBeenCalledWith(params);
            expect(result).toBe(SENTINEL);
        });

        test('attemptAiResponseRepair passes all named params', async () => {
            const params = {
                response: 'r', libraries: [], signalContext: {},
                mode: 'classify', model: 'gpt-4', temperature: 0.2
            };
            impl(classificationAiService, 'attemptAiResponseRepair').mockResolvedValue(SENTINEL);
            const result = await classificationService.attemptAiResponseRepair(params);
            expect(classificationAiService.attemptAiResponseRepair).toHaveBeenCalledWith(params);
            expect(result).toBe(SENTINEL);
        });
    });

    // =========================================================================
    // classificationPersistenceService — 6 delegations
    // =========================================================================
    describe('classificationPersistenceService delegations', () => {
        test('isRealtimeEmbeddingEnabled', async () => {
            await assertDelegates(
                () => classificationService.isRealtimeEmbeddingEnabled(),
                impl(classificationPersistenceService, 'isRealtimeEmbeddingEnabled')
            );
        });

        test('logClassification passes metadata, result, startTime', async () => {
            const metadata = { tmdb_id: 1 };
            const result = { library: { id: 1 } };
            const startTime = Date.now();
            impl(classificationPersistenceService, 'logClassification').mockResolvedValue(42);
            const id = await classificationService.logClassification(metadata, result, startTime);
            expect(classificationPersistenceService.logClassification).toHaveBeenCalledWith(metadata, result, startTime);
            expect(id).toBe(42);
        });

        test('persistRagLoopStageEvents passes params', async () => {
            const params = { correlationId: 'abc', events: [] };
            await assertDelegates(
                () => classificationService.persistRagLoopStageEvents(params),
                impl(classificationPersistenceService, 'persistRagLoopStageEvents'),
                params
            );
            expect(classificationPersistenceService.persistRagLoopStageEvents).toHaveBeenCalledWith(params);
        });

        test('rebindRetryLineage passes classificationId and metadata', async () => {
            const metadata = { tmdb_id: 99 };
            impl(classificationPersistenceService, 'rebindRetryLineage').mockResolvedValue(SENTINEL);
            const result = await classificationService.rebindRetryLineage(7, metadata);
            expect(classificationPersistenceService.rebindRetryLineage).toHaveBeenCalledWith(7, metadata);
            expect(result).toBe(SENTINEL);
        });

        test('deriveClassificationPersistenceState passes result', async () => {
            const result = { library: { id: 1 }, confidence: 80 };
            await assertDelegates(
                () => classificationService.deriveClassificationPersistenceState(result),
                impl(classificationPersistenceService, 'deriveClassificationPersistenceState'),
                result
            );
            expect(classificationPersistenceService.deriveClassificationPersistenceState).toHaveBeenCalledWith(result);
        });

        test('normalizePolicyQuestion passes value', async () => {
            impl(classificationPersistenceService, 'normalizePolicyQuestion').mockResolvedValue(SENTINEL);
            const result = await classificationService.normalizePolicyQuestion('q1');
            expect(classificationPersistenceService.normalizePolicyQuestion).toHaveBeenCalledWith('q1');
            expect(result).toBe(SENTINEL);
        });
    });

    // =========================================================================
    // classificationRoutingService — 8 delegations
    // =========================================================================
    describe('classificationRoutingService delegations', () => {
        test('routeToArr passes metadata and library', async () => {
            const metadata = { tmdb_id: 1 };
            const library = { id: 2, name: 'Movies' };
            await assertDelegates(
                () => classificationService.routeToArr(metadata, library),
                impl(classificationRoutingService, 'routeToArr'),
                metadata, library
            );
            expect(classificationRoutingService.routeToArr).toHaveBeenCalledWith(metadata, library);
        });

        test('normalizeSettings passes settings', () => {
            const settings = { quality: 1 };
            impl(classificationRoutingService, 'normalizeSettings').mockReturnValue(SENTINEL);
            const result = classificationService.normalizeSettings(settings);
            expect(classificationRoutingService.normalizeSettings).toHaveBeenCalledWith(settings);
            expect(result).toBe(SENTINEL);
        });

        test('normalizeQualityProfileId passes value', () => {
            impl(classificationRoutingService, 'normalizeQualityProfileId').mockReturnValue(5);
            const result = classificationService.normalizeQualityProfileId('5');
            expect(classificationRoutingService.normalizeQualityProfileId).toHaveBeenCalledWith('5');
            expect(result).toBe(5);
        });

        test('resolveRoutingConfig passes library', async () => {
            const library = { id: 1 };
            await assertDelegates(
                () => classificationService.resolveRoutingConfig(library),
                impl(classificationRoutingService, 'resolveRoutingConfig'),
                library
            );
            expect(classificationRoutingService.resolveRoutingConfig).toHaveBeenCalledWith(library);
        });

        test('isSettingsEmpty passes settings', () => {
            impl(classificationRoutingService, 'isSettingsEmpty').mockReturnValue(true);
            const result = classificationService.isSettingsEmpty({});
            expect(classificationRoutingService.isSettingsEmpty).toHaveBeenCalledWith({});
            expect(result).toBe(true);
        });

        test('resolveDefaultQualityProfile passes arrType, baseUrl, apiKey', async () => {
            impl(classificationRoutingService, 'resolveDefaultQualityProfile').mockResolvedValue(SENTINEL);
            const result = await classificationService.resolveDefaultQualityProfile('radarr', 'http://x', 'key');
            expect(classificationRoutingService.resolveDefaultQualityProfile).toHaveBeenCalledWith('radarr', 'http://x', 'key');
            expect(result).toBe(SENTINEL);
        });

        test('resolveDefaultRootFolder passes arrType, baseUrl, apiKey', async () => {
            impl(classificationRoutingService, 'resolveDefaultRootFolder').mockResolvedValue(SENTINEL);
            const result = await classificationService.resolveDefaultRootFolder('sonarr', 'http://y', 'k2');
            expect(classificationRoutingService.resolveDefaultRootFolder).toHaveBeenCalledWith('sonarr', 'http://y', 'k2');
            expect(result).toBe(SENTINEL);
        });

        test('suggestSeriesType passes metadata and appliedLabels', () => {
            const metadata = { title: 'Show' };
            const labels = ['anime'];
            impl(classificationRoutingService, 'suggestSeriesType').mockReturnValue('anime');
            const result = classificationService.suggestSeriesType(metadata, labels);
            expect(classificationRoutingService.suggestSeriesType).toHaveBeenCalledWith(metadata, labels);
            expect(result).toBe('anime');
        });
    });
});
