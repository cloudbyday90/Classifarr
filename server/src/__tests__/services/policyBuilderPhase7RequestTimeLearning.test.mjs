import {
  ANSWER_OUTCOME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  PHASE6R_LEARNING_DECISION_IDS,
  PHASE6R_LEARNING_EVENT_SOURCE_IDS,
  PHASE6R_LEARNING_REASON_IDS,
  PHASE6R_LEARNING_TIER_IDS,
} from '../../services/policyBuilderPhase6LearningGuard.mjs';
import {
  buildPolicyBuilderPhase7RuntimeQuestionReduction,
} from '../../services/policyBuilderPhase7RuntimeQuestionReduction.mjs';
import {
  PHASE7R_REQUEST_EVENT_TYPE_IDS,
  PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS,
  PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS,
  PHASE7R_REQUEST_LEARNING_REASON_IDS,
  buildPolicyBuilderPhase7RequestTimeLearningAudit,
  buildPolicyBuilderPhase7RequestTimeLearningDecision,
  validatePolicyBuilderPhase7RequestTimeLearningDecision,
} from '../../services/policyBuilderPhase7RequestTimeLearning.mjs';

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
  return buildPolicyBuilderPhase7RuntimeQuestionReduction({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animation', count: 2, confidence: 0.8 },
      ],
    },
    ...overrides,
  });
}

function buildRequestTimeLearningDecision(input = {}) {
  const plan = input.questionReductionPlan || questionReductionPlan();

  return buildPolicyBuilderPhase7RequestTimeLearningDecision({
    questionReductionPlan: plan,
    ...input,
  });
}

describe('policyBuilderPhase7RequestTimeLearning', () => {
  test('records user-requested destination separately from final outcome without durable learning', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      item: {
        itemId: 10674,
        title: 'Mulan',
      },
      requestedDestination: destination(),
    });

    expect(decision.sourceId).toBe(PHASE6R_LEARNING_EVENT_SOURCE_IDS.REQUEST_DESTINATION_CHOICE);
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
      decisionId: PHASE6R_LEARNING_DECISION_IDS.OUTCOME_ONLY,
      tierId: PHASE6R_LEARNING_TIER_IDS.NONE,
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
      version: 'phase7r.runtime_question_reduction.v1',
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
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('passes operator manual destination changes through the learning guard and marks them reversible', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
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

    expect(decision.sourceId).toBe(PHASE6R_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE);
    expect(decision.selection.operatorSelectedDestination).toEqual(expect.objectContaining({
      libraryId: 6,
      libraryName: 'Animated Movies',
    }));
    expect(decision.audit).toEqual(expect.objectContaining({
      reversible: true,
      actorId: 'admin-1',
    }));
    expect(decision.learningDecision.learning).toEqual(expect.objectContaining({
      decisionId: PHASE6R_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      canWriteLearning: true,
    }));
    expect(decision.dispositionId).toBe(PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE);
    expect(decision.profileRefresh).toEqual(expect.objectContaining({
      queue: true,
      queuedByLearningGuard: true,
    }));
    expect(decision.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REQUEST_LEARNING_REASON_IDS.PROFILE_REFRESH_QUEUED_BY_GUARD,
      }),
    ]));
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('records successful Arr routing as final outcome without direct learning', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
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

    expect(decision.sourceId).toBe(PHASE6R_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME);
    expect(decision.finalOutcome.status).toBe('routed');
    expect(decision.finalOutcome.route).toEqual(expect.objectContaining({
      attempted: true,
      succeeded: true,
      missingMapping: false,
    }));
    expect(decision.learningDecision.learning.canWriteLearning).toBe(false);
    expect(decision.profileRefresh.queue).toBe(false);
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('records failed route mapping as route failure only and not positive destination evidence', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
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

    expect(decision.dispositionId).toBe(PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.ROUTE_FAILURE_ONLY);
    expect(decision.finalOutcome).toEqual(expect.objectContaining({
      status: 'route_failed_missing_mapping',
      route: expect.objectContaining({
        attempted: true,
        succeeded: false,
        missingMapping: true,
      }),
    }));
    expect(decision.learningDecision.learning).toEqual(expect.objectContaining({
      decisionId: PHASE6R_LEARNING_DECISION_IDS.OUTCOME_ONLY,
      canWriteLearning: false,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
    expect(decision.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REQUEST_LEARNING_REASON_IDS.ROUTE_FAILURE_NOT_EVIDENCE,
      }),
    ]));
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('blocks learning when the upstream question is stale or rejected', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      operatorDestination: destination(),
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      question: {
        frameId: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
        stale: true,
      },
      candidate: {
        key: 'genre:animation',
        label: 'Animation',
        signalType: 'genre',
        evidenceCount: 1,
      },
    });

    expect(decision.learningDecision.learning).toEqual(expect.objectContaining({
      decisionId: PHASE6R_LEARNING_DECISION_IDS.BLOCKED,
      canWriteLearning: false,
    }));
    expect(decision.learningDecision.learning.blockedReasonCodes).toEqual(expect.arrayContaining([
      PHASE6R_LEARNING_REASON_IDS.REJECTED_QUESTION_FRAME_BLOCKED,
      PHASE6R_LEARNING_REASON_IDS.STALE_QUESTION_BLOCKED,
      PHASE6R_LEARNING_REASON_IDS.BROAD_ONE_OFF_GENRE_BLOCKED,
    ]));
    expect(decision.dispositionId).toBe(PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.BLOCKED);
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('rejects route failures or routing outcomes that claim learning writes', () => {
    const routeFailure = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
      finalDestination: destination(),
    });
    routeFailure.learningDecision.learning.canWriteLearning = true;
    routeFailure.profileRefresh.queue = true;

    const routeSuccess = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      finalDestination: destination(),
    });
    routeSuccess.learningDecision.learning.canWriteLearning = true;

    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(routeFailure).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_FAILURE_WRITES_LEARNING,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_OUTCOME_WRITES_LEARNING,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(routeSuccess).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_OUTCOME_WRITES_LEARNING,
        }),
      ]));
  });

  test('rejects direct side effects and non-reversible manual changes', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      operatorDestination: destination(),
    });
    decision.audit.reversible = false;
    decision.sideEffects.learningWritten = true;

    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MANUAL_CHANGE_NOT_REVERSIBLE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.DIRECT_SIDE_EFFECT,
        }),
      ]));
  });

  test('rejects request-time learning with missing or mismatched evidence fingerprints', () => {
    const missing = buildPolicyBuilderPhase7RequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const mismatched = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });

    mismatched.learningGuardContext.upstreamEvidenceFingerprint.fingerprint = 'b'.repeat(64);
    mismatched.trace.attributes['classifarr.runtime.request_learning.upstream_evidence_fingerprint'] =
      'c'.repeat(64);

    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(missing).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_UPSTREAM_EVIDENCE_FINGERPRINT,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(mismatched).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.LEARNING_GUARD_FINGERPRINT_MISMATCH,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
        }),
      ]));
  });

  test('rejects request-time learning without question-reduction validation proof', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });

    decision.questionReductionProof = null;

    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_QUESTION_REDUCTION_VALIDATION,
        }),
      ]));
  });

  test('rejects request-time learning with invalid or drifted question-reduction proof', () => {
    const invalid = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const drifted = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const missingProofFingerprint = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const traceDrift = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });

    invalid.questionReductionProof.validation.ok = false;
    invalid.questionReductionProof.validation.issueCount = 1;
    drifted.questionReductionProof.evidenceFingerprint.fingerprint = 'd'.repeat(64);
    drifted.questionReductionProof.traceEvidenceFingerprint = 'e'.repeat(64);
    missingProofFingerprint.questionReductionProof.evidenceFingerprint = null;
    missingProofFingerprint.questionReductionProof.traceEvidenceFingerprint = null;
    traceDrift.trace.attributes['classifarr.runtime.request_learning.question_reduction_valid'] = false;

    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(invalid).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.INVALID_QUESTION_REDUCTION,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_QUESTION_REDUCTION_VALID_MISMATCH,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(drifted).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(missingProofFingerprint).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(traceDrift).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_QUESTION_REDUCTION_VALID_MISMATCH,
        }),
      ]));
  });

  test('passes the default request-time learning audit', () => {
    const decision = buildRequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
      requestedDestination: destination(),
    });
    const audit = buildPolicyBuilderPhase7RequestTimeLearningAudit(decision);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedEventTypeCount).toBe(4);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_6',
      label: 'Library-Derived Policy Rebuild',
    }));
  });
});
