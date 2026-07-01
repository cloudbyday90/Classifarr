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

describe('policyBuilderPhase7RequestTimeLearning', () => {
  test('records user-requested destination separately from final outcome without durable learning', () => {
    const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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
    expect(decision.profileRefresh.queue).toBe(false);
    expect(validatePolicyBuilderPhase7RequestTimeLearningDecision(decision).ok).toBe(true);
  });

  test('passes operator manual destination changes through the learning guard and marks them reversible', () => {
    const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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
    const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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
    const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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
    const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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
    const routeFailure = buildPolicyBuilderPhase7RequestTimeLearningDecision({
      eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
      finalDestination: destination(),
    });
    routeFailure.learningDecision.learning.canWriteLearning = true;
    routeFailure.profileRefresh.queue = true;

    const routeSuccess = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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
    const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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

  test('passes the default request-time learning audit', () => {
    const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
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
