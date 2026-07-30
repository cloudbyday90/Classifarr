import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeEvent,
} from '../../services/policyRequestTimeEvent.mjs';
import {
  POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS,
  POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS,
  buildPolicyRequestTimeQueueQuestionReduction,
  buildPolicyRequestTimeQueueQuestionReductionAudit,
} from '../../services/policyRequestTimeQueueQuestionReduction.mjs';
import {
  buildPolicyRuntimeQueueAutomationDecision,
} from '../../services/policyRuntimeQueueAutomationDecision.mjs';
import {
  buildPolicyRuntimeQueueEvidenceAdmission,
} from '../../services/policyRuntimeQueueEvidenceAdmission.mjs';
import {
  buildPolicyRuntimeQueueQuestionReduction,
} from '../../services/policyRuntimeQueueQuestionReduction.mjs';

function queueTaskContext(overrides = {}) {
  return {
    id: 'queue-task-request-time-42',
    taskType: 'classification',
    attempts: 2,
    ...overrides,
  };
}

function buildQueueQuestionReduction({
  runtimeEvidenceOverrides = {},
  routing = { mapped: true, targetName: 'Radarr Animated Movies' },
  classification,
  policyEvaluation,
} = {}) {
  const task = queueTaskContext();
  const evidenceAdmission = buildPolicyRuntimeQueueEvidenceAdmission({
    task: {
      id: task.id,
      task_type: task.taskType,
      attempts: task.attempts,
      payload: {
        title: 'Raw queue title must not reach request-time learning',
        providerPayload: { token: 'must-not-leak' },
      },
    },
    runtimeEvidenceInput: {
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 8, confidence: 0.9, trusted: true },
        ],
      },
      operatorIntent: {
        belongsHere: [{ key: 'genre:animated', label: 'Animated Movies' }],
        routingTargets: ['Radarr Animated Movies'],
      },
      routingOutcomes: [{ label: 'Radarr route mapped', routed: true }],
      profileFreshness: {
        key: 'profile',
        label: 'Profile is current',
        updatedAt: '2026-07-30T00:00:00.000Z',
        stale: false,
      },
      ...runtimeEvidenceOverrides,
    },
  });
  const queueAutomationDecision = buildPolicyRuntimeQueueAutomationDecision({
    evidenceAdmission,
    routing,
    classification,
    policyEvaluation,
  });

  return {
    task,
    queueQuestionReduction: buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision,
    }),
  };
}

function routeSucceededEvent() {
  return buildPolicyRequestTimeEvent({
    eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
    item: { itemId: 87 },
    finalDestination: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      arrType: 'radarr',
    },
    routeResult: {
      attempted: true,
      succeeded: true,
      routeId: 'radarr:87',
    },
    sourceEventId: 'classification:87',
  });
}

function missingMappingEvent() {
  return buildPolicyRequestTimeEvent({
    eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
    item: { itemId: 87 },
    finalDestination: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      arrType: 'radarr',
    },
    routeResult: {
      attempted: true,
      missingMapping: true,
      reasonCode: 'missing_mapping',
    },
    sourceEventId: 'classification:87',
  });
}

describe('policyRequestTimeQueueQuestionReduction', () => {
  test('admits a matching queue question-reduction plan for a routed outcome without writes', () => {
    const { task, queueQuestionReduction } = buildQueueQuestionReduction({
      policyEvaluation: { hardLimitSatisfied: false },
    });
    const result = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: task,
      requestEvent: routeSucceededEvent(),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY,
      queueEvidence: expect.objectContaining({
        taskType: 'classification',
        attempt: 2,
        taskFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        evidenceFingerprint: queueQuestionReduction.queueEvidence.evidenceFingerprint,
        executionFingerprint: queueQuestionReduction.queueEvidence.executionFingerprint,
      }),
      decision: expect.objectContaining({
        eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
        dispositionId: 'outcome_only',
        upstreamEvidenceFingerprint: expect.objectContaining({
          fingerprint: queueQuestionReduction.queueEvidence.evidenceFingerprint,
        }),
      }),
    }));
    expect(result.decision.learningDecision.learning).toEqual(expect.objectContaining({
      canWriteLearning: false,
    }));
    expect(result.decision.profileRefresh.queue).toBe(false);
    expect(result.sideEffects).toEqual({
      providerCalled: false,
      queueMutated: false,
      classificationExecuted: false,
      routingExecuted: false,
      questionCreated: false,
      questionPersisted: false,
      questionSent: false,
      learningWritten: false,
      profileRefreshQueued: false,
    });
    expect(result.audit.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('queue-task-request-time-42');
    expect(JSON.stringify(result)).not.toContain('Raw queue title must not reach request-time learning');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  test('preserves a missing route mapping as an outcome-only failure', () => {
    const { task, queueQuestionReduction } = buildQueueQuestionReduction({
      runtimeEvidenceOverrides: { routingOutcomes: [] },
      routing: { mapped: false, targetName: 'Radarr Animated Movies' },
      classification: { status: 'completed' },
    });
    const result = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: task,
      requestEvent: missingMappingEvent(),
    });

    expect(result.decision).toEqual(expect.objectContaining({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
      dispositionId: 'route_failure_only',
      finalOutcome: expect.objectContaining({
        status: 'route_failed_missing_mapping',
      }),
    }));
    expect(result.decision.learningDecision.learning.canWriteLearning).toBe(false);
    expect(result.decision.profileRefresh.queue).toBe(false);
    expect(result.audit.ok).toBe(true);
  });

  test('rejects a queue plan detached from the current task or attempt', () => {
    const { task, queueQuestionReduction } = buildQueueQuestionReduction();
    const wrongTask = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: queueTaskContext({ id: 'different-task' }),
      requestEvent: routeSucceededEvent(),
    });
    const wrongAttempt = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: { ...task, attempts: 3 },
      requestEvent: routeSucceededEvent(),
    });

    [wrongTask, wrongAttempt].forEach(result => {
      expect(result).toEqual(expect.objectContaining({
        ok: false,
        statusId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS
          .BLOCKED_INVALID_QUEUE_QUESTION_REDUCTION,
        reasonCode: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS
          .INVALID_QUEUE_QUESTION_REDUCTION,
        queueEvidence: null,
        decision: null,
      }));
      expect(result.audit.ok).toBe(true);
    });
  });

  test('accepts only canonical terminal routing events and rejects unsupported input', () => {
    const { task, queueQuestionReduction } = buildQueueQuestionReduction();
    const nonTerminalEvent = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: task,
      requestEvent: buildPolicyRequestTimeEvent({
        eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
        item: { itemId: 87 },
        requestedDestination: { libraryId: 6, libraryName: 'Animated Movies' },
        sourceEventId: 'request:87',
      }),
    });
    const rawInput = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: {
        ...task,
        payload: { title: 'must not be accepted' },
      },
      requestEvent: routeSucceededEvent(),
      libraryProfile: { identityCandidates: [{ label: 'must not be accepted' }] },
    });

    expect(nonTerminalEvent).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_INVALID_REQUEST_EVENT,
      reasonCode: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_EVENT,
    }));
    expect(rawInput).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      reasonCode: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSUPPORTED_INPUT,
    }));
    expect(nonTerminalEvent.audit.ok).toBe(true);
    expect(rawInput.audit.ok).toBe(true);
  });

  test('rejects altered request-time output, raw data, and side-effect claims', () => {
    const { task, queueQuestionReduction } = buildQueueQuestionReduction();
    const result = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: task,
      requestEvent: routeSucceededEvent(),
    });
    const audit = buildPolicyRequestTimeQueueQuestionReductionAudit({
      ...result,
      queueEvidence: {
        ...result.queueEvidence,
        taskId: 'raw-queue-id',
      },
      decision: {
        ...result.decision,
        upstreamEvidenceFingerprint: {
          ...result.decision.upstreamEvidenceFingerprint,
          fingerprint: 'b'.repeat(64),
        },
      },
      sideEffects: {
        ...result.sideEffects,
        learningWritten: true,
      },
      audit: {
        ...result.audit,
        queuePayload: { title: 'must not be exposed' },
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_EVIDENCE_BINDING,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.EVIDENCE_FINGERPRINT_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_TIME_DECISION,
      }),
    ]));

    const missingDecisionAudit = buildPolicyRequestTimeQueueQuestionReductionAudit({
      ...result,
      decision: null,
    });
    expect(missingDecisionAudit.ok).toBe(false);
    expect(missingDecisionAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_TIME_DECISION,
      }),
    ]));
  });
});
