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

const DEFAULT_NORMALIZED_CONFIG = {
  normalizedConfig: {
    rag_retrieval_loop_enabled: true,
    rag_loop_rollout_mode: 'apply',
    rag_loop_trace_enabled: false,
    rag_loop_trace_max_events: 50,
    rag_loop_trace_max_bytes: 32768,
    rag_conflict_top_n: 5,
    rag_loop_candidate_limit: 25,
    rag_loop_retry_backoff_ms: 75,
    policy_recheck_metadata_timeout_ms: 2000,
    rag_loop_auto_fallback_enabled: false,
    rag_loop_auto_recover_enabled: false,
    rag_alias_expansion_enabled: false,
    rag_alias_max_terms: 5,
    rag_alias_min_token_length: 3,
    policy_recheck_identifier_caps: {}
  },
  warnings: []
};

const mockDb = { query: jest.fn() };

const mockPolicyEngine = {};

const mockClassificationAiService = { aiClassify: jest.fn() };

const ragLoopMetricsCollector = {
  shouldAttemptAutoRecover: jest.fn().mockReturnValue({ shouldRecover: false }),
  evaluateAutoFallback: jest.fn().mockReturnValue({
    shouldFallback: false,
    shouldPersistBreachCount: false,
    breachDetected: false,
    nextBreachCount: 0,
    thresholds: {},
    observedMetrics: {},
    breachReasonCodes: []
  })
};

const mockRagLoopResilienceManager = {};

const enrichWithTMDB = jest.fn();
const mergeMetadataForRecheck = jest.fn();
const classificationMetadataService = {
  enrichWithTMDB,
  mergeMetadataForRecheck,
};

const resolveRagLoopTimeout = jest.fn().mockReturnValue(10000);
const withTimeout = jest.fn(async (fn) => fn());
const sleep = jest.fn().mockResolvedValue(undefined);
const isAiTransientAvailabilityError = jest.fn().mockReturnValue(false);
const withRetryableDbConflict = jest.fn(async (operation) => operation());
const classificationUtilsService = {
  resolveRagLoopTimeout,
  withTimeout,
  sleep,
  isAiTransientAvailabilityError,
  withRetryableDbConflict,
};

const ragRetriever = {
  semanticSearch: jest.fn(),
  semanticSearchCandidates: jest.fn(),
  hybridSearch: jest.fn(),
  getSuggestedLibrary: jest.fn(),
};

const ragLoopHelpers = {
  RAG_LOOP_FALLBACK_ACTIONS: {},
  RAG_LOOP_REASON_CODES: {},
  applyOrShadowDecision: jest.fn(),
  buildRagLoopTrace: jest.fn().mockReturnValue(null),
  comparePassResults: jest.fn(),
  detectRagConflict: jest.fn(),
  evaluatePolicyRecheckGate: jest.fn(),
  expandRetrievalMetadata: jest.fn(),
  extractVerifiableEvidence: jest.fn(),
  getRecheckEligibility: jest.fn(),
  getMetadataCompleteness: jest.fn(),
  isAiRerunEligible: jest.fn(),
  isLearningEligible: jest.fn(),
  isMetadataEnrichmentEligible: jest.fn(),
  resolvePolicyContextOrFallback: jest.fn().mockReturnValue({}),
  resolveConflictDecision: jest.fn(),
  selectRetryStrategy: jest.fn(),
  shouldTriggerSecondPass: jest.fn().mockReturnValue({ trigger: null }),
  summarizePassDiagnostics: jest.fn().mockReturnValue({}),
};

const mockRagLogger = {
  logStageEvent: jest.fn(),
  logOperation: jest.fn()
};

const mockValidateAndNormalizeRagLoopConfig = jest.fn().mockReturnValue(DEFAULT_NORMALIZED_CONFIG);
const mockRagLoopConfig = { validateAndNormalizeRagLoopConfig: mockValidateAndNormalizeRagLoopConfig };

const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
};

const ragErrorHandler = {
  mapSecondPassError: jest.fn().mockReturnValue({ reasonCode: null, sqlState: null, recoverable: true })
};

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.mock('../services/policyEngine', () => mockPolicyEngine);
jest.unstable_mockModule('../services/policyEngine', () => ({ ...mockPolicyEngine, default: mockPolicyEngine }));
jest.unstable_mockModule('../services/policyEngine.mjs', () => ({ ...mockPolicyEngine, default: mockPolicyEngine }));

jest.mock('../services/classificationAiService', () => mockClassificationAiService);
jest.unstable_mockModule('../services/classificationAiService', () => ({ ...mockClassificationAiService, default: mockClassificationAiService }));
jest.unstable_mockModule('../services/classificationAiService.mjs', () => ({ ...mockClassificationAiService, default: mockClassificationAiService }));

jest.mock('../services/ragLoopResilienceManager', () => mockRagLoopResilienceManager);
jest.unstable_mockModule('../services/ragLoopResilienceManager', () => ({ ...mockRagLoopResilienceManager, default: mockRagLoopResilienceManager }));
jest.unstable_mockModule('../services/ragLoopResilienceManager.mjs', () => ({ ...mockRagLoopResilienceManager, default: mockRagLoopResilienceManager }));

jest.mock('../services/classificationMetadataService', () => classificationMetadataService);
jest.unstable_mockModule('../services/classificationMetadataService', () => ({ ...classificationMetadataService, default: classificationMetadataService }));
jest.unstable_mockModule('../services/classificationMetadataService.mjs', () => ({ ...classificationMetadataService, default: classificationMetadataService }));

jest.mock('../services/classificationUtilsService', () => classificationUtilsService);
jest.unstable_mockModule('../services/classificationUtilsService', () => ({ ...classificationUtilsService, default: classificationUtilsService }));
jest.unstable_mockModule('../services/classificationUtilsService.mjs', () => ({ ...classificationUtilsService, default: classificationUtilsService }));

jest.mock('../services/ragRetriever', () => ragRetriever);
jest.unstable_mockModule('../services/ragRetriever', () => ({ ...ragRetriever, default: ragRetriever }));
jest.unstable_mockModule('../services/ragRetriever.mjs', () => ({ ...ragRetriever, default: ragRetriever }));

jest.mock('../services/ragLoopMetricsCollector', () => ragLoopMetricsCollector);
jest.unstable_mockModule('../services/ragLoopMetricsCollector', () => ({ ...ragLoopMetricsCollector, default: ragLoopMetricsCollector }));
jest.unstable_mockModule('../services/ragLoopMetricsCollector.mjs', () => ({ ...ragLoopMetricsCollector, default: ragLoopMetricsCollector }));

jest.mock('../utils/ragLoopHelpers', () => ragLoopHelpers);
jest.unstable_mockModule('../utils/ragLoopHelpers', () => ({ ...ragLoopHelpers, default: ragLoopHelpers }));
jest.unstable_mockModule('../utils/ragLoopHelpers.mjs', () => ({ ...ragLoopHelpers, default: ragLoopHelpers }));

jest.mock('../utils/ragLogger', () => mockRagLogger);
jest.unstable_mockModule('../utils/ragLogger', () => ({ ...mockRagLogger, default: mockRagLogger }));
jest.unstable_mockModule('../utils/ragLogger.mjs', () => ({ ...mockRagLogger, default: mockRagLogger }));

jest.mock('../utils/ragLoopConfig', () => mockRagLoopConfig);
jest.unstable_mockModule('../utils/ragLoopConfig', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

jest.mock('../utils/logger', () => mockLogger);
jest.unstable_mockModule('../utils/logger', () => ({ ...mockLogger, default: mockLogger }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const db = mockDb;
const { validateAndNormalizeRagLoopConfig } = mockRagLoopConfig;

let classificationRagLoopService;

beforeAll(async () => {
  ({ default: classificationRagLoopService } = await import('../services/classificationRagLoopService.mjs'));
});

beforeEach(() => {
  // Use mockReset (not clearAllMocks) so that mockResolvedValueOnce queues are
  // flushed before each test (codeHealth rule: no clearAllMocks + mock setup combo).
  db.query.mockReset();
  validateAndNormalizeRagLoopConfig.mockReset();
  validateAndNormalizeRagLoopConfig.mockReturnValue(DEFAULT_NORMALIZED_CONFIG);
  ragErrorHandler.mapSecondPassError.mockReset();
  ragErrorHandler.mapSecondPassError.mockReturnValue({ reasonCode: null, sqlState: null, recoverable: true });
  classificationRagLoopService.loadRagErrorHandler = jest.fn().mockResolvedValue(ragErrorHandler);
});

// ---------------------------------------------------------------------------
// getCurrentAppVersion
// ---------------------------------------------------------------------------

describe('getCurrentAppVersion', () => {
  test('returns process.env.APP_VERSION when set', () => {
    process.env.APP_VERSION = '2.99.0';
    expect(classificationRagLoopService.getCurrentAppVersion()).toBe('2.99.0');
    delete process.env.APP_VERSION;
  });

  test('returns a non-empty string when env var is absent (falls back to package.json or unknown)', () => {
    delete process.env.APP_VERSION;
    const version = classificationRagLoopService.getCurrentAppVersion();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getCurrentImageTag
// ---------------------------------------------------------------------------

describe('getCurrentImageTag', () => {
  afterEach(() => {
    delete process.env.IMAGE_TAG;
    delete process.env.DOCKER_IMAGE_TAG;
  });

  test('returns process.env.IMAGE_TAG when set', () => {
    process.env.IMAGE_TAG = 'v1.2.3-alpine';
    expect(classificationRagLoopService.getCurrentImageTag()).toBe('v1.2.3-alpine');
  });

  test('returns process.env.DOCKER_IMAGE_TAG as fallback', () => {
    delete process.env.IMAGE_TAG;
    process.env.DOCKER_IMAGE_TAG = 'ghcr.io/classifarr:latest';
    expect(classificationRagLoopService.getCurrentImageTag()).toBe('ghcr.io/classifarr:latest');
  });

  test('returns null when neither env var is set', () => {
    expect(classificationRagLoopService.getCurrentImageTag()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAutoFallbackIncidentPayload
// ---------------------------------------------------------------------------

describe('buildAutoFallbackIncidentPayload', () => {
  const baseInput = {
    incidentId: 'test-incident-1',
    triggeredAt: '2025-01-01T00:00:00.000Z',
    evaluation: {
      thresholds: { cooldown_ms: 3600000, min_error_rate: 0.1 },
      observedMetrics: { error_rate: 0.25, total_samples: 100 },
      breachReasonCodes: ['rag_timeout', 'rag_pass2_failed']
    },
    previousMode: 'apply',
    nextMode: 'shadow',
    currentVersion: '2.0.0',
    imageTag: 'v2.0.0-alpine',
    diagnostics: {
      topReasonCodes: [{ reason_code: 'rag_timeout', count: 3 }],
      recentCorrelationIds: ['corr-abc', 'corr-def']
    },
    stateSnapshot: {
      autoFallbackEnabled: true,
      autoRecoverEnabled: false,
      cooldownUntil: null
    }
  };

  test('maps all fields to correct incident shape', () => {
    const payload = classificationRagLoopService.buildAutoFallbackIncidentPayload(baseInput);

    expect(payload.incident_id).toBe('test-incident-1');
    expect(payload.triggered_at).toBe('2025-01-01T00:00:00.000Z');
    expect(payload.from_mode).toBe('apply');
    expect(payload.to_mode).toBe('shadow');
    expect(payload.app_version).toBe('2.0.0');
    expect(payload.image_tag).toBe('v2.0.0-alpine');
    expect(payload.redaction_version).toBe(1);
  });

  test('embeds thresholds and observed_metrics', () => {
    const payload = classificationRagLoopService.buildAutoFallbackIncidentPayload(baseInput);
    expect(payload.thresholds).toEqual(baseInput.evaluation.thresholds);
    expect(payload.observed_metrics.error_rate).toBe(0.25);
    expect(payload.observed_metrics.consecutive_breach_reason_codes).toEqual(['rag_timeout', 'rag_pass2_failed']);
  });

  test('embeds diagnostics', () => {
    const payload = classificationRagLoopService.buildAutoFallbackIncidentPayload(baseInput);
    expect(payload.top_reason_codes).toEqual([{ reason_code: 'rag_timeout', count: 3 }]);
    expect(payload.recent_correlation_ids).toEqual(['corr-abc', 'corr-def']);
  });

  test('fallback_state reflects stateSnapshot', () => {
    const payload = classificationRagLoopService.buildAutoFallbackIncidentPayload(baseInput);
    expect(payload.fallback_state).toEqual({
      auto_fallback_enabled: true,
      auto_recover_enabled: false,
      cooldown_until: null
    });
  });

  test('image_tag is null when not provided', () => {
    const payload = classificationRagLoopService.buildAutoFallbackIncidentPayload({
      ...baseInput,
      imageTag: undefined
    });
    expect(payload.image_tag).toBeNull();
  });

  test('includes node_version string', () => {
    const payload = classificationRagLoopService.buildAutoFallbackIncidentPayload(baseInput);
    expect(typeof payload.node_version).toBe('string');
    expect(payload.node_version).toMatch(/^v\d+\./);
  });
});

// ---------------------------------------------------------------------------
// getRecentFallbackDiagnostics
// ---------------------------------------------------------------------------

describe('getRecentFallbackDiagnostics', () => {
  test('aggregates reason codes and collects unique correlation ids', async () => {
    db.query.mockResolvedValue({
      rows: [
        { reason_code: 'rag_timeout', correlation_id: 'corr-1' },
        { reason_code: 'rag_timeout', correlation_id: 'corr-2' },
        { reason_code: 'rag_pass2_failed', correlation_id: 'corr-1' },  // duplicate corr id
        { reason_code: null, correlation_id: 'corr-3' }
      ]
    });

    const result = await classificationRagLoopService.getRecentFallbackDiagnostics();
    expect(result.topReasonCodes).toEqual([
      { reason_code: 'rag_timeout', count: 2 },
      { reason_code: 'rag_pass2_failed', count: 1 }
    ]);
    expect(result.recentCorrelationIds).toEqual(['corr-1', 'corr-2', 'corr-3']);
  });

  test('returns empty arrays on db error', async () => {
    db.query.mockRejectedValue(new Error('db down'));
    const result = await classificationRagLoopService.getRecentFallbackDiagnostics();
    expect(result.topReasonCodes).toEqual([]);
    expect(result.recentCorrelationIds).toEqual([]);
  });

  test('falls back to default 20 when given 0 (falsy Number coercion)', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationRagLoopService.getRecentFallbackDiagnostics(0);
    // Number(0) || 20 === 20 because 0 is falsy
    expect(db.query.mock.calls[0][1][0]).toBe(20);
  });

  test('clamps limit to 200 when given 999', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationRagLoopService.getRecentFallbackDiagnostics(999);
    expect(db.query.mock.calls[0][1][0]).toBe(200);
  });

  test('uses default limit 20 when not provided', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationRagLoopService.getRecentFallbackDiagnostics();
    expect(db.query.mock.calls[0][1][0]).toBe(20);
  });

  test('returns at most 10 top reason codes', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      reason_code: `code_${i}`,
      correlation_id: null
    }));
    db.query.mockResolvedValue({ rows });
    const result = await classificationRagLoopService.getRecentFallbackDiagnostics();
    expect(result.topReasonCodes.length).toBeLessThanOrEqual(10);
  });

  test('returns at most 10 recent correlation ids', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      reason_code: null,
      correlation_id: `corr-${i}`
    }));
    db.query.mockResolvedValue({ rows });
    const result = await classificationRagLoopService.getRecentFallbackDiagnostics();
    expect(result.recentCorrelationIds.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// persistAutoFallbackBreachCount
// ---------------------------------------------------------------------------

describe('persistAutoFallbackBreachCount', () => {
  test('calls UPDATE on ai_provider_config with nextBreachCount', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationRagLoopService.persistAutoFallbackBreachCount({
      nextBreachCount: 3,
      breachDetected: true
    });

    const call = db.query.mock.calls[0];
    expect(call[0]).toMatch(/UPDATE ai_provider_config/);
    expect(call[1][0]).toBe(3);
    expect(call[1][1]).toBe(true);
  });

  test('passes false for breachDetected when not breaching', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationRagLoopService.persistAutoFallbackBreachCount({
      nextBreachCount: 1,
      breachDetected: false
    });
    expect(db.query.mock.calls[0][1][1]).toBe(false);
  });

  test('does not throw on db error', async () => {
    db.query.mockRejectedValue(new Error('db crash'));
    await expect(
      classificationRagLoopService.persistAutoFallbackBreachCount({ nextBreachCount: 0, breachDetected: false })
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getRagLoopConfig
// ---------------------------------------------------------------------------

describe('getRagLoopConfig', () => {
  test('returns normalized config augmented with auto-fallback state fields', async () => {
    db.query.mockResolvedValue({
      rows: [{
        rag_loop_auto_fallback_breach_count: 2,
        rag_loop_auto_fallback_last_breach_at: '2025-01-01T00:00:00.000Z',
        rag_loop_auto_fallback_last_triggered_at: '2025-01-01T01:00:00.000Z',
        rag_loop_auto_fallback_cooldown_until: null,
        rag_loop_auto_fallback_last_incident_id: 'inc-001',
        rag_loop_auto_fallback_last_incident_payload: '{}',
        rag_loop_auto_fallback_last_version: '1.9.0',
        rag_loop_auto_recover_last_attempt_version: null,
        rag_loop_auto_recover_last_attempt_at: null
      }]
    });

    const config = await classificationRagLoopService.getRagLoopConfig();
    expect(config.rag_retrieval_loop_enabled).toBe(true);
    expect(config.rag_loop_auto_fallback_breach_count).toBe(2);
    expect(config.rag_loop_auto_fallback_last_breach_at).toBe('2025-01-01T00:00:00.000Z');
    expect(config.rag_loop_auto_fallback_last_incident_id).toBe('inc-001');
    expect(config.rag_loop_auto_fallback_last_version).toBe('1.9.0');
    expect(config.rag_loop_auto_recover_last_attempt_version).toBeNull();
  });

  test('returns safe defaults when db throws', async () => {
    db.query.mockRejectedValue(new Error('connection refused'));
    const config = await classificationRagLoopService.getRagLoopConfig();
    expect(typeof config.rag_retrieval_loop_enabled).toBe('boolean');
    expect(config.rag_loop_auto_fallback_breach_count).toBe(0);
    expect(config.rag_loop_auto_fallback_last_breach_at).toBeNull();
    expect(config.rag_loop_auto_fallback_last_incident_id).toBeNull();
  });

  test('returns 0 breach_count when row has no breach count field', async () => {
    db.query.mockResolvedValue({ rows: [{}] });
    const config = await classificationRagLoopService.getRagLoopConfig();
    expect(config.rag_loop_auto_fallback_breach_count).toBe(0);
  });

  test('returns safe defaults when db returns empty rows', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const config = await classificationRagLoopService.getRagLoopConfig();
    expect(config.rag_loop_auto_fallback_breach_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildFreshSecondPassBaseResult
// ---------------------------------------------------------------------------

describe('buildFreshSecondPassBaseResult', () => {
  test('strips needs_clarification, clarification, policy_question, pending_reason', () => {
    const baseline = {
      library: { id: 1, name: 'Movies' },
      confidence: 80,
      method: 'ai_analysis',
      needs_clarification: true,
      clarification: { prompt: 'Confirm genre' },
      policy_question: { question: 'Anime?' },
      pending_reason: 'Waiting for user'
    };

    const fresh = classificationRagLoopService.buildFreshSecondPassBaseResult(baseline);
    expect(fresh.needs_clarification).toBe(false);
    expect(fresh.clarification).toBeNull();
    expect(fresh.policy_question).toBeNull();
    expect(fresh.pending_reason).toBeNull();
  });

  test('preserves other baselineResult fields', () => {
    const baseline = {
      library: { id: 1, name: 'Movies' },
      confidence: 80,
      method: 'ai_analysis',
      reason: 'Strong match',
      custom_field: 'preserved'
    };

    const fresh = classificationRagLoopService.buildFreshSecondPassBaseResult(baseline);
    expect(fresh.library).toEqual(baseline.library);
    expect(fresh.confidence).toBe(80);
    expect(fresh.method).toBe('ai_analysis');
    expect(fresh.reason).toBe('Strong match');
    expect(fresh.custom_field).toBe('preserved');
  });

  test('works with empty input', () => {
    const fresh = classificationRagLoopService.buildFreshSecondPassBaseResult({});
    expect(fresh.needs_clarification).toBe(false);
    expect(fresh.clarification).toBeNull();
    expect(fresh.policy_question).toBeNull();
    expect(fresh.pending_reason).toBeNull();
  });

  test('works with no argument (default parameter)', () => {
    const fresh = classificationRagLoopService.buildFreshSecondPassBaseResult();
    expect(fresh.needs_clarification).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildPolicyRecheckCandidate
// ---------------------------------------------------------------------------

describe('buildPolicyRecheckCandidate', () => {
  const libraries = [
    { id: 1, name: 'Movies' },
    { id: 2, name: 'Anime' }
  ];

  const baselineResult = {
    library: { id: 1, name: 'Movies' },
    confidence: 70,
    method: 'ai_analysis',
    needs_clarification: true,
    policy_question: { question: 'Is this anime?' }
  };

  test('sets method to policy_auto when action is auto_classify', () => {
    const policyResult = {
      action: 'auto_classify',
      library: { library_id: 2 },
      confidence: 85
    };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult,
      libraries,
      policyResult,
      ragContext: null,
      adoptionReason: null
    });
    expect(candidate.method).toBe('policy_auto');
  });

  test('sets method to policy_recheck for other actions', () => {
    const policyResult = { action: 'route', library: { library_id: 1 }, confidence: 80 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.method).toBe('policy_recheck');
  });

  test('sets needs_clarification true for prompt_confirm action', () => {
    const policyResult = { action: 'prompt_confirm', library: { library_id: 1 }, confidence: 60 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.needs_clarification).toBe(true);
  });

  test('sets needs_clarification true for prompt_select action', () => {
    const policyResult = { action: 'prompt_select', library: { library_id: 1 }, confidence: 55 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.needs_clarification).toBe(true);
  });

  test('sets needs_clarification false for non-prompt actions', () => {
    const policyResult = { action: 'route', library: { library_id: 1 }, confidence: 80 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.needs_clarification).toBe(false);
  });

  test('picks library by policyResult.library.library_id', () => {
    const policyResult = { action: 'route', library: { library_id: 2 }, confidence: 80 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.library).toEqual({ id: 2, name: 'Anime' });
  });

  test('takes max of baseline and policy confidence', () => {
    const policyResult = { action: 'route', library: { library_id: 1 }, confidence: 90 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.confidence).toBe(90);
  });

  test('uses baseline confidence when it is higher', () => {
    const policyResult = { action: 'route', library: { library_id: 1 }, confidence: 50 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.confidence).toBe(70);
  });

  test('uses adoptionReason as reason when provided', () => {
    const policyResult = { action: 'route', library: { library_id: 1 }, confidence: 80 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: 'pattern match'
    });
    expect(candidate.reason).toBe('pattern match');
  });

  test('strips clarification fields from baseline via buildFreshSecondPassBaseResult', () => {
    const policyResult = { action: 'route', library: { library_id: 1 }, confidence: 80 };
    const candidate = classificationRagLoopService.buildPolicyRecheckCandidate({
      baselineResult, libraries, policyResult, ragContext: null, adoptionReason: null
    });
    expect(candidate.policy_question).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAiRerunCandidate
// ---------------------------------------------------------------------------

describe('buildAiRerunCandidate', () => {
  const libraries = [{ id: 1, name: 'Movies' }];
  const baselineResult = {
    library: { id: 1, name: 'Movies' },
    confidence: 70,
    method: 'ai_analysis'
  };

  const aiRerunMatch = {
    library: { id: 1, name: 'Movies' },
    confidence: 88,
    reason: 'Consistent second AI read',
    verified_by_ai: true
  };

  test('sets method to ai_verified when verified_by_ai is true', () => {
    const candidate = classificationRagLoopService.buildAiRerunCandidate({
      baselineResult,
      aiRerunMatch,
      libraries,
      signalContext: null,
      policyResult: null,
      ragContext: null
    });
    expect(candidate.method).toBe('ai_verified');
  });

  test('sets method to ai_rerun when verified_by_ai is false', () => {
    const candidate = classificationRagLoopService.buildAiRerunCandidate({
      baselineResult,
      aiRerunMatch: { ...aiRerunMatch, verified_by_ai: false },
      libraries,
      signalContext: null,
      policyResult: null,
      ragContext: null
    });
    expect(candidate.method).toBe('ai_rerun');
  });

  test('spreads aiRerunMatch fields into result', () => {
    const candidate = classificationRagLoopService.buildAiRerunCandidate({
      baselineResult,
      aiRerunMatch,
      libraries,
      signalContext: null,
      policyResult: null,
      ragContext: null
    });
    expect(candidate.confidence).toBe(88);
    expect(candidate.reason).toBe('Consistent second AI read');
  });

  test('clears clarification fields from baselineResult', () => {
    const dirtyBaseline = {
      ...baselineResult,
      needs_clarification: true,
      clarification: { prompt: 'Confirm' },
      policy_question: { question: 'Genre?' },
      pending_reason: 'Waiting'
    };
    const candidate = classificationRagLoopService.buildAiRerunCandidate({
      baselineResult: dirtyBaseline,
      aiRerunMatch,
      libraries,
      signalContext: null,
      policyResult: null,
      ragContext: null
    });
    expect(candidate.needs_clarification).toBe(false);
    expect(candidate.clarification).toBeNull();
    expect(candidate.policy_question).toBeNull();
    expect(candidate.pending_reason).toBeNull();
  });

  test('inherits libraries from baselineResult when available', () => {
    const baseWithLibraries = { ...baselineResult, libraries };
    const candidate = classificationRagLoopService.buildAiRerunCandidate({
      baselineResult: baseWithLibraries,
      aiRerunMatch,
      libraries: [{ id: 99, name: 'Other' }],
      signalContext: null,
      policyResult: null,
      ragContext: null
    });
    expect(candidate.libraries).toEqual(libraries);
  });

  test('uses passed libraries when baselineResult has no libraries', () => {
    const candidate = classificationRagLoopService.buildAiRerunCandidate({
      baselineResult,
      aiRerunMatch,
      libraries,
      signalContext: null,
      policyResult: null,
      ragContext: null
    });
    expect(candidate.libraries).toEqual(libraries);
  });
});
