import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  POLICY_AUTOMATION_DECISION_ACTION_IDS,
  POLICY_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyAutomationDecisionFromEvidenceProjection,
} from '../../services/policyAutomationDecisionContract.mjs';
import {
  POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS,
  POLICY_RUNTIME_QUESTION_DISPOSITION_IDS,
  POLICY_RUNTIME_QUESTION_REASON_IDS,
  buildPolicyRuntimeQuestionReductionFromAutomationDecision,
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
  buildPolicyRuntimeQuestionReductionAudit,
  validatePolicyRuntimeQuestionReduction,
} from '../../services/policyRuntimeQuestionReduction.mjs';
import {
  buildPolicyRuntimeEvidenceProjection,
} from '../../services/policyRuntimeEvidenceProjection.mjs';

function buildStrongDecision(overrides = {}) {
  return buildPolicyAutomationDecisionFromEvidenceProjection({
    evidenceProjection: buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.92, trusted: true },
        ],
      },
      operatorIntent: {
        routingTargets: ['Radarr Animated Movies'],
      },
      routingOutcomes: [
        { label: 'Radarr route mapped', routed: true },
      ],
      profileFreshness: {
        stale: false,
        updatedAt: '2026-06-30T12:00:00.000Z',
      },
    }),
    routing: {
      mapped: true,
      targetName: 'Radarr Animated Movies',
    },
    ...overrides,
  });
}

function buildQuestionReductionPlanForTest(input = {}) {
  return input.automationDecision?.version === 'policy.automation_decision.v1'
    ? buildPolicyRuntimeQuestionReductionFromAutomationDecision(input)
    : buildPolicyRuntimeQuestionReductionFromRuntimeInput(input);
}

describe('policyRuntimeQuestionReduction', () => {
  test('suppresses operator questions for auto-route-ready decisions', () => {
    const plan = buildQuestionReductionPlanForTest({
      automationDecision: buildStrongDecision(),
    });

    expect(plan.dispositionId).toBe(POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.SUPPRESS_QUESTION);
    expect(plan.createQuestion).toBe(false);
    expect(plan.question).toBeNull();
    expect(plan.nextAction).toEqual(expect.objectContaining({
      actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
      label: 'Route automatically',
    }));
    expect(plan.decisionEvidenceFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(plan.trace.attributes).toEqual(expect.objectContaining({
      'classifarr.runtime.question.decision_valid': true,
      'classifarr.runtime.question.decision_evidence_projection_fingerprint':
        plan.decisionEvidenceFingerprint.fingerprint,
    }));
    expect(JSON.stringify(plan.decisionEvidenceFingerprint)).not.toContain('Animated Movies');
    expect(JSON.stringify(plan.decisionEvidenceFingerprint)).not.toContain('Radarr Animated Movies');
    expect(plan.trace.reasons).toEqual([
      expect.objectContaining({
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.AUTO_ROUTE_DOES_NOT_NEED_QUESTION,
      }),
    ]);
    expect(validatePolicyRuntimeQuestionReduction(plan).ok).toBe(true);
  });

  test('requires an explicit adapter for raw runtime inputs', () => {
    expect(() => buildPolicyRuntimeQuestionReductionFromAutomationDecision({
      libraryProfile: {
        identityCandidates: [{ label: 'Animated Movies', count: 12 }],
      },
    })).toThrow('raw decision input key "libraryProfile"');

    expect(() => buildPolicyRuntimeQuestionReductionFromRuntimeInput({
      automationDecision: buildStrongDecision(),
    })).toThrow('received an automation decision');

    expect(() => buildPolicyRuntimeQuestionReductionFromAutomationDecision({
      automationDecision: {
        version: 'policy.automation_decision.v1',
      },
    })).toThrow('requires a valid automation decision');

    const plan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
      libraryProfile: {
        identityCandidates: [{ label: 'Animated Movies', count: 12 }],
      },
      routing: {
        mapped: true,
      },
    });

    expect(plan.decision.version).toBe('policy.automation_decision.v1');
    expect(plan.dispositionId).toBe(POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.SUPPRESS_QUESTION);
  });

  test('turns classified_not_routed into routing action instead of a persisted question', () => {
    const decision = buildPolicyAutomationDecisionFromEvidenceProjection({
      evidenceProjection: buildPolicyRuntimeEvidenceProjection({
        libraryProfile: {
          identityCandidates: [
            { label: 'Animated Movies', count: 8, confidence: 0.9, trusted: true },
          ],
        },
        operatorIntent: {
          routingTargets: ['Radarr Animated Movies'],
        },
      }),
      classification: {
        status: 'completed',
      },
      routing: {
        mapped: false,
        targetName: 'Radarr Animated Movies',
      },
    });
    const plan = buildQuestionReductionPlanForTest({ automationDecision: decision });

    expect(decision.stateId).toBe(POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED);
    expect(plan.dispositionId).toBe(POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING);
    expect(plan.createQuestion).toBe(false);
    expect(plan.proposedFrameId).toBe(QUESTION_FRAME_IDS.ROUTING_GAP);
    expect(plan.nextAction).toEqual(expect.objectContaining({
      actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
      target: QUESTION_FRAME_IDS.ROUTING_GAP,
    }));
    expect(validatePolicyRuntimeQuestionReduction(plan).ok).toBe(true);
  });

  test('creates bounded Phase 5R questions for hard-limit and missing-evidence states', () => {
    const hardLimitPlan = buildQuestionReductionPlanForTest({
      evidenceProjection: buildPolicyRuntimeEvidenceProjection({
        libraryProfile: {
          identityCandidates: [
            { label: 'Movies', count: 8, confidence: 0.86, trusted: true },
          ],
        },
      }),
      policyEvaluation: {
        hardLimitSatisfied: false,
      },
    });
    const missingEvidencePlan = buildQuestionReductionPlanForTest({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.6 },
        ],
      },
      metadataSignals: [
        { label: 'Comedy', confidence: 0.7 },
      ],
    });

    expect(hardLimitPlan.dispositionId)
      .toBe(POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION);
    expect(hardLimitPlan.question).toEqual(expect.objectContaining({
      contractVersion: 'policy.runtime_question_reduction.v1',
      frameId: QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT,
      decisionStateId: POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      decisionEvidenceFingerprint: expect.objectContaining({
        fingerprint: hardLimitPlan.decisionEvidenceFingerprint.fingerprint,
      }),
    }));
    expect(hardLimitPlan.question.learning).toEqual(expect.objectContaining({
      eligible: false,
      allowedOutcomeIds: [
        ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
        ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
      ],
    }));

    expect(missingEvidencePlan.question).toEqual(expect.objectContaining({
      frameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      decisionStateId: POLICY_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
    }));
    expect(validatePolicyRuntimeQuestionReduction(hardLimitPlan).ok).toBe(true);
    expect(validatePolicyRuntimeQuestionReduction(missingEvidencePlan).ok).toBe(true);
  });

  test('uses outlier review for avoid and high-risk runtime review states', () => {
    const plan = buildQuestionReductionPlanForTest({
      automationDecision: buildStrongDecision({
        policyEvaluation: {
          avoidRulesSatisfied: false,
        },
      }),
    });

    expect(plan.decision.stateId).toBe(POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW);
    expect(plan.question).toEqual(expect.objectContaining({
      frameId: QUESTION_FRAME_IDS.OUTLIER_REVIEW,
    }));
    expect(plan.question.learning.eligible).toBe(false);
  });

  test('rewrites rejected broad-genre priority frames before persistence', () => {
    const plan = buildQuestionReductionPlanForTest({
      requestedQuestionFrameId: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.6 },
        ],
      },
    });

    expect(plan.createQuestion).toBe(true);
    expect(plan.rejectedFrame).toEqual(expect.objectContaining({
      requestedFrameId: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
      replacementFrameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
    }));
    expect(plan.question.frameId).toBe(QUESTION_FRAME_IDS.DESTINATION_FIT);
    expect(plan.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.REJECTED_LEGACY_FRAME_REWRITTEN,
      }),
    ]));
    expect(validatePolicyRuntimeQuestionReduction(plan).ok).toBe(true);
  });

  test('routes stale or legacy pending questions through cleanup before answer or learning', () => {
    const plan = buildQuestionReductionPlanForTest({
      automationDecision: buildStrongDecision({
        policyEvaluation: {
          avoidRulesSatisfied: false,
        },
      }),
      existingQuestion: {
        id: 42,
        version: 'legacy.policy_question.v1',
        stale: true,
        frameId: REJECTED_QUESTION_FRAME_IDS.AI_AUTHORED_POLICY_EDIT,
      },
    });

    expect(plan.dispositionId).toBe(POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.STALE_QUESTION_CLEANUP);
    expect(plan.createQuestion).toBe(false);
    expect(plan.question).toBeNull();
    expect(plan.staleQuestionCleanup).toEqual({
      required: true,
      existingQuestionId: 42,
    });
    expect(plan.learning).toEqual(expect.objectContaining({
      eligible: false,
      reason: POLICY_RUNTIME_QUESTION_REASON_IDS.STALE_OR_LEGACY_QUESTION_REQUIRES_CLEANUP,
    }));
    expect(validatePolicyRuntimeQuestionReduction(plan).ok).toBe(true);
  });

  test('rejects invalid question plans with rejected frames, learning, or side effects', () => {
    const validation = validatePolicyRuntimeQuestionReduction({
      version: 'policy.runtime_question_reduction.v1',
      dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
      createQuestion: true,
      decision: {
        stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
      },
      question: {
        frameId: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
        learning: {
          eligible: true,
        },
        options: [
          {
            learningEligible: true,
          },
        ],
      },
      learning: {
        eligible: true,
      },
      sideEffects: {
        questionCreated: true,
      },
      trace: {
        reasons: [],
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_REJECTED_FRAME,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_LEARNING_ENABLED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_FOR_AUTO_ROUTE,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_SIDE_EFFECT,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.AUTOMATION_DECISION_INVALID,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_DECISION_EVIDENCE_FINGERPRINT,
      }),
    ]));
  });

  test('rejects question plans with mismatched evidence fingerprints', () => {
    const plan = buildQuestionReductionPlanForTest({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.6 },
        ],
      },
    });
    const validation = validatePolicyRuntimeQuestionReduction({
      ...plan,
      question: {
        ...plan.question,
        decisionEvidenceFingerprint: {
          ...plan.question.decisionEvidenceFingerprint,
          fingerprint: '0'.repeat(64),
        },
      },
      trace: {
        ...plan.trace,
        attributes: {
          ...plan.trace.attributes,
          'classifarr.runtime.question.decision_evidence_projection_fingerprint':
            '1'.repeat(64),
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_FINGERPRINT_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects question plans without carried automation decision validation proof', () => {
    const plan = buildQuestionReductionPlanForTest({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.6 },
        ],
      },
    });
    const validation = validatePolicyRuntimeQuestionReduction({
      ...plan,
      decisionValidation: undefined,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
          .MISSING_AUTOMATION_DECISION_VALIDATION,
      }),
    ]));
  });

  test('rejects question plans when decision validation or trace proof drifts', () => {
    const plan = buildQuestionReductionPlanForTest({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.6 },
        ],
      },
    });
    const validation = validatePolicyRuntimeQuestionReduction({
      ...plan,
      decisionValidation: {
        ...plan.decisionValidation,
        ok: false,
      },
      trace: {
        ...plan.trace,
        attributes: {
          ...plan.trace.attributes,
          'classifarr.runtime.question.decision_valid': true,
        },
      },
    });
    const traceOnlyValidation = validatePolicyRuntimeQuestionReduction({
      ...plan,
      trace: {
        ...plan.trace,
        attributes: {
          ...plan.trace.attributes,
          'classifarr.runtime.question.decision_valid': false,
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
          .AUTOMATION_DECISION_VALIDATION_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
          .TRACE_DECISION_VALID_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
          .AUTOMATION_DECISION_INVALID,
      }),
    ]));
    expect(traceOnlyValidation.ok).toBe(false);
    expect(traceOnlyValidation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
          .TRACE_DECISION_VALID_MISMATCH,
      }),
    ]));
  });

  test('rejects plans whose disposition, question output, or trace drifts from the decision', () => {
    const plan = buildQuestionReductionPlanForTest({
      automationDecision: buildStrongDecision(),
    });
    const validation = validatePolicyRuntimeQuestionReduction({
      ...plan,
      dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING,
      createQuestion: false,
      nextAction: {
        actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
        label: 'Configure routing',
        target: QUESTION_FRAME_IDS.ROUTING_GAP,
      },
      proposedFrameId: QUESTION_FRAME_IDS.ROUTING_GAP,
      trace: {
        ...plan.trace,
        reasons: [{
          ...plan.trace.reasons[0],
          summary: 'raw=do-not-leak',
        }],
        attributes: {
          ...plan.trace.attributes,
          'classifarr.runtime.question.disposition':
            POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING,
          'classifarr.runtime.question.reason_count': 999,
          'classifarr.runtime.question.unbounded_context': 'do-not-leak',
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.OUTPUT_CONTRACT_MISMATCH,
      }),
    ]));
  });

  test('rejects created questions or traces without evidence fingerprint proof', () => {
    const plan = buildQuestionReductionPlanForTest({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.6 },
        ],
      },
    });
    const validation = validatePolicyRuntimeQuestionReduction({
      ...plan,
      question: {
        ...plan.question,
        decisionEvidenceFingerprint: undefined,
      },
      trace: {
        ...plan.trace,
        attributes: {
          ...plan.trace.attributes,
          'classifarr.runtime.question.decision_evidence_projection_fingerprint':
            undefined,
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
          .MISSING_QUESTION_EVIDENCE_FINGERPRINT,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
          .MISSING_TRACE_EVIDENCE_FINGERPRINT,
      }),
    ]));
  });

  test('passes the default runtime question reduction audit', () => {
    const plan = buildQuestionReductionPlanForTest({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.6 },
        ],
      },
    });
    const audit = buildPolicyRuntimeQuestionReductionAudit(plan);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedDispositionCount).toBe(7);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'request_time_learning',
      label: 'Request-Time Learning And Destination Selection',
    }));
  });
});
