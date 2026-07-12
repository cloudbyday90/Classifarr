import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';
import {
  buildPolicyEvidenceProjection,
} from '../../services/policyEvidenceEngine.mjs';
import {
  POLICY_INTENT_WARNING_IDS,
  buildPolicyIntentDraftFromBoundedEvidence,
  buildPolicyIntentDraftFromEvidenceProjection,
} from '../../services/policyIntentEngine.mjs';
import {
  POLICY_LEARNING_DECISION_IDS,
  POLICY_LEARNING_TIER_IDS,
  buildPolicyLearningDecision,
  buildPolicyLearningDecisionFromBoundedIntent,
} from '../../services/policyLearningGuard.mjs';
import {
  POLICY_DECISION_HANDOFF_SOURCE_IDS,
} from '../../services/policyDecisionHandoffSource.mjs';
import {
  POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS,
  POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS,
  POLICY_AUTOMATION_READINESS_REASON_IDS,
  POLICY_AUTOMATION_READINESS_STATE_IDS,
  buildPolicyAutomationReadinessFromContracts,
  buildPolicyAutomationReadinessFromBoundedContracts,
  buildPolicyAutomationReadinessEngineAudit,
  getPolicyAutomationReadinessState,
  listPolicyAutomationReadinessStates,
  validatePolicyAutomationReadiness,
} from '../../services/policyAutomationReadinessEngine.mjs';

function buildReadyInput(overrides = {}) {
  const source = {
    operatorIntent: {
      belongsHere: ['Animated Movies'],
      routingTargets: ['Radarr Animated Movies'],
    },
    routing: {
      configured: true,
      routeReady: true,
      targetName: 'Radarr Animated Movies',
    },
    ...overrides,
  };
  const {
    operatorIntent,
    libraryProfile,
    classificationOutcomes,
    manualCorrections,
    pendingItemAnswers,
    arrRoutingOutcomes,
    metadataEvidence,
    evidenceProjection: suppliedEvidenceProjection,
    intentDraft: suppliedIntentDraft,
    intent: suppliedIntent,
    ...contractInput
  } = source;
  const evidenceProjection = suppliedEvidenceProjection || buildPolicyEvidenceProjection({
    operatorIntent,
    libraryProfile,
    classificationOutcomes,
    manualCorrections,
    pendingItemAnswers,
    arrRoutingOutcomes,
    metadataEvidence,
    profileFreshness: contractInput.profileFreshness,
  });

  return {
    ...contractInput,
    evidenceProjection,
    intentDraft: suppliedIntentDraft || suppliedIntent ||
      buildPolicyIntentDraftFromEvidenceProjection(evidenceProjection),
  };
}

function buildBoundedReadyInputs({
  learningInput = {},
  evidenceInput = {},
} = {}) {
  const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        routingTargets: ['Radarr Animated Movies'],
      },
      ...evidenceInput,
    },
  });
  const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
  const boundedLearningResult = buildPolicyLearningDecisionFromBoundedIntent({
    boundedIntentResult,
    learningInput: {
      answerOutcomeId: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
      answer: {
        label: 'Animated Movies',
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
      },
      finalOutcome: {
        itemId: 10674,
        status: 'resolved',
      },
      ...learningInput,
    },
  });

  return {
    boundedEvidenceResult,
    boundedIntentResult,
    boundedLearningResult,
  };
}

describe('policyAutomationReadinessEngine', () => {
  test('defines the explicit readiness states in roadmap order', () => {
    expect(listPolicyAutomationReadinessStates().map(state => state.id)).toEqual([
      POLICY_AUTOMATION_READINESS_STATE_IDS.READY,
      POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING,
      POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE,
    ]);

    expect(getPolicyAutomationReadinessState(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING))
      .toEqual(expect.objectContaining({
        label: 'Needs routing',
        defaultActionId: 'configure_routing',
      }));
  });

  test('defaults to needs-more-examples when destination identity is missing', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts();

    expect(readiness).toEqual(expect.objectContaining({
      version: 'policy.automation_readiness.v1',
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      ready: false,
    }));
    expect(readiness.reasonCodes).toContain(
      POLICY_AUTOMATION_READINESS_REASON_IDS.MISSING_IDENTITY_EVIDENCE
    );
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'add_destination_examples',
      target: 'belongs_here',
    }));
  });

  test('requires bounded contracts instead of raw evidence input', () => {
    expect(() => buildPolicyAutomationReadinessFromContracts({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
    })).toThrow('raw evidence key "operatorIntent"');

    expect(() => buildPolicyAutomationReadinessFromContracts({
      evidenceProjection: {
        version: 'unsupported.evidence.v1',
      },
    })).toThrow('requires a policy.evidence.v1 evidence projection');
  });

  test('returns ready when identity and routing are present with no review blockers', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput());

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.READY);
    expect(readiness.ready).toBe(true);
    expect(readiness.issues).toEqual([]);
    expect(readiness.reasonCodes).toEqual([
      POLICY_AUTOMATION_READINESS_REASON_IDS.READY_FOR_AUTOMATION,
      POLICY_AUTOMATION_READINESS_REASON_IDS.HAS_IDENTITY_AND_ROUTING,
    ]);
    expect(readiness.inputs).toEqual(expect.objectContaining({
      usesCachedStateOnly: true,
      liveProviderLookupPerformed: false,
      diagnosticDependencies: [],
    }));
  });

  test('builds bounded readiness from bounded evidence, intent, and learning', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextStep: expect.objectContaining({
        stepId: 'operator_workflow',
      }),
    }));
    expect(result.readiness).toEqual(expect.objectContaining({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.READY,
      ready: true,
    }));
    expect(result.boundaryContext).toEqual(expect.objectContaining({
      projectionFingerprintMatch: true,
      evidenceBoundary: expect.objectContaining({
        quality: expect.objectContaining({
          statusId: boundedEvidenceResult.projection.quality.statusId,
          nextActionId: boundedEvidenceResult.projection.quality.nextActionId,
          reasonIds: boundedEvidenceResult.projection.quality.reasonIds,
        }),
        projectionFingerprint: expect.objectContaining({
          fingerprint: boundedEvidenceResult.projectionFingerprint.fingerprint,
        }),
      }),
      intentBoundary: expect.objectContaining({
        quality: expect.objectContaining({
          statusId: boundedIntentResult.evidenceBoundary.quality.statusId,
        }),
        projectionFingerprint: expect.objectContaining({
          fingerprint: boundedEvidenceResult.projectionFingerprint.fingerprint,
        }),
      }),
      learningBoundary: expect.objectContaining({
        decisionSource: {
          sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
          decisionVersion: 'policy.learning_guard.v1',
          admitted: true,
        },
        quality: expect.objectContaining({
          statusId: boundedLearningResult.intentBoundary.evidenceBoundary.quality.statusId,
        }),
        projectionFingerprint: expect.objectContaining({
          fingerprint: boundedEvidenceResult.projectionFingerprint.fingerprint,
        }),
      }),
    }));
    expect(result.readiness.inputs.boundaryContext).toEqual(result.boundaryContext);
    expect(JSON.stringify(result.boundaryContext)).not.toContain('Animated Movies');
  });

  test('bounded readiness reflects bounded learning profile-refresh outcomes', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs({
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
        candidate: {
          key: 'studio:pixar',
          label: 'Pixar',
          signalType: 'studio',
          destinationLibraryId: 6,
          destinationLibraryName: 'Animated Movies',
          evidenceCount: 8,
        },
      },
    });

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE);
    expect(result.readiness.reasonCodes).toContain(
      POLICY_AUTOMATION_READINESS_REASON_IDS.PROFILE_REFRESH_QUEUED
    );
  });

  test('blocks bounded readiness when bounded quality is missing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult: {
        ...boundedIntentResult,
        evidenceBoundary: {
          ...boundedIntentResult.evidenceBoundary,
          quality: null,
        },
      },
      boundedLearningResult,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
      }),
    ]));
  });

  test('blocks bounded readiness when bounded quality is insufficient', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();
    const insufficientQuality = {
      ...boundedEvidenceResult.projection.quality,
      statusId: 'insufficient',
      nextActionId: 'confirm_destination_identity',
      reasonIds: ['missing_identity_evidence'],
    };

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult: {
        ...boundedEvidenceResult,
        projection: {
          ...boundedEvidenceResult.projection,
          quality: insufficientQuality,
        },
      },
      boundedIntentResult: {
        ...boundedIntentResult,
        evidenceBoundary: {
          ...boundedIntentResult.evidenceBoundary,
          quality: insufficientQuality,
        },
      },
      boundedLearningResult: {
        ...boundedLearningResult,
        intentBoundary: {
          ...boundedLearningResult.intentBoundary,
          evidenceBoundary: {
            ...boundedLearningResult.intentBoundary.evidenceBoundary,
            quality: insufficientQuality,
          },
        },
      },
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
        nextActionId: 'confirm_destination_identity',
      }),
    ]));
  });

  test('blocks bounded readiness when bounded quality does not match', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();
    const mismatchedLearningResult = {
      ...boundedLearningResult,
      intentBoundary: {
        ...boundedLearningResult.intentBoundary,
        evidenceBoundary: {
          ...boundedLearningResult.intentBoundary.evidenceBoundary,
          quality: {
            ...boundedLearningResult.intentBoundary.evidenceBoundary.quality,
            nextActionId: 'refresh_profile_examples',
          },
        },
      },
    };

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult: mismatchedLearningResult,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded readiness when bounded inputs or provenance are missing', () => {
    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult: {
        ok: false,
      },
      boundedIntentResult: {
        ok: true,
        intent: {
          version: 'policy.intent.v1',
        },
      },
      boundedLearningResult: {
        ok: true,
        decision: {
          version: 'policy.learning_guard.v1',
        },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_EVIDENCE,
      }),
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_PROVENANCE,
      }),
    ]));
  });

  test('blocks bounded readiness when evidence audits are not passing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult: {
        ...boundedEvidenceResult,
        projectionFingerprintAudit: {
          ok: false,
          issues: [{ riskId: 'fingerprint_mismatch' }],
        },
      },
      boundedIntentResult,
      boundedLearningResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_EVIDENCE_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded readiness when intent evidence audit is not passing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult: {
        ...boundedIntentResult,
        evidenceFingerprintAudit: {
          ok: false,
          issues: [{ riskId: 'fingerprint_mismatch' }],
        },
      },
      boundedLearningResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_INTENT_EVIDENCE_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded readiness when learning audit is not passing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult: {
        ...boundedLearningResult,
        learningAudit: {
          ok: false,
          issues: [{ riskId: 'direct_write_performed' }],
        },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_LEARNING_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded readiness when the decision handoff source is missing or invalid', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const missingSourceResult = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult: {
        ...boundedLearningResult,
        decisionSource: null,
      },
    });

    expect(missingSourceResult).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      decisionSourceAdmission: expect.objectContaining({ ok: false }),
    }));
    expect(missingSourceResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.UNAPPROVED_BOUNDED_DECISION_SOURCE,
      }),
    ]));

    const invalidSourceResult = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult: {
        ...boundedLearningResult,
        decisionSource: {
          ...boundedLearningResult.decisionSource,
          sourceId: 'unapproved_source',
        },
      },
    });

    expect(invalidSourceResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.UNAPPROVED_BOUNDED_DECISION_SOURCE,
        sourceRiskIds: expect.arrayContaining(['unsupported_source']),
      }),
    ]));
  });

  test('blocks bounded readiness when bounded provenance does not match', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();
    const mismatchedLearningResult = {
      ...boundedLearningResult,
      intentBoundary: {
        ...boundedLearningResult.intentBoundary,
        evidenceBoundary: {
          ...boundedLearningResult.intentBoundary.evidenceBoundary,
          projectionFingerprint: {
            ...boundedLearningResult.intentBoundary.evidenceBoundary.projectionFingerprint,
            fingerprint: 'f'.repeat(64),
          },
        },
      },
    };

    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult: mismatchedLearningResult,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('prioritizes stale profile over all other readiness issues', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      routing: {
        configured: false,
        routeReady: false,
      },
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE);
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'refresh_profile',
      target: 'profile_refresh',
    }));
  });

  test('treats queued profile refresh from learning as stale profile readiness', () => {
    const learningDecision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:disney',
        label: 'Disney',
        signalType: 'studio',
        evidenceCount: 4,
      },
    });

    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      learningDecision,
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE);
    expect(readiness.reasonCodes).toContain(
      POLICY_AUTOMATION_READINESS_REASON_IDS.PROFILE_REFRESH_QUEUED
    );
  });

  test('blocks automation when a hard-limit policy edit is required', () => {
    const learningDecision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE,
      answer: { label: 'Block NC-17' },
      candidate: {
        key: 'rating:nc17',
        label: 'NC-17',
        signalType: 'certification',
        evidenceCount: 3,
      },
    });

    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      learningDecision,
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT);
    expect(readiness.reasonCodes).toContain(
      POLICY_AUTOMATION_READINESS_REASON_IDS.LEARNING_POLICY_EDIT_REQUIRED
    );
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'edit_hard_limit',
      target: 'hard_limits',
    }));
  });

  test('does not block automation merely because a configured hard limit exists', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        hardLimits: ['No NC-17'],
        routingTargets: ['Radarr Animated Movies'],
      },
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.READY);
  });

  test('requires operator review for ask-when evidence and non-info intent warnings', () => {
    const intent = buildPolicyIntentDraftFromEvidenceProjection(buildPolicyEvidenceProjection({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        routingTargets: ['Radarr Animated Movies'],
      },
    }));
    intent.ask_when.push({
      fieldId: 'ask_when',
      key: 'outlier:runtime',
      label: 'Runtime outlier',
      reasonCode: 'outlier_needs_review',
    });
    intent.warnings.push({
      reasonCode: POLICY_INTENT_WARNING_IDS.INSUFFICIENT_EVIDENCE,
      severity: 'warning',
      summary: 'Some evidence is insufficient.',
    });

    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      intentDraft: intent,
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW);
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'review_destination_intent',
      target: 'ask_when',
    }));
  });

  test('requires operator review when the learning guard blocks learning', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      learningDecision: {
        version: 'policy.learning_guard.v1',
        learning: {
          decisionId: POLICY_LEARNING_DECISION_IDS.BLOCKED,
          tierId: POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
          blockedReasonCodes: ['stale_question_blocked'],
          writesPerformed: false,
        },
        profileRefresh: {
          queue: false,
          reasonCodes: [],
        },
      },
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW);
    expect(readiness.reasonCodes).toContain(
      POLICY_AUTOMATION_READINESS_REASON_IDS.LEARNING_BLOCKED
    );
  });

  test('requires routing after identity is known but no routing target is available', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
      routing: {
        configured: false,
        routeReady: false,
      },
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING);
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'configure_routing',
      target: 'routing_target',
    }));
  });

  test('treats malformed operational input as conservative readiness without exposing configuration', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      routing: {
        configured: 'true',
        routeReady: true,
        targetName: 'Radarr\r\nAnimated Movies',
        apiKey: 'must-not-escape',
        url: 'http://radarr.internal',
      },
      profileFreshness: { stale: 'false' },
      hardLimitConflict: 'false',
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE);
    expect(readiness.inputs.readinessInput).toEqual(expect.objectContaining({
      routingStateInvalid: true,
      profileStale: true,
      profileFreshnessInvalid: true,
      hardLimitConflict: true,
      hardLimitConflictInvalid: true,
    }));
    expect(JSON.stringify(readiness)).not.toContain('must-not-escape');
    expect(JSON.stringify(readiness)).not.toContain('radarr.internal');
  });

  test('ignores legacy diagnostic inputs instead of making them readiness gates', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      providerReadiness: { state: 'limited' },
      replayParity: { state: 'different' },
      tmdbCoverage: { state: 'partial' },
      rawScoringPanel: { score: 0.74 },
    }));

    expect(readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.READY);
    expect(readiness.inputs.diagnosticDependencies).toEqual([]);
    expect(readiness.inputs.ignoredDiagnostics.map(diagnostic => diagnostic.key))
      .toEqual([
        'providerReadiness',
        'rawScoringPanel',
        'replayParity',
        'tmdbCoverage',
      ]);
  });

  test('passes the default readiness engine audit', () => {
    const audit = buildPolicyAutomationReadinessEngineAudit(
      buildPolicyAutomationReadinessFromContracts(buildReadyInput())
    );

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedStateCount).toBe(6);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'operator_workflow',
      label: 'Policy Operator Workflow',
    }));
  });

  test('rejects readiness boundary context that drops bounded quality', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();
    const result = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });
    const tamperedReadiness = {
      ...result.readiness,
      inputs: {
        ...result.readiness.inputs,
        boundaryContext: {
          ...result.readiness.inputs.boundaryContext,
          learningBoundary: {
            ...result.readiness.inputs.boundaryContext.learningBoundary,
            quality: null,
          },
        },
      },
    };

    expect(validatePolicyAutomationReadiness(tamperedReadiness).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
        }),
      ]));
  });

  test('rejects readiness contracts that depend on live diagnostics or miss actions', () => {
    const invalidReadiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput());
    invalidReadiness.nextAction = null;
    invalidReadiness.ready = false;
    invalidReadiness.inputs.liveProviderLookupPerformed = true;
    invalidReadiness.inputs.exposesRawPayload = true;
    invalidReadiness.inputs.diagnosticDependencies = ['tmdbCoverage'];

    expect(validatePolicyAutomationReadiness(invalidReadiness).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_NEXT_ACTION,
        }),
        expect.objectContaining({
          riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.READY_STATE_MISMATCH,
        }),
        expect.objectContaining({
          riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.LIVE_PROVIDER_DEPENDENCY,
        }),
        expect.objectContaining({
          riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.RAW_PAYLOAD_DEPENDENCY,
        }),
        expect.objectContaining({
          riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.DIAGNOSTIC_DEPENDENCY,
        }),
      ]));
  });

  test('rejects readiness derived from a learning decision that already wrote', () => {
    const readiness = buildPolicyAutomationReadinessFromContracts(buildReadyInput({
      learningDecision: {
        version: 'policy.learning_guard.v1',
        learning: {
          decisionId: POLICY_LEARNING_DECISION_IDS.CANDIDATE,
          tierId: POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
          writesPerformed: true,
        },
        profileRefresh: {
          queue: false,
          reasonCodes: [],
        },
      },
    }));

    expect(readiness.inputs.learningWritesPerformed).toBe(true);
    expect(validatePolicyAutomationReadiness(readiness).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.LEARNING_WRITE_DEPENDENCY,
        }),
      ]));
  });
});
