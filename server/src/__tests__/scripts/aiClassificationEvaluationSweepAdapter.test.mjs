import {
  AI_CLASSIFICATION_EVALUATION_STATUS,
  buildSweepEvaluationArtifact,
  normalizeSweepFixtures,
  projectLiveObservation,
} from '../../../../scripts/lib/aiClassificationEvaluationSweepAdapter.mjs';
import {
  buildAiClassificationEvaluationPolicyContext,
} from '../../services/aiClassificationEvaluationPolicyContext.mjs';

const evaluationFixture = {
  version: 'classifarr.ai_classification_evaluation_fixture.v1',
  id: 'clear-movie',
  name: 'Clear movie',
  tags: ['movie'],
  request: { tmdbId: 550, mediaType: 'movie', title: 'Fight Club' },
  expected: {
    fallbackAllowed: false,
    outcomes: [{
      decisionKind: 'classified',
      methods: ['ai'],
      historyStatuses: ['completed'],
      library: { id: 7, name: 'Movies' },
      confidence: { minimum: 80, maximum: 100 },
    }],
  },
};

const directResponse = {
  method: 'ai',
  confidence: 91,
  library: { id: 7, name: 'Movies' },
  needs_clarification: false,
  needs_retry: false,
  raw_provider_payload: 'must not be copied',
};

const historyRow = {
  id: 41,
  method: 'ai',
  status: 'completed',
  confidence: '91',
  library_id: 7,
  library_name: 'Movies',
};

const policyContext = buildAiClassificationEvaluationPolicyContext({
  policies: [{ policy: { id: 7, enabled: true } }],
});

describe('AI classification evaluation sweep adapter', () => {
  test('normalizes versioned and legacy fixtures without changing legacy behavior', () => {
    const [versioned, legacy] = normalizeSweepFixtures([
      evaluationFixture,
      { name: 'Legacy', tmdb_id: 10, media_type: 'tv', title: 'Legacy show' },
    ]);

    expect(versioned).toEqual(expect.objectContaining({
      tmdb_id: 550,
      media_type: 'movie',
      title: 'Fight Club',
      evaluationFixture,
    }));
    expect(legacy.evaluationFixture).toBeNull();
  });

  test('grades a bounded direct response and emits only fingerprint evidence', () => {
    const [fixture] = normalizeSweepFixtures([evaluationFixture]);
    const artifact = buildSweepEvaluationArtifact({
      fixture,
      classificationResponse: directResponse,
      historyRow,
      policyContext,
      runtime: {
        model: 'qwen3.5:4b',
        ingestMode: 'direct',
        requireAllConfirmations: true,
        aiConfig: { primary_provider: 'ollama', ollama_fallback_enabled: false },
      },
    });

    expect(artifact.status).toBe(AI_CLASSIFICATION_EVALUATION_STATUS.EVALUATED);
    expect(artifact.result.passed).toBe(true);
    expect(artifact.fingerprints.outcome.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(artifact)).not.toContain('must not be copied');
  });

  test('does not invent a response observation for queued execution', () => {
    const [fixture] = normalizeSweepFixtures([evaluationFixture]);
    const artifact = buildSweepEvaluationArtifact({ fixture, historyRow, policyContext });

    expect(artifact).toEqual({
      status: AI_CLASSIFICATION_EVALUATION_STATUS.NOT_EVALUATED,
      fixtureId: 'clear-movie',
      reasonId: 'classification_response_not_observable',
    });
  });

  test('rejects an invalid versioned fixture before it can produce a fingerprint', () => {
    const [fixture] = normalizeSweepFixtures([{
      ...evaluationFixture,
      expected: { fallbackAllowed: false, outcomes: [] },
    }]);
    const artifact = buildSweepEvaluationArtifact({
      fixture,
      classificationResponse: directResponse,
      historyRow,
      policyContext,
    });

    expect(artifact).toEqual({
      status: AI_CLASSIFICATION_EVALUATION_STATUS.INVALID,
      fixtureId: 'clear-movie',
      reasonId: 'invalid_evaluation_fixture',
    });
  });

  test('projects exactly the allowed observation fields', () => {
    expect(projectLiveObservation({ classificationResponse: directResponse, historyRow }))
      .toEqual({
        classification: {
          method: 'ai',
          confidence: 91,
          library: { id: 7, name: 'Movies' },
          needsClarification: false,
          needsRetry: false,
        },
        history: {
          method: 'ai',
          status: 'completed',
          confidence: 91,
          library: { id: 7, name: 'Movies' },
        },
      });
  });
});
