import {
  ANSWER_OUTCOME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  POLICY_LEARNING_DECISION_IDS,
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  POLICY_LEARNING_REASON_IDS,
  POLICY_LEARNING_TIER_IDS,
} from '../../services/policyLearningGuard.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
} from '../../services/policyRuntimeQuestionReduction.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS,
  POLICY_REQUEST_LEARNING_DISPOSITION_IDS,
  POLICY_REQUEST_LEARNING_REASON_IDS,
  buildPolicyRequestTimeLearningAudit,
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
  buildPolicyRequestTimeLearningDecisionFromRuntimeInput,
  validatePolicyRequestTimeLearningDecision,
} from '../../services/policyRequestTimeLearning.mjs';
import {
  buildPolicyRequestTimeEvent,
} from '../../services/policyRequestTimeEvent.mjs';

function destination(overrides = {}) {
  return {
    libraryId: 6,
    libraryName: 'Animated Movies',
    arrType: 'radarr',
    arrConfigId: 1,
    arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    ...overrides,
  };
}

function questionReductionPlan(overrides = {}) {
  return buildPolicyRuntimeQuestionReductionFromRuntimeInput({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animation', count: 2, confidence: 0.8 },
      ],
    },
    ...overrides,
  });
}

function buildRequestTimeLearningDecisionForTest(input = {}) {
  const { questionReductionPlan: plan = questionReductionPlan(), ...eventInput } = input;
  const requestEvent = buildPolicyRequestTimeEvent(eventInput);

  return buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
    questionReductionPlan: plan,
    requestEvent,
  });
}

describe('policyRequestTimeLearning', () => {
  test('records user-requested destination separately from final outcome without durable learning', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      item: {
        itemId: 10674,
        title: 'Mulan',
      },
      requestedDestination: destination(),
    });

    expect(decision.sourceId).toBe(POLICY_LEARNING_EVENT_SOURCE_IDS.REQUEST_DESTINATION_CHOICE);
    expect(decision.selection.requestDestinationChoice).toEqual(expect.objectContaining({
      libraryId: 6,
      libraryName: 'Animated Movies',
    }));
    expect(decision.selection.finalDestination).toEqual(expect.objectContaining({
      libraryId: 6,
    }));
    expect(decision.finalOutcome).toEqual(expect.objectContaining({
      recorded: true,
      itemId: 10674,
      status: 'resolved',
      destinationLibraryId: 6,
    }));
    expect(decision.finalOutcome).not.toBe(decision.selection.requestDestinationChoice);
    expect(decision.learningDecision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY,
      tierId: POLICY_LEARNING_TIER_IDS.NONE,
      canWriteLearning: false,
    }));
    expect(decision.upstreamEvidenceFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: decision.questionReductionProof.evidenceFingerprint.fingerprint,
    }));
    expect(decision.learningGuardContext.upstreamEvidenceFingerprint).toEqual({
      algorithm: 'sha256',
      fingerprint: decision.upstreamEvidenceFingerprint.fingerprint,
    });
    expect(decision.trace.attributes).toEqual(expect.objectContaining({
      'classifarr.runtime.request_learning.upstream_evidence_fingerprint':
        decision.upstreamEvidenceFingerprint.fingerprint,
      'classifarr.runtime.request_learning.question_reduction_valid': true,
    }));
    expect(decision.questionReductionProof).toEqual(expect.objectContaining({
      version: 'policy.runtime_question_reduction.v1',
      validation: {
        ok: true,
        issueCount: 0,
      },
      evidenceFingerprint: expect.objectContaining({
        fingerprint: decision.upstreamEvidenceFingerprint.fingerprint,
      }),
      traceEvidenceFingerprint: decision.upstreamEvidenceFingerprint.fingerprint,
    }));
    expect(JSON.stringify(decision.upstreamEvidenceFingerprint)).not.toContain('Animated Movies');
    expect(decision.profileRefresh.queue).toBe(false);
    expect(validatePolicyRequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('requires explicit normalized event and clarification-plan contracts', () => {
    expect(() => buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
      questionReductionPlan: questionReductionPlan(),
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
    })).toThrow('raw input key "eventTypeId"');

    expect(() => buildPolicyRequestTimeLearningDecisionFromRuntimeInput({
      questionReductionPlan: questionReductionPlan(),
    })).toThrow('received a normalized upstream contract');

    expect(() => buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
      questionReductionPlan: {
        version: 'policy.runtime_question_reduction.v1',
      },
      requestEvent: buildPolicyRequestTimeEvent({
        eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      }),
    })).toThrow('requires a valid question-reduction plan');

    const decision = buildPolicyRequestTimeLearningDecisionFromRuntimeInput({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });

    expect(decision.questionReductionProof.validation.ok).toBe(true);
    expect(decision.upstreamEvidenceFingerprint.fingerprint)
      .toBe(decision.questionReductionProof.evidenceFingerprint.fingerprint);
  });

  test('passes operator manual destination changes through the learning guard and marks them reversible', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      actorId: 'admin-1',
      item: {
        itemId: 10674,
        title: 'Mulan',
      },
      operatorDestination: destination(),
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
      candidate: {
        key: 'studio:disney',
        label: 'Disney',
        signalType: 'studio',
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
        evidenceCount: 4,
      },
    });

    expect(decision.sourceId).toBe(POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE);
    expect(decision.selection.operatorSelectedDestination).toEqual(expect.objectContaining({
      libraryId: 6,
      libraryName: 'Animated Movies',
    }));
    expect(decision.audit).toEqual(expect.objectContaining({
      reversible: true,
      actorId: 'admin-1',
    }));
    expect(decision.learningDecision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      canWriteLearning: true,
    }));
    expect(decision.dispositionId).toBe(POLICY_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE);
    expect(decision.profileRefresh).toEqual(expect.objectContaining({
      queue: true,
      queuedByLearningGuard: true,
    }));
    expect(decision.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_REQUEST_LEARNING_REASON_IDS.PROFILE_REFRESH_QUEUED_BY_GUARD,
      }),
    ]));
    expect(validatePolicyRequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('records successful Arr routing as final outcome without direct learning', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      item: {
        itemId: 10674,
        title: 'Mulan',
      },
      finalDestination: destination(),
      routeResult: {
        routeId: 'radarr:10674',
        succeeded: true,
      },
    });

    expect(decision.sourceId).toBe(POLICY_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME);
    expect(decision.finalOutcome.status).toBe('routed');
    expect(decision.finalOutcome.route).toEqual(expect.objectContaining({
      attempted: true,
      succeeded: true,
      missingMapping: false,
    }));
    expect(decision.learningDecision.learning.canWriteLearning).toBe(false);
    expect(decision.profileRefresh.queue).toBe(false);
    expect(validatePolicyRequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('records failed route mapping as route failure only and not positive destination evidence', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
      item: {
        itemId: 10674,
        title: 'Mulan',
      },
      finalDestination: destination({
        arrRootFolderPath: '',
      }),
      routeResult: {
        missingMapping: true,
      },
    });

    expect(decision.dispositionId).toBe(POLICY_REQUEST_LEARNING_DISPOSITION_IDS.ROUTE_FAILURE_ONLY);
    expect(decision.finalOutcome).toEqual(expect.objectContaining({
      status: 'route_failed_missing_mapping',
      route: expect.objectContaining({
        attempted: true,
        succeeded: false,
        missingMapping: true,
      }),
    }));
    expect(decision.learningDecision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY,
      canWriteLearning: false,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
    expect(decision.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_REQUEST_LEARNING_REASON_IDS.ROUTE_FAILURE_NOT_EVIDENCE,
      }),
    ]));
    expect(validatePolicyRequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('blocks learning when the validated clarification plan is stale', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      operatorDestination: destination(),
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      questionReductionPlan: questionReductionPlan({
        existingQuestion: {
          id: 42,
          version: 'legacy.policy_question.v1',
          stale: true,
          frameId: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
        },
      }),
      candidate: {
        key: 'genre:animation',
        label: 'Animation',
        signalType: 'genre',
        evidenceCount: 1,
      },
    });

    expect(decision.learningDecision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.BLOCKED,
      canWriteLearning: false,
    }));
    expect(decision.learningDecision.learning.blockedReasonCodes).toEqual(expect.arrayContaining([
      POLICY_LEARNING_REASON_IDS.STALE_QUESTION_BLOCKED,
      POLICY_LEARNING_REASON_IDS.BROAD_ONE_OFF_GENRE_BLOCKED,
    ]));
    expect(decision.dispositionId).toBe(POLICY_REQUEST_LEARNING_DISPOSITION_IDS.BLOCKED);
    expect(validatePolicyRequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('rejects route failures or routing outcomes that claim learning writes', () => {
    const routeFailure = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
      finalDestination: destination(),
    });
    routeFailure.learningDecision.learning.canWriteLearning = true;
    routeFailure.profileRefresh.queue = true;

    const routeSuccess = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      finalDestination: destination(),
    });
    routeSuccess.learningDecision.learning.canWriteLearning = true;

    expect(validatePolicyRequestTimeLearningDecision(routeFailure).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_FAILURE_WRITES_LEARNING,
        }),
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_OUTCOME_WRITES_LEARNING,
        }),
      ]));
    expect(validatePolicyRequestTimeLearningDecision(routeSuccess).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_OUTCOME_WRITES_LEARNING,
        }),
      ]));
  });

  test('rejects direct side effects and non-reversible manual changes', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      operatorDestination: destination(),
    });
    decision.audit.reversible = false;
    decision.sideEffects.learningWritten = true;

    expect(validatePolicyRequestTimeLearningDecision(decision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MANUAL_CHANGE_NOT_REVERSIBLE,
        }),
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.DIRECT_SIDE_EFFECT,
        }),
      ]));
  });

  test('rejects request-time learning with missing or mismatched evidence fingerprints', () => {
    const missing = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const mismatched = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });

    missing.upstreamEvidenceFingerprint = null;
    missing.learningGuardContext.upstreamEvidenceFingerprint = null;
    missing.trace.attributes['classifarr.runtime.request_learning.upstream_evidence_fingerprint'] =
      undefined;
    mismatched.learningGuardContext.upstreamEvidenceFingerprint.fingerprint = 'b'.repeat(64);
    mismatched.trace.attributes['classifarr.runtime.request_learning.upstream_evidence_fingerprint'] =
      'c'.repeat(64);

    expect(validatePolicyRequestTimeLearningDecision(missing).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_UPSTREAM_EVIDENCE_FINGERPRINT,
        }),
      ]));
    expect(validatePolicyRequestTimeLearningDecision(mismatched).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.LEARNING_GUARD_FINGERPRINT_MISMATCH,
        }),
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
        }),
      ]));
  });

  test('rejects request-time learning without question-reduction validation proof', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });

    decision.questionReductionProof = null;

    expect(validatePolicyRequestTimeLearningDecision(decision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_QUESTION_REDUCTION_VALIDATION,
        }),
      ]));
  });

  test('rejects request-time learning with invalid or drifted question-reduction proof', () => {
    const invalid = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const drifted = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const missingProofFingerprint = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const traceDrift = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });

    invalid.questionReductionProof.validation.ok = false;
    invalid.questionReductionProof.validation.issueCount = 1;
    drifted.questionReductionProof.evidenceFingerprint.fingerprint = 'd'.repeat(64);
    drifted.questionReductionProof.traceEvidenceFingerprint = 'e'.repeat(64);
    missingProofFingerprint.questionReductionProof.evidenceFingerprint = null;
    missingProofFingerprint.questionReductionProof.traceEvidenceFingerprint = null;
    traceDrift.trace.attributes['classifarr.runtime.request_learning.question_reduction_valid'] = false;

    expect(validatePolicyRequestTimeLearningDecision(invalid).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.INVALID_QUESTION_REDUCTION,
        }),
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_QUESTION_REDUCTION_VALID_MISMATCH,
        }),
      ]));
    expect(validatePolicyRequestTimeLearningDecision(drifted).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
        }),
      ]));
    expect(validatePolicyRequestTimeLearningDecision(missingProofFingerprint).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
        }),
      ]));
    expect(validatePolicyRequestTimeLearningDecision(traceDrift).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_QUESTION_REDUCTION_VALID_MISMATCH,
        }),
      ]));
  });

  test('rejects altered request-time trace reasons, counts, and attributes', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      finalDestination: destination(),
      routeResult: { routeId: 'radarr:10674', succeeded: true },
    });

    decision.trace.reasons[0].summary = 'raw=do-not-leak';
    decision.trace.attributes['classifarr.runtime.request_learning.reason_count'] = 999;
    decision.trace.attributes['classifarr.runtime.request_learning.unbounded_context'] =
      'do-not-leak';

    expect(validatePolicyRequestTimeLearningDecision(decision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_CONTRACT_MISMATCH,
        }),
      ]));
  });

  test('passes the default request-time learning audit', () => {
    const decision = buildRequestTimeLearningDecisionForTest({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const audit = buildPolicyRequestTimeLearningAudit(decision);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedEventTypeCount).toBe(5);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'library_policy_rebuild',
      label: 'Library-Derived Policy Rebuild',
    }));
  });
});
