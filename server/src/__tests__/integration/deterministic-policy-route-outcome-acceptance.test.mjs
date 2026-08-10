/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This acceptance suite keeps policy evaluation, routing eligibility, and
 * routing outcomes in-process. It never contacts a media server or AI provider.
 */

import { jest } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { policyEngine } = await import('../../services/policyEngine.mjs');
const { ClassificationPolicyPathService } = await import('../../services/classificationPolicyPathService.mjs');
const { ClassificationService } = await import('../../services/classificationServiceCore.mjs');
const {
  buildClassificationRoutingSummary,
} = await import('../../services/classificationResultOutcomeSummary.mjs');

function createPolicyPath(aiClassify) {
  return new ClassificationPolicyPathService({
    policyEngine,
    classificationAiService: { aiClassify },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  });
}

function createClassificationService() {
  return new ClassificationService({
    db,
    createLogger: () => ({ debug: jest.fn() }),
    normalizePolicyDecisionThresholds: (row) => ({
      autoClassifyThreshold: Number(row.auto_classify_threshold || 85),
    }),
  });
}

function metadata(title) {
  return {
    title,
    media_type: 'movie',
    genres: ['Action'],
    keywords: ['explosion', 'chase'],
  };
}

describe('deterministic policy decision and route outcome acceptance', () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createPolicyEngineIntegrationFixture(db, {
      mediaServerName: 'Deterministic Route Outcome Fixture',
      mediaServerApiKey: 'integration-route-outcome-only',
      libraryExternalIdPrefix: 'deterministic-route-outcome',
      libraryName: 'Action Movies',
      presetKeyPrefix: 'deterministic_route_outcome',
      presetName: 'Deterministic Route Outcome',
      presetSignals: {
        genres: { require_all: ['Action'], weight: 2.0 },
        keywords: { require_any: ['explosion', 'chase'], weight: 1.0 },
      },
      policyName: 'Deterministic Route Outcome Policy',
      policyValues: {
        trust_patterns: false,
        trust_rag: false,
        trust_history: false,
        preset_weight: 1.0,
        profile_weight: 0.0,
        pattern_weight: 0.0,
        rag_weight: 0.0,
        history_weight: 0.0,
      },
      presetLinkWeight: 2.0,
    });
  });

  afterAll(async () => {
    await fixture?.cleanup();
  });

  test('keeps routed, classified-not-routed, blocked, and question-required outcomes distinct', async () => {
    const aiClassify = jest.fn();
    const libraries = (await db.query(
      'SELECT * FROM libraries WHERE id = $1',
      [fixture.libraryId],
    )).rows;
    const policyPath = createPolicyPath(aiClassify);
    const policyPathOutcome = await policyPath.execute({
      metadata: metadata('Deterministic Route Outcome'),
      libraries,
      relatedEvidence: [],
    });

    expect(policyPathOutcome).toEqual(expect.objectContaining({ handled: true }));
    expect(policyPathOutcome.result).toEqual(expect.objectContaining({
      library: expect.objectContaining({ id: fixture.libraryId }),
      method: 'policy_auto',
      policyResult: expect.objectContaining({ action: 'auto_classify' }),
    }));
    expect(aiClassify).not.toHaveBeenCalled();

    const service = createClassificationService();
    const routeToArr = jest.fn()
      .mockResolvedValueOnce({ attempted: true, routed: true, reason: 'routed' })
      .mockResolvedValueOnce({ attempted: false, routed: false, reason: 'no_mapping' });
    service.routeToArr = routeToArr;

    const routed = await service.routeClassificationResult(
      null,
      metadata('Routed deterministic policy result'),
      policyPathOutcome.result,
      false,
    );
    expect(buildClassificationRoutingSummary({ routingOutcome: routed })).toEqual({
      shouldRoute: true,
      reason: 'policy_auto',
      routeResult: { attempted: true, routed: true, reason: 'routed' },
    });

    const classifiedNotRouted = await service.routeClassificationResult(
      null,
      metadata('Missing mapping deterministic policy result'),
      policyPathOutcome.result,
      false,
    );
    expect(buildClassificationRoutingSummary({ routingOutcome: classifiedNotRouted })).toEqual({
      shouldRoute: true,
      reason: 'policy_auto',
      routeResult: { attempted: false, routed: false, reason: 'no_mapping' },
    });

    const aiDerived = await service.routeClassificationResult(
      null,
      metadata('AI candidate cannot inherit policy routing'),
      {
        ...policyPathOutcome.result,
        method: 'ai_verified',
      },
      false,
    );
    expect(aiDerived).toEqual(expect.objectContaining({
      shouldRoute: false,
      reason: 'ai_authority_advisory',
    }));

    const mislabeledAi = await service.routeClassificationResult(
      null,
      metadata('AI authority cannot be relabeled as policy'),
      {
        ...policyPathOutcome.result,
        ai_authority: { sideEffects: { canRoute: false } },
      },
      false,
    );
    expect(mislabeledAi).toEqual(expect.objectContaining({
      shouldRoute: false,
      reason: 'ai_authority_advisory',
    }));

    const questionRequired = await service.routeClassificationResult(
      null,
      metadata('Question required'),
      {
        ...policyPathOutcome.result,
        needs_clarification: true,
      },
      false,
    );
    expect(questionRequired).toEqual(expect.objectContaining({
      shouldRoute: false,
      reason: 'not_final',
    }));

    const invalidPolicyAuto = await service.routeClassificationResult(
      null,
      metadata('Unproven policy-auto label'),
      {
        library: policyPathOutcome.result.library,
        confidence: policyPathOutcome.result.confidence,
        method: 'policy_auto',
      },
      false,
    );
    expect(invalidPolicyAuto).toEqual(expect.objectContaining({
      shouldRoute: false,
      reason: 'invalid_policy_auto_provenance',
    }));

    expect(routeToArr).toHaveBeenCalledTimes(2);
  });

  test('does not invoke AI when a deterministic policy result requires destination selection', async () => {
    const libraries = (await db.query(
      'SELECT * FROM libraries WHERE id = $1',
      [fixture.libraryId],
    )).rows;
    const aiClassify = jest.fn();
    const policyResult = {
      action: 'prompt_select',
      confidence: 80,
      library: {
        library_id: fixture.libraryId,
        library_name: libraries[0].name,
      },
      ranked: [{
        library_id: fixture.libraryId,
        library_name: libraries[0].name,
        score: 80,
        prompt_threshold: 60,
        auto_classify_threshold: 85,
      }],
    };
    const policyPath = new ClassificationPolicyPathService({
      policyEngine: { evaluateItem: jest.fn().mockResolvedValue(policyResult) },
      classificationAiService: { aiClassify },
      policyScoringContextBuilder: {
        buildSignalContext: jest.fn().mockReturnValue({
          confidence: 80,
          suggestedLibrary: libraries[0],
        }),
      },
      classificationRoutingService: {
        ensureDecisionQuestion: jest.fn().mockImplementation(async ({ result }) => result),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    const outcome = await policyPath.execute({
      metadata: metadata('Ambiguous deterministic policy result'),
      libraries,
      relatedEvidence: [],
    });

    expect(aiClassify).not.toHaveBeenCalled();
    expect(outcome).toEqual(expect.objectContaining({ handled: true }));
    expect(outcome.result).toEqual(expect.objectContaining({
      method: 'policy_engine',
      needs_clarification: true,
      deterministic_ai_mode: expect.objectContaining({
        mode: 'abstain',
        reasonCode: 'ambiguous_policy_candidates',
      }),
    }));
  });
});
