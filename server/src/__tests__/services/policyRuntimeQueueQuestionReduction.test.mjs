import {
  POLICY_AUTOMATION_DECISION_STATE_IDS,
} from '../../services/policyAutomationDecisionContract.mjs';
import {
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS,
  buildPolicyRuntimeQueueAutomationDecision,
} from '../../services/policyRuntimeQueueAutomationDecision.mjs';
import {
  buildPolicyRuntimeQueueEvidenceAdmission,
} from '../../services/policyRuntimeQueueEvidenceAdmission.mjs';
import {
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS,
  buildPolicyRuntimeQueueQuestionReduction,
  buildPolicyRuntimeQueueQuestionReductionAudit,
} from '../../services/policyRuntimeQueueQuestionReduction.mjs';
import {
  POLICY_RUNTIME_QUESTION_DISPOSITION_IDS,
} from '../../services/policyRuntimeQuestionReduction.mjs';

function buildEvidenceAdmission(overrides = {}) {
  return buildPolicyRuntimeQueueEvidenceAdmission({
    task: {
      id: 'queue-task-question-42',
      task_type: 'classification',
      attempts: 2,
      payload: {
        title: 'Raw queue title must not reach the question plan',
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
      ...overrides,
    },
  });
}

function buildQueueAutomationDecision({
  runtimeEvidenceOverrides = {},
  routing = { mapped: true, targetName: 'Radarr Animated Movies' },
  classification,
  policyEvaluation,
} = {}) {
  return buildPolicyRuntimeQueueAutomationDecision({
    evidenceAdmission: buildEvidenceAdmission(runtimeEvidenceOverrides),
    routing,
    classification,
    policyEvaluation,
  });
}

describe('policyRuntimeQueueQuestionReduction', () => {
  test('builds a side-effect-free bounded question plan from a ready queue decision', () => {
    const queueAutomationDecision = buildQueueAutomationDecision({
      policyEvaluation: { hardLimitSatisfied: false },
    });
    const result = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision,
    });

    expect(queueAutomationDecision.statusId)
      .toBe(POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.READY);
    expect(queueAutomationDecision.decision.stateId)
      .toBe(POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT);
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY,
      queueEvidence: expect.objectContaining({
        taskType: 'classification',
        attempt: 2,
        taskFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        evidenceFingerprint: queueAutomationDecision.queueEvidence.evidenceFingerprint,
        executionFingerprint: queueAutomationDecision.queueEvidence.executionFingerprint,
      }),
      plan: expect.objectContaining({
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        decisionEvidenceFingerprint: expect.objectContaining({
          fingerprint: queueAutomationDecision.queueEvidence.evidenceFingerprint,
        }),
      }),
    }));
    expect(result.plan.question).toEqual(expect.objectContaining({
      decisionEvidenceFingerprint: expect.objectContaining({
        fingerprint: result.queueEvidence.evidenceFingerprint,
      }),
    }));
    expect(result.audit.ok).toBe(true);
    expect(result.sideEffects).toEqual({
      providerCalled: false,
      queueMutated: false,
      classificationExecuted: false,
      routingExecuted: false,
      questionCreated: false,
      questionPersisted: false,
      questionSent: false,
      learningWritten: false,
    });
    expect(JSON.stringify(result)).not.toContain('queue-task-question-42');
    expect(JSON.stringify(result)).not.toContain('Raw queue title must not reach the question plan');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  test('suppresses auto-route questions and turns routing gaps into configuration actions', () => {
    const autoRoute = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision: buildQueueAutomationDecision(),
    });
    const routingGap = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision: buildQueueAutomationDecision({
        runtimeEvidenceOverrides: { routingOutcomes: [] },
        routing: { mapped: false, targetName: 'Radarr Animated Movies' },
        classification: { status: 'completed' },
      }),
    });

    expect(autoRoute.plan).toEqual(expect.objectContaining({
      dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.SUPPRESS_QUESTION,
      createQuestion: false,
      question: null,
    }));
    expect(routingGap.plan).toEqual(expect.objectContaining({
      dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING,
      createQuestion: false,
      question: null,
    }));
    expect(autoRoute.audit.ok).toBe(true);
    expect(routingGap.audit.ok).toBe(true);
  });

  test('normalizes only stale-question cleanup fields before reducing the queue decision', () => {
    const result = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision: buildQueueAutomationDecision({
        policyEvaluation: { avoidRulesSatisfied: false },
      }),
      existingQuestion: {
        id: 42,
        stale: true,
        version: 'legacy.policy_question.v1',
      },
    });

    expect(result.plan).toEqual(expect.objectContaining({
      dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.STALE_QUESTION_CLEANUP,
      createQuestion: false,
      question: null,
      staleQuestionCleanup: {
        required: true,
        existingQuestionId: 42,
      },
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('fails closed for invalid queue decisions and unsupported raw question inputs', () => {
    const validDecision = buildQueueAutomationDecision();
    const alteredDecision = {
      ...validDecision,
      decision: {
        ...validDecision.decision,
        evidence: {
          ...validDecision.decision.evidence,
          projectionFingerprint: {
            ...validDecision.decision.evidence.projectionFingerprint,
            fingerprint: 'a'.repeat(64),
          },
        },
      },
    };
    const invalidDecision = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision: alteredDecision,
    });
    const rawInput = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision: validDecision,
      libraryProfile: { identityCandidates: [{ label: 'must not enter a question plan' }] },
      existingQuestion: { id: 42, taskId: 'raw-queue-id' },
    });

    expect(invalidDecision).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS
        .BLOCKED_INVALID_QUEUE_DECISION,
      reasonCode: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_DECISION,
      queueEvidence: null,
      plan: null,
    }));
    expect(rawInput).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      reasonCode: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSUPPORTED_INPUT,
      queueEvidence: null,
      plan: null,
    }));
    expect(invalidDecision.audit.ok).toBe(true);
    expect(rawInput.audit.ok).toBe(true);
  });

  test('rejects altered fingerprint bindings and raw queue output fields', () => {
    const result = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision: buildQueueAutomationDecision({
        policyEvaluation: { hardLimitSatisfied: false },
      }),
    });
    const audit = buildPolicyRuntimeQueueQuestionReductionAudit({
      ...result,
      queueEvidence: {
        ...result.queueEvidence,
        taskId: 'raw-queue-id',
      },
      plan: {
        ...result.plan,
        decisionEvidenceFingerprint: {
          ...result.plan.decisionEvidenceFingerprint,
          fingerprint: 'b'.repeat(64),
        },
      },
      audit: {
        ...result.audit,
        queuePayload: { title: 'must not be exposed' },
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_EVIDENCE_BINDING,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.EVIDENCE_FINGERPRINT_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUESTION_PLAN,
      }),
    ]));

    const missingPlanAudit = buildPolicyRuntimeQueueQuestionReductionAudit({
      ...result,
      plan: null,
    });

    expect(missingPlanAudit.ok).toBe(false);
    expect(missingPlanAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUESTION_PLAN,
      }),
    ]));
  });

  test('rejects any claimed question, route, queue, provider, or learning side effect', () => {
    const result = buildPolicyRuntimeQueueQuestionReduction({
      queueAutomationDecision: buildQueueAutomationDecision(),
    });
    const audit = buildPolicyRuntimeQueueQuestionReductionAudit({
      ...result,
      sideEffects: {
        ...result.sideEffects,
        questionPersisted: true,
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      }),
    ]));
  });
});
