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
import { createNamedMockModule, createLoggerModuleMock, createServiceStubs } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockEmbeddingService = createServiceStubs(['generateAndStore', 'isProviderBusyError'], {
  isProviderBusyError: jest.fn().mockReturnValue(false),
});
const mockClassificationOutcomeService = createServiceStubs(['recordOutcome']);
const mockContentTypeAnalyzer = createServiceStubs(['analyze']);
const mockRagLogger = createServiceStubs(['logStageEvent', 'logOperation']);
const mockRagGraphExtractor = createServiceStubs(['extract'], {
  extract: jest.fn().mockReturnValue({
    director_name: null,
    primary_studio_name: null,
    genre_names: [],
    cast_ids: [],
    cast_names: [],
  }),
});
const mockLibraryProfileService = createServiceStubs(['getProfileStats']);

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/embeddingService.mjs', () => createNamedMockModule('embeddingService', mockEmbeddingService));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => createNamedMockModule('classificationOutcomeService', mockClassificationOutcomeService));

jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => createNamedMockModule('contentTypeAnalyzer', mockContentTypeAnalyzer));

jest.unstable_mockModule('../utils/ragLogger.mjs', () => createNamedMockModule('ragLogger', mockRagLogger));

jest.unstable_mockModule('../services/ragGraphExtractor.mjs', () => createNamedMockModule('ragGraphExtractor', mockRagGraphExtractor));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => createNamedMockModule('libraryProfileService', mockLibraryProfileService));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const db = mockDb;
const embeddingService = mockEmbeddingService;
const classificationOutcomeService = mockClassificationOutcomeService;
const ragLogger = mockRagLogger;
const libraryProfileService = mockLibraryProfileService;

const { classificationPersistenceService } = await import('../services/classificationPersistenceService.mjs');
const policyQuestionContext = {
  extractQuestionContext: jest.fn().mockReturnValue({}),
  getPolicyQuestionContextVersion: jest.fn().mockResolvedValue(1),
  stampPolicyQuestionContext: jest.fn((parsed, _version, _ctx) => ({ ...parsed, _context_version: 1 })),
};
const ragErrorHandler = {
  mapSecondPassError: jest.fn().mockReturnValue({ reasonCode: null, sqlState: null, recoverable: true }),
};

beforeEach(() => {
  jest.clearAllMocks();
  policyQuestionContext.extractQuestionContext.mockReset();
  policyQuestionContext.extractQuestionContext.mockReturnValue({});
  policyQuestionContext.getPolicyQuestionContextVersion.mockReset();
  policyQuestionContext.getPolicyQuestionContextVersion.mockResolvedValue(1);
  policyQuestionContext.stampPolicyQuestionContext.mockReset();
  policyQuestionContext.stampPolicyQuestionContext.mockImplementation((parsed, _version, _ctx) => ({ ...parsed, _context_version: 1 }));
  classificationPersistenceService.policyQuestionContext = policyQuestionContext;
  ragErrorHandler.mapSecondPassError.mockReset();
  ragErrorHandler.mapSecondPassError.mockReturnValue({ reasonCode: null, sqlState: null, recoverable: true });
  classificationPersistenceService.ragErrorHandler = ragErrorHandler;
});

describe('isRealtimeEmbeddingEnabled', () => {
  test('returns true when db row has realtime_embedding_enabled = true', async () => {
    db.query.mockResolvedValue({ rows: [{ realtime_embedding_enabled: true }] });
    expect(await classificationPersistenceService.isRealtimeEmbeddingEnabled()).toBe(true);
  });

  test('returns false when db row has realtime_embedding_enabled = false', async () => {
    db.query.mockResolvedValue({ rows: [{ realtime_embedding_enabled: false }] });
    expect(await classificationPersistenceService.isRealtimeEmbeddingEnabled()).toBe(false);
  });

  test('returns true when no rows found (defaults to enabled)', async () => {
    db.query.mockResolvedValue({ rows: [] });
    expect(await classificationPersistenceService.isRealtimeEmbeddingEnabled()).toBe(true);
  });

  test('returns true when db throws (fail-open default)', async () => {
    db.query.mockRejectedValue(new Error('column not found'));
    expect(await classificationPersistenceService.isRealtimeEmbeddingEnabled()).toBe(true);
  });
});

describe('normalizePolicyQuestion', () => {
  test('returns null for null/undefined input', async () => {
    expect(await classificationPersistenceService.normalizePolicyQuestion(null)).toBeNull();
    expect(await classificationPersistenceService.normalizePolicyQuestion(undefined)).toBeNull();
    expect(await classificationPersistenceService.normalizePolicyQuestion('')).toBeNull();
  });

  test('returns null for non-JSON plain strings', async () => {
    expect(await classificationPersistenceService.normalizePolicyQuestion('just a string')).toBeNull();
    expect(await classificationPersistenceService.normalizePolicyQuestion('123')).toBeNull();
  });

  test('returns null for invalid JSON string', async () => {
    expect(await classificationPersistenceService.normalizePolicyQuestion('{bad json')).toBeNull();
  });

  test('parses valid JSON string and returns stamped serialized result', async () => {
    const input = JSON.stringify({ question: 'Is this anime?', options: ['yes', 'no'] });
    const result = await classificationPersistenceService.normalizePolicyQuestion(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('question', 'Is this anime?');
    expect(policyQuestionContext.stampPolicyQuestionContext).toHaveBeenCalled();
  });

  test('accepts an object directly', async () => {
    const input = { question: 'Genre?', options: ['drama', 'action'] };
    const result = await classificationPersistenceService.normalizePolicyQuestion(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('question', 'Genre?');
  });

  test('returns stamped JSON string with _context_version attached', async () => {
    const input = { question: 'Is this anime?' };
    const result = await classificationPersistenceService.normalizePolicyQuestion(input);
    const parsed = JSON.parse(result);
    expect(parsed._context_version).toBe(1);
  });

  test('returns stringified result even when stamp throws (graceful fallback)', async () => {
    policyQuestionContext.stampPolicyQuestionContext.mockImplementationOnce(() => {
      throw new Error('stamp failed');
    });
    const input = { question: 'Is this anime?' };
    const result = await classificationPersistenceService.normalizePolicyQuestion(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('question', 'Is this anime?');
  });
});

describe('buildRagLoopSummary', () => {
  test('returns null when result has no trace or events', () => {
    expect(classificationPersistenceService.buildRagLoopSummary({})).toBeNull();
    expect(classificationPersistenceService.buildRagLoopSummary()).toBeNull();
  });

  test('returns null when ragLoopLogContext has empty events', () => {
    const result = { ragLoopLogContext: { events: [] } };
    expect(classificationPersistenceService.buildRagLoopSummary(result)).toBeNull();
  });

  test('builds summary from ragLoopLogContext events', () => {
    const result = {
      ragLoopLogContext: {
        mode: 'apply',
        trigger: 'policy_prompt_select',
        strategy: 'hybrid',
        correlationId: 'abc-123',
        events: [
          { stage: 'gate', outcome: 'run', reason_code: 'policy_prompt_select' },
          { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'hybrid' },
          { stage: 'ai_rerun', outcome: 'applied', reason_code: 'material_improvement' },
        ],
      },
    };

    const summary = classificationPersistenceService.buildRagLoopSummary(result);
    expect(summary).not.toBeNull();
    expect(summary.ran).toBe(true);
    expect(summary.mode).toBe('apply');
    expect(summary.trigger).toBe('policy_prompt_select');
    expect(summary.strategy).toBe('hybrid');
    expect(summary.had_error).toBe(false);
    expect(summary.stages.gate.outcome).toBe('run');
    expect(summary.stages.retrieval_pass2.outcome).toBe('applied');
    expect(summary.stages.ai_rerun.outcome).toBe('applied');
  });

  test('builds summary from ragLoopTrace when logContext absent', () => {
    const result = {
      ragLoopTrace: {
        ran: true,
        mode: 'shadow',
        trigger: 'low_confidence',
        strategy: 'semantic',
        decision: { outcome: 'pass2', reason: 'improved confidence', comparator: 'confidence_delta' },
        diagnostics: {
          pass1: { match_count: 3, top_similarity: 0.72 },
          pass2: { match_count: 5, top_similarity: 0.91 },
        },
        events: [
          { stage: 'gate', outcome: 'run', reason_code: 'low_confidence' },
          { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'semantic' },
        ],
      },
    };

    const summary = classificationPersistenceService.buildRagLoopSummary(result);
    expect(summary.ran).toBe(true);
    expect(summary.mode).toBe('shadow');
    expect(summary.decision_outcome).toBe('pass2');
    expect(summary.adopted).toBe(true);
    expect(summary.pass1_match_count).toBe(3);
    expect(summary.pass1_top_similarity).toBeCloseTo(0.72);
    expect(summary.pass2_match_count).toBe(5);
    expect(summary.pass2_top_similarity).toBeCloseTo(0.91);
  });

  test('had_error is true when any event has outcome === error', () => {
    const result = {
      ragLoopLogContext: {
        events: [
          { stage: 'gate', outcome: 'run', reason_code: 'low_confidence' },
          { stage: 'retrieval_pass2', outcome: 'error', reason_code: 'rag_pass2_failed' },
        ],
      },
    };

    const summary = classificationPersistenceService.buildRagLoopSummary(result);
    expect(summary.had_error).toBe(true);
  });

  test('adopted is false when decision_outcome is baseline', () => {
    const result = {
      ragLoopTrace: {
        ran: true,
        decision: { outcome: 'baseline', reason: 'no improvement' },
        events: [{ stage: 'gate', outcome: 'run' }],
      },
    };

    const summary = classificationPersistenceService.buildRagLoopSummary(result);
    expect(summary.adopted).toBe(false);
  });

  test('pickStageEvent skips retry events and prefers final outcome', () => {
    const result = {
      ragLoopLogContext: {
        events: [
          { stage: 'gate', outcome: 'retry', reason_code: 'rag_pass1_candidate_timeout' },
          { stage: 'gate', outcome: 'run', reason_code: 'low_confidence' },
        ],
      },
    };

    const summary = classificationPersistenceService.buildRagLoopSummary(result);
    expect(summary.stages.gate.outcome).toBe('run');
  });
});

describe('deriveClassificationPersistenceState', () => {
  test('status is completed for high-confidence result with library', async () => {
    libraryProfileService.getProfileStats.mockResolvedValue({ total: 10 });
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 85,
      method: 'ai_analysis',
      needs_clarification: false,
    };

    const state = await classificationPersistenceService.deriveClassificationPersistenceState(result);
    expect(state.status).toBe('completed');
    expect(state.libraryId).toBe(1);
    expect(state.libraryName).toBe('Movies');
    expect(state.pendingReason).toBeNull();
    expect(state.policyQuestion).toBeNull();
    expect(state.profileSnapshot).not.toBeNull();
  });

  test('status is awaiting_decision when confidence < 70', async () => {
    const result = {
      library: { id: 2, name: 'Family' },
      confidence: 55,
      method: 'ai_analysis',
      needs_clarification: false,
    };

    const state = await classificationPersistenceService.deriveClassificationPersistenceState(result);
    expect(state.status).toBe('awaiting_decision');
    expect(state.libraryId).toBeNull();
    expect(state.libraryName).toBeNull();
  });

  test('status is awaiting_decision when needs_clarification is true', async () => {
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 90,
      needs_clarification: true,
      policy_question: { question: 'Anime?' },
      reason: 'Need more info',
    };

    const state = await classificationPersistenceService.deriveClassificationPersistenceState(result);
    expect(state.status).toBe('awaiting_decision');
    expect(state.policyQuestion).not.toBeNull();
  });

  test('status is awaiting_decision when method is fallback', async () => {
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 80,
      method: 'fallback',
      needs_clarification: false,
    };

    const state = await classificationPersistenceService.deriveClassificationPersistenceState(result);
    expect(state.status).toBe('awaiting_decision');
  });

  test('status is pending_retry when needs_retry is true', async () => {
    const result = {
      library: null,
      confidence: 0,
      needs_retry: true,
      pending_reason: 'AI temporarily unavailable',
    };

    const state = await classificationPersistenceService.deriveClassificationPersistenceState(result);
    expect(state.status).toBe('pending_retry');
    expect(state.libraryId).toBeNull();
  });

  test('profileSnapshot is null when getProfileStats throws', async () => {
    libraryProfileService.getProfileStats.mockRejectedValue(new Error('db error'));
    const result = {
      library: { id: 5, name: 'Anime' },
      confidence: 88,
      needs_clarification: false,
    };

    const state = await classificationPersistenceService.deriveClassificationPersistenceState(result);
    expect(state.status).toBe('completed');
    expect(state.profileSnapshot).toBeNull();
  });

  test('profileSnapshot is null for awaiting_decision (no profile fetched)', async () => {
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 50,
      needs_clarification: false,
    };

    const state = await classificationPersistenceService.deriveClassificationPersistenceState(result);
    expect(state.status).toBe('awaiting_decision');
    expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled();
    expect(state.profileSnapshot).toBeNull();
  });
});

describe('logClassification', () => {
  const baseMetadata = {
    tmdb_id: 123,
    media_type: 'movie',
    title: 'Test Movie',
    year: 2024,
  };

  beforeEach(() => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('realtime_embedding_enabled')) {
        return Promise.resolve({ rows: [{ realtime_embedding_enabled: false }] });
      }
      if (sql.includes('INSERT INTO classification_history')) {
        return Promise.resolve({ rows: [{ id: 42 }] });
      }
      if (sql.includes('INSERT INTO app_notifications')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    libraryProfileService.getProfileStats.mockResolvedValue({ total: 5 });
  });

  test('returns the new classification id', async () => {
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 80,
      method: 'ai_analysis',
      reason: 'Matched movies library',
      needs_clarification: false,
    };

    const id = await classificationPersistenceService.logClassification(baseMetadata, result, Date.now());
    expect(id).toBe(42);
  });

  test('inserts into classification_history with correct fields', async () => {
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 85,
      method: 'ai_analysis',
      reason: 'Matched',
      needs_clarification: false,
      policyResult: {
        decisionDiagnostics: {
          requires_manual_review: true,
          reason_code: 'weak_evidence_overlap',
        },
        scores: { preset: 0, profile: 72, pattern: 0, rag: 61, history: 0 },
        weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
        candidateDiagnostics: {
          primary_viability: 'multi_source_support',
          positive_sources: { preset: null, profile: true, pattern: false, rag: true, history: false },
          drivers: ['profile_supported', 'rag_improved'],
          agreement_boosted: false,
        },
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          policy_id: 11,
          policy_name: 'Movies Policy',
          score: 85,
          candidate_diagnostics: {
            primary_viability: 'multi_source_support',
            positive_sources: { preset: null, profile: true, pattern: false, rag: true, history: false },
            drivers: ['profile_supported', 'rag_improved'],
            agreement_boosted: false,
          },
        }],
      },
      ragLoopTrace: {
        trace_version: 1,
        trace_context: {
          schema_version: 1,
          trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
          root_span_id: '00f067aa0ba902b7',
          trace_flags: '01',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
          source: 'classification_rag_loop',
        },
        retrieval_evidence: {
          schema_version: 1,
          pass1: [{ title: 'Similar Movie', library_id: 1, library_name: 'Movies', similarity: 0.82 }],
          pass2: [],
          library_counts: { pass1: [{ library_id: 1, library_name: 'Movies', count: 1, max_similarity: 0.82 }], pass2: [] },
        },
      },
    };

    await classificationPersistenceService.logClassification(baseMetadata, result);

    const insertCall = db.query.mock.calls.find(c => c[0].includes('INSERT INTO classification_history'));
    expect(insertCall).toBeDefined();
    const params = insertCall[1];
    expect(params[0]).toBe(123);
    expect(params[1]).toBe('movie');
    expect(params[2]).toBe('Test Movie');
    expect(params[6]).toBe(85);
    expect(params[7]).toBe('ai_analysis');
    expect(params[10]).toBe('completed');
    const persistedMetadata = JSON.parse(params[9]);
    expect(persistedMetadata.classification_details.candidate_diagnostics).toEqual(
      expect.objectContaining({ primary_viability: 'multi_source_support' })
    );
    expect(persistedMetadata.classification_details.decision_diagnostics).toEqual({
      requires_manual_review: true,
      reason_code: 'weak_evidence_overlap',
    });
    expect(persistedMetadata.classification_details.ranked_candidates).toEqual([
      expect.objectContaining({
        library_id: 1,
        policy_name: 'Movies Policy',
        candidate_diagnostics: expect.objectContaining({
          primary_viability: 'multi_source_support',
        }),
      }),
    ]);
    expect(persistedMetadata.classification_details.rag_evidence).toEqual(expect.objectContaining({
      schema_version: 1,
      pass1: [expect.objectContaining({ title: 'Similar Movie', library_id: 1 })],
    }));
    expect(persistedMetadata.classification_details.decision_trace).toEqual(expect.objectContaining({
      schema_version: 1,
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      root_span_id: '00f067aa0ba902b7',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sampled: true,
      source: 'classification_persistence',
      outcome: expect.objectContaining({
        status: 'completed',
        method: 'ai_analysis',
        confidence: 85,
        library_id: 1,
        library_name: 'Movies',
      }),
      stages: expect.arrayContaining([
        expect.objectContaining({ name: 'classification', outcome: 'completed' }),
        expect.objectContaining({ name: 'rag_loop' }),
      ]),
    }));
  });

  test('generates decision trace metadata when no rag loop trace exists', async () => {
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 88,
      method: 'ai_analysis',
      reason: 'Matched',
      needs_clarification: false,
    };

    await classificationPersistenceService.logClassification(baseMetadata, result);

    const insertCall = db.query.mock.calls.find(c => c[0].includes('INSERT INTO classification_history'));
    const persistedMetadata = JSON.parse(insertCall[1][9]);
    const decisionTrace = persistedMetadata.classification_details.decision_trace;

    expect(decisionTrace).toEqual(expect.objectContaining({
      schema_version: 1,
      trace_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      root_span_id: expect.stringMatching(/^[0-9a-f]{16}$/),
      traceparent: expect.stringMatching(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/),
      sampled: false,
      outcome: expect.objectContaining({
        status: 'completed',
        method: 'ai_analysis',
        library_id: 1,
      }),
      stages: expect.arrayContaining([
        expect.objectContaining({ name: 'classification', outcome: 'completed' }),
        expect.objectContaining({ name: 'rag_loop', outcome: 'not_recorded' }),
      ]),
    }));
  });

  test('creates awaiting_decision notification when status is awaiting_decision', async () => {
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 50,
      method: 'ai_analysis',
      reason: 'Low confidence',
      needs_clarification: false,
    };

    await classificationPersistenceService.logClassification(baseMetadata, result);

    const notifCall = db.query.mock.calls.find(c => c[0].includes('INSERT INTO app_notifications'));
    expect(notifCall).toBeDefined();
  });

  test('does not create notification when status is completed', async () => {
    libraryProfileService.getProfileStats.mockResolvedValue({ total: 5 });
    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 90,
      method: 'ai_analysis',
      reason: 'Strong match',
      needs_clarification: false,
    };

    await classificationPersistenceService.logClassification(baseMetadata, result);

    const notifCall = db.query.mock.calls.find(c => c[0].includes('INSERT INTO app_notifications'));
    expect(notifCall).toBeUndefined();
  });

  test('queues embedding generation via setImmediate when realtime is disabled', async () => {
    const setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation((fn) => { fn(); return { ref: jest.fn() }; });

    db.query.mockImplementation((sql) => {
      if (sql.includes('realtime_embedding_enabled')) return Promise.resolve({ rows: [{ realtime_embedding_enabled: false }] });
      if (sql.includes('INSERT INTO classification_history')) return Promise.resolve({ rows: [{ id: 10 }] });
      return Promise.resolve({ rows: [] });
    });
    libraryProfileService.getProfileStats.mockResolvedValue({ total: 5 });

    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 90,
      method: 'ai_analysis',
      needs_clarification: false,
    };

    await classificationPersistenceService.logClassification(baseMetadata, result);
    setImmediateSpy.mockRestore();
  });

  test('calls embeddingService.generateAndStore when realtime is enabled', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('realtime_embedding_enabled')) return Promise.resolve({ rows: [{ realtime_embedding_enabled: true }] });
      if (sql.includes('INSERT INTO classification_history')) return Promise.resolve({ rows: [{ id: 11 }] });
      return Promise.resolve({ rows: [] });
    });
    libraryProfileService.getProfileStats.mockResolvedValue({ total: 5 });
    embeddingService.generateAndStore.mockResolvedValue(undefined);

    const result = {
      library: { id: 1, name: 'Movies' },
      confidence: 90,
      method: 'ai_analysis',
      needs_clarification: false,
    };

    await classificationPersistenceService.logClassification(baseMetadata, result);
    expect(embeddingService.generateAndStore).toHaveBeenCalledWith(11, expect.objectContaining({ tmdb_id: 123 }));
  });
});

describe('persistRagLoopStageEvents', () => {
  test('does nothing when result has no events', async () => {
    await classificationPersistenceService.persistRagLoopStageEvents({
      classificationId: 1,
      metadata: {},
      result: {},
    });
    expect(ragLogger.logStageEvent).not.toHaveBeenCalled();
  });

  test('does nothing when events array is empty', async () => {
    await classificationPersistenceService.persistRagLoopStageEvents({
      classificationId: 1,
      metadata: {},
      result: { ragLoopLogContext: { events: [] } },
    });
    expect(ragLogger.logStageEvent).not.toHaveBeenCalled();
  });

  test('logs each event via ragLogger.logStageEvent', async () => {
    ragLogger.logStageEvent.mockResolvedValue({ logged: true });

    const result = {
      ragLoopLogContext: {
        mode: 'apply',
        strategy: 'hybrid',
        trigger: 'policy_prompt_select',
        correlationId: 'corr-1',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        events: [
          { stage: 'gate', outcome: 'run', reason_code: 'policy_prompt_select' },
          { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'hybrid' },
        ],
      },
    };

    await classificationPersistenceService.persistRagLoopStageEvents({
      classificationId: 99,
      metadata: { tmdb_id: 1, media_type: 'movie', title: 'Test' },
      result,
    });

    expect(ragLogger.logStageEvent).toHaveBeenCalledTimes(2);
    const [firstCall] = ragLogger.logStageEvent.mock.calls;
    expect(firstCall[0]).toMatchObject({
      classification_id: 99,
      stage: 'gate',
      outcome: 'run',
      rollout_mode: 'apply',
      strategy: 'hybrid',
      trigger: 'policy_prompt_select',
      correlation_id: 'corr-1',
      metadata: expect.objectContaining({
        trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
        span_id: '00f067aa0ba902b7',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }),
    });
  });

  test('remaps strategy source stage to gate', async () => {
    ragLogger.logStageEvent.mockResolvedValue({ logged: false });

    const result = {
      ragLoopLogContext: {
        events: [
          { stage: 'strategy', outcome: 'strategy_selected', reason_code: 'hybrid' },
        ],
      },
    };

    await classificationPersistenceService.persistRagLoopStageEvents({
      classificationId: 5,
      metadata: {},
      result,
    });

    expect(ragLogger.logStageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'gate', metadata: expect.objectContaining({ source_stage: 'strategy' }) }),
    );
  });

  test('emits rag metric when retrieval_pass2 applied event is logged', async () => {
    ragLogger.logStageEvent.mockResolvedValue({ logged: true });
    ragLogger.logOperation.mockResolvedValue(undefined);

    const result = {
      ragLoopLogContext: {
        events: [
          { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'hybrid' },
        ],
      },
    };

    await classificationPersistenceService.persistRagLoopStageEvents({
      classificationId: 7,
      metadata: {},
      result,
    });

    expect(ragLogger.logOperation).toHaveBeenCalledWith(
      'second_pass_retrieval_pass2',
      expect.any(Number),
      true,
      expect.any(Object),
    );
  });

  test('does not emit rag metric when logResult.logged is false', async () => {
    ragLogger.logStageEvent.mockResolvedValue({ logged: false });

    const result = {
      ragLoopLogContext: {
        events: [
          { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'hybrid' },
        ],
      },
    };

    await classificationPersistenceService.persistRagLoopStageEvents({
      classificationId: 8,
      metadata: {},
      result,
    });

    expect(ragLogger.logOperation).not.toHaveBeenCalled();
  });

  test('is fail-safe: swallows errors without throwing', async () => {
    ragLogger.logStageEvent.mockRejectedValue(new Error('db down'));

    const result = {
      ragLoopLogContext: {
        events: [{ stage: 'gate', outcome: 'run', reason_code: 'low_confidence' }],
      },
    };

    await expect(
      classificationPersistenceService.persistRagLoopStageEvents({
        classificationId: 9,
        metadata: {},
        result,
      }),
    ).resolves.not.toThrow();
  });
});

describe('rebindRetryLineage', () => {
  test('does nothing when metadata has no retry_lineage', async () => {
    await classificationPersistenceService.rebindRetryLineage(10, {});
    expect(db.query).not.toHaveBeenCalled();
  });

  test('does nothing when lineage has no valid ids', async () => {
    await classificationPersistenceService.rebindRetryLineage(10, {
      retry_lineage: { media_request_ids: [], webhook_log_ids: [], original_classification_id: null },
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('updates media_requests when media_request_ids provided', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationPersistenceService.rebindRetryLineage(42, {
      retry_lineage: {
        media_request_ids: [1, 2, 3],
        webhook_log_ids: [],
        original_classification_id: null,
      },
    });

    const updateCall = db.query.mock.calls.find(c => c[0].includes('UPDATE media_requests'));
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toEqual([42, [1, 2, 3]]);
  });

  test('updates webhook_log when webhook_log_ids provided', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationPersistenceService.rebindRetryLineage(99, {
      retry_lineage: {
        media_request_ids: [],
        webhook_log_ids: [7, 8],
        original_classification_id: null,
      },
    });

    const updateCall = db.query.mock.calls.find(c => c[0].includes('UPDATE webhook_log'));
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toEqual([99, [7, 8]]);
  });

  test('calls classificationOutcomeService.recordOutcome for original_classification_id', async () => {
    db.query.mockResolvedValue({ rows: [] });
    classificationOutcomeService.recordOutcome.mockResolvedValue({ updated: true });

    await classificationPersistenceService.rebindRetryLineage(55, {
      retry_lineage: {
        media_request_ids: [],
        webhook_log_ids: [],
        original_classification_id: 33,
      },
    });

    expect(classificationOutcomeService.recordOutcome).toHaveBeenCalledWith(33, {
      replacement_classification_id: 55,
    });
  });

  test('deduplicates media_request_ids', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationPersistenceService.rebindRetryLineage(42, {
      retry_lineage: {
        media_request_ids: [5, 5, 6],
        webhook_log_ids: [],
        original_classification_id: null,
      },
    });

    const updateCall = db.query.mock.calls.find(c => c[0].includes('UPDATE media_requests'));
    expect(updateCall[1][1]).toEqual([5, 6]);
  });

  test('ignores non-integer ids in media_request_ids', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await classificationPersistenceService.rebindRetryLineage(42, {
      retry_lineage: {
        media_request_ids: ['abc', -1, 0, 4],
        webhook_log_ids: [],
        original_classification_id: null,
      },
    });

    const updateCall = db.query.mock.calls.find(c => c[0].includes('UPDATE media_requests'));
    expect(updateCall[1][1]).toEqual([4]);
  });

  test('is fail-safe: logs error and does not throw on db failure', async () => {
    db.query.mockRejectedValue(new Error('db crash'));
    await expect(
      classificationPersistenceService.rebindRetryLineage(1, {
        retry_lineage: { media_request_ids: [1], webhook_log_ids: [], original_classification_id: null },
      }),
    ).resolves.not.toThrow();
  });
});
