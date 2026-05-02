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

// ── Heavy dependencies that classification.js pulls in on require ────────────
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../services/tmdb');
jest.mock('../services/ollama');
jest.mock('../services/radarr');
jest.mock('../services/sonarr');
jest.mock('../services/discordBot');
jest.mock('../services/tavily');
jest.mock('../services/mediaSync');
jest.mock('../services/contentTypeAnalyzer');
jest.mock('../services/clarificationService');
jest.mock('../services/classificationPhaseService');
jest.mock('../services/classificationRetryService');
jest.mock('../services/classificationOutcomeService');
jest.mock('../services/aiRouter');
jest.mock('../services/signalCollector', () => ({
    SignalCollector: jest.fn().mockImplementation(() => ({
        collectAll: jest.fn(),
        getSignals: jest.fn().mockReturnValue([]),
        getPatternSignals: jest.fn().mockReturnValue([]),
        hasSignal: jest.fn().mockReturnValue(false),
        addSignal: jest.fn()
    })),
    SIGNAL_TYPES: {}
}));
jest.mock('../services/confidenceCalculator');
jest.mock('../services/ragRetriever');
jest.mock('../services/embeddingService');
jest.mock('../services/classificationEvidenceReinforcementService');
jest.mock('../services/policyEngine');
jest.mock('../services/policyQuestionBuilder', () => ({ build: jest.fn() }));
jest.mock('../services/classificationEvidenceService');
jest.mock('../services/providerLock');
jest.mock('../services/libraryProfileService');
jest.mock('../services/aiPromptBuilder');
jest.mock('../services/aiResponseParser');
jest.mock('../utils/ragLogger', () => ({ logStageEvent: jest.fn(), logOperation: jest.fn() }));
jest.mock('../utils/metadataNormalization', () => ({
    normalizeMetadataList: jest.fn().mockReturnValue([]),
    normalizeMetadataListLower: jest.fn().mockReturnValue([])
}));
jest.mock('../services/ragLoopMetricsCollector', () => ({
    recordEvaluation: jest.fn(),
    shouldAttemptAutoRecover: jest.fn().mockReturnValue({ shouldRecover: false }),
    evaluateAutoFallback: jest.fn().mockReturnValue({
        shouldFallback: false, shouldPersistBreachCount: false,
        breachDetected: false, nextBreachCount: 0,
        thresholds: {}, observedMetrics: {}, breachReasonCodes: []
    })
}));
jest.mock('../services/ragLoopResilienceManager', () => ({
    canRun: jest.fn().mockReturnValue({ allowed: true }),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    reset: jest.fn()
}));
jest.mock('../utils/ragLoopConfig', () => ({
    validateAndNormalizeRagLoopConfig: jest.fn().mockReturnValue({ normalizedConfig: {}, warnings: [] })
}));
jest.mock('../utils/ragLoopHelpers', () => ({
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
}));
jest.mock('../utils/operationController', () => ({
    OperationController: jest.fn().mockImplementation(() => ({ run: jest.fn() }))
}));
jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

// ── The six sub-services whose delegations we are testing ────────────────────
jest.mock('../services/classificationRagLoopService');
jest.mock('../services/classificationMetadataService');
jest.mock('../services/classificationUtilsService');
jest.mock('../services/classificationAiService');
jest.mock('../services/classificationPersistenceService');
jest.mock('../services/classificationRoutingService');

const classificationService              = require('../services/classification');
const classificationRagLoopService       = require('../services/classificationRagLoopService');
const classificationMetadataService      = require('../services/classificationMetadataService');
const classificationUtilsService         = require('../services/classificationUtilsService');
const classificationAiService            = require('../services/classificationAiService');
const classificationPersistenceService   = require('../services/classificationPersistenceService');
const classificationRoutingService       = require('../services/classificationRoutingService');

// ── Helpers ──────────────────────────────────────────────────────────────────

const SENTINEL = Object.freeze({ __sentinel: true });

/** Returns the auto-mocked jest.fn() for a given service + method. */
function impl(service, method) {
    if (typeof service[method] !== 'function') {
        throw new Error(`No auto-mock found for ${method} — check jest.mock() setup`);
    }
    return service[method];
}

/** Assert wrapper delegates and returns the same value. */
async function assertDelegates(wrapperFn, targetFn, ...args) {
    targetFn.mockResolvedValue(SENTINEL);
    const result = await wrapperFn(...args);
    expect(targetFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(SENTINEL);
}

/** Assert synchronous wrapper delegates and returns the same value. */
function assertDelegatesSync(wrapperFn, targetFn, ...args) {
    targetFn.mockReturnValue(SENTINEL);
    const result = wrapperFn(...args);
    expect(targetFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(SENTINEL);
}

// ── Tests ────────────────────────────────────────────────────────────────────

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
