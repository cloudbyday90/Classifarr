import {
  buildAiClassificationEvaluationFingerprintSet,
} from '../../services/aiClassificationEvaluationFingerprint.mjs';
import {
  buildAiClassificationEvaluationPolicyContext,
} from '../../services/aiClassificationEvaluationPolicyContext.mjs';

function fixture(overrides = {}) {
  return {
    version: 'classifarr.ai_classification_evaluation_fixture.v1',
    id: 'family-movie',
    name: 'Family movie',
    tags: ['movie', 'happy-path'],
    request: { tmdbId: 12, mediaType: 'movie', title: 'Private Title' },
    expected: {
      fallbackAllowed: false,
      outcomes: [{
        decisionKind: 'classified',
        methods: ['ai', 'policy_engine'],
        historyStatuses: ['completed'],
        library: { id: 4, name: 'Family' },
        confidence: { minimum: 85, maximum: 100 },
      }],
    },
    ...overrides,
  };
}

function evaluation(overrides = {}) {
  return {
    version: 'classifarr.ai_classification_evaluation_result.v1',
    fixtureId: 'family-movie',
    passed: true,
    matchedOutcomeIndex: 0,
    observedDecisionKind: 'classified',
    score: { passedCheckCount: 9, totalCheckCount: 9, percentage: 100 },
    checks: [{ id: 'history_status', passed: true }, { id: 'decision_kind', passed: true }],
    ...overrides,
  };
}

function buildSet(overrides = {}) {
  const policyContext = buildAiClassificationEvaluationPolicyContext({
    policies: [{ policy: { id: 4, enabled: true } }],
  });
  return buildAiClassificationEvaluationFingerprintSet({
    fixture: fixture(),
    policyContext,
    runtime: {
      model: 'qwen3.5:4b',
      ingestMode: 'direct',
      requireAllConfirmations: true,
      aiConfig: { primary_provider: 'ollama', ollama_fallback_enabled: false },
    },
    evaluation: evaluation(),
    ...overrides,
  });
}

describe('AI classification evaluation fingerprints', () => {
  test('emits SHA-256 evidence without exposing fixture inputs', () => {
    const result = buildSet();

    expect(result.fixture.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.runtime.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.outcome.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.policy.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('Private Title');
  });

  test('changes only the relevant fingerprints for model and outcome changes', () => {
    const original = buildSet();
    const modelChanged = buildSet({
      runtime: {
        model: 'llama3.1:8b',
        ingestMode: 'direct',
        requireAllConfirmations: true,
        aiConfig: { primary_provider: 'ollama', ollama_fallback_enabled: false },
      },
    });
    const outcomeChanged = buildSet({
      evaluation: evaluation({ passed: false, checks: [{ id: 'history_status', passed: false }] }),
    });

    expect(modelChanged.fixture.fingerprint).toBe(original.fixture.fingerprint);
    expect(modelChanged.runtime.fingerprint).not.toBe(original.runtime.fingerprint);
    expect(outcomeChanged.outcome.fingerprint).not.toBe(original.outcome.fingerprint);
  });
});
