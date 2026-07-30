import {
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_VERSION,
  buildPolicyRuntimeQueueQuestionReductionProducer,
  buildPolicyRuntimeQueueQuestionReductionProducerAudit,
} from '../../services/policyRuntimeQueueQuestionReductionProducer.mjs';

function queueTask(overrides = {}) {
  return {
    id: 'queue-task-42',
    task_type: 'classification',
    attempts: 1,
    payload: {
      title: 'Raw queue title must not leave the producer',
    },
    ...overrides,
  };
}

function runtimeEvidenceInput(overrides = {}) {
  return {
    libraryProfile: {
      identityCandidates: [{ label: 'Anime', count: 8, trusted: true }],
    },
    operatorIntent: {
      belongsHere: [{ key: 'genre:anime', label: 'Anime' }],
    },
    profileFreshness: {
      key: 'library_profile',
      label: 'Library profile',
      updatedAt: '2026-07-30T00:00:00.000Z',
      stale: false,
    },
    ...overrides,
  };
}

function producerInput(overrides = {}) {
  return {
    task: queueTask(),
    runtimeEvidenceInput: runtimeEvidenceInput(),
    routing: {
      mapped: true,
      configured: true,
      targetId: 'radarr:4',
      arrConfigId: '4',
    },
    classification: {
      completed: true,
      status: 'completed',
    },
    policyEvaluation: {
      hardLimitsSatisfied: true,
      avoidRulesSatisfied: true,
      highRiskConflicts: [],
    },
    ...overrides,
  };
}

describe('policyRuntimeQueueQuestionReductionProducer', () => {
  test('builds one opaque queue proof from current server-owned inputs', () => {
    const result = buildPolicyRuntimeQueueQuestionReductionProducer(producerInput());

    expect(result).toEqual(expect.objectContaining({
      version: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_VERSION,
      ok: true,
      statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.READY,
      queueQuestionReduction: expect.objectContaining({
        version: 'policy.runtime_queue_question_reduction.v1',
        ok: true,
        statusId: 'ready',
        queueEvidence: expect.objectContaining({
          taskType: 'classification',
          attempt: 1,
          taskFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          evidenceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          executionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    }));
    expect(result.audit.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('queue-task-42');
    expect(JSON.stringify(result)).not.toContain('Raw queue title must not leave the producer');
  });

  test('fails closed when evidence input tries to reuse a cached projection', () => {
    const result = buildPolicyRuntimeQueueQuestionReductionProducer(producerInput({
      runtimeEvidenceInput: runtimeEvidenceInput({
        evidenceProjection: { projectionFingerprint: { fingerprint: 'cached' } },
      }),
    }));

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS
        .BLOCKED_EVIDENCE_ADMISSION,
      queueQuestionReduction: null,
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('rejects unsupported producer inputs without returning queue proof', () => {
    const result = buildPolicyRuntimeQueueQuestionReductionProducer({
      ...producerInput(),
      queuePayload: { title: 'Do not accept transport data at this boundary' },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS
        .BLOCKED_UNSUPPORTED_INPUT,
      queueQuestionReduction: null,
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('rejects altered output that exposes runtime input or claims a side effect', () => {
    const result = buildPolicyRuntimeQueueQuestionReductionProducer(producerInput());
    const audit = buildPolicyRuntimeQueueQuestionReductionProducerAudit({
      ...result,
      runtimeEvidenceInput: runtimeEvidenceInput(),
      sideEffects: {
        ...result.sideEffects,
        routingExecuted: true,
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.RAW_RUNTIME_INPUT_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.UNSAFE_SIDE_EFFECT,
      }),
    ]));
  });
});
