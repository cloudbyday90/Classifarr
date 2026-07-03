import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';
import {
  POLICY_INTENT_WARNING_IDS,
  buildPolicyIntentDraft,
  buildPolicyIntentDraftFromBoundedEvidence,
} from '../../services/policyIntentEngine.mjs';
import {
  PHASE6R_LEARNING_DECISION_IDS,
  PHASE6R_LEARNING_TIER_IDS,
  buildPolicyBuilderPhase6LearningDecision,
  buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent,
} from '../../services/policyBuilderPhase6LearningGuard.mjs';
import {
  PHASE6R_READINESS_AUDIT_RISK_IDS,
  PHASE6R_READINESS_BOUNDARY_STATUS_IDS,
  PHASE6R_READINESS_REASON_IDS,
  PHASE6R_READINESS_STATE_IDS,
  buildPolicyBuilderPhase6Readiness,
  buildPolicyBuilderPhase6ReadinessFromBoundedContracts,
  buildPolicyBuilderPhase6ReadinessEngineAudit,
  getReadinessState,
  listPolicyBuilderPhase6ReadinessStates,
  validatePolicyBuilderPhase6Readiness,
} from '../../services/policyBuilderPhase6ReadinessEngine.mjs';

function buildReadyInput(overrides = {}) {
  return {
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
  const boundedLearningResult = buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent({
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

describe('policyBuilderPhase6ReadinessEngine', () => {
  test('defines the explicit readiness states in roadmap order', () => {
    expect(listPolicyBuilderPhase6ReadinessStates().map(state => state.id)).toEqual([
      PHASE6R_READINESS_STATE_IDS.READY,
      PHASE6R_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      PHASE6R_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING,
      PHASE6R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      PHASE6R_READINESS_STATE_IDS.STALE_PROFILE,
    ]);

    expect(getReadinessState(PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING))
      .toEqual(expect.objectContaining({
        label: 'Needs routing',
        defaultActionId: 'configure_routing',
      }));
  });

  test('defaults to needs-more-examples when destination identity is missing', () => {
    const readiness = buildPolicyBuilderPhase6Readiness();

    expect(readiness).toEqual(expect.objectContaining({
      version: 'phase6r.readiness.v1',
      stateId: PHASE6R_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      ready: false,
    }));
    expect(readiness.reasonCodes).toContain(
      PHASE6R_READINESS_REASON_IDS.MISSING_IDENTITY_EVIDENCE
    );
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'add_destination_examples',
      target: 'belongs_here',
    }));
  });

  test('returns ready when identity and routing are present with no review blockers', () => {
    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput());

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.READY);
    expect(readiness.ready).toBe(true);
    expect(readiness.issues).toEqual([]);
    expect(readiness.reasonCodes).toEqual([
      PHASE6R_READINESS_REASON_IDS.READY_FOR_AUTOMATION,
      PHASE6R_READINESS_REASON_IDS.HAS_IDENTITY_AND_ROUTING,
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

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextPhase: expect.objectContaining({
        phaseId: '6r_5',
      }),
    }));
    expect(result.readiness).toEqual(expect.objectContaining({
      stateId: PHASE6R_READINESS_STATE_IDS.READY,
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

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
    expect(result.readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.STALE_PROFILE);
    expect(result.readiness.reasonCodes).toContain(
      PHASE6R_READINESS_REASON_IDS.PROFILE_REFRESH_QUEUED
    );
  });

  test('blocks bounded readiness when bounded quality is missing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
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

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
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

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded readiness when bounded inputs or provenance are missing', () => {
    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
          version: 'phase6r.learning_guard.v1',
        },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_EVIDENCE,
      }),
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_PROVENANCE,
      }),
    ]));
  });

  test('blocks bounded readiness when evidence audits are not passing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.BOUNDED_EVIDENCE_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded readiness when intent evidence audit is not passing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE6R_READINESS_AUDIT_RISK_IDS.BOUNDED_INTENT_EVIDENCE_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded readiness when learning audit is not passing', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.BOUNDED_LEARNING_AUDIT_NOT_PASSING,
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

    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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
      statusId: PHASE6R_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      readiness: null,
      readinessAudit: null,
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('prioritizes stale profile over all other readiness issues', () => {
    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      routing: {
        configured: false,
        routeReady: false,
      },
    }));

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.STALE_PROFILE);
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'refresh_profile',
      target: 'profile_refresh',
    }));
  });

  test('treats queued profile refresh from learning as stale profile readiness', () => {
    const learningDecision = buildPolicyBuilderPhase6LearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:disney',
        label: 'Disney',
        signalType: 'studio',
        evidenceCount: 4,
      },
    });

    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      learningDecision,
    }));

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.STALE_PROFILE);
    expect(readiness.reasonCodes).toContain(
      PHASE6R_READINESS_REASON_IDS.PROFILE_REFRESH_QUEUED
    );
  });

  test('blocks automation when a hard-limit policy edit is required', () => {
    const learningDecision = buildPolicyBuilderPhase6LearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE,
      answer: { label: 'Block NC-17' },
      candidate: {
        key: 'rating:nc17',
        label: 'NC-17',
        signalType: 'certification',
        evidenceCount: 3,
      },
    });

    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      learningDecision,
    }));

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT);
    expect(readiness.reasonCodes).toContain(
      PHASE6R_READINESS_REASON_IDS.LEARNING_POLICY_EDIT_REQUIRED
    );
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'edit_hard_limit',
      target: 'hard_limits',
    }));
  });

  test('does not block automation merely because a configured hard limit exists', () => {
    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        hardLimits: ['No NC-17'],
        routingTargets: ['Radarr Animated Movies'],
      },
    }));

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.READY);
  });

  test('requires operator review for ask-when evidence and non-info intent warnings', () => {
    const intent = buildPolicyIntentDraft({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        routingTargets: ['Radarr Animated Movies'],
      },
    });
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

    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      intentDraft: intent,
    }));

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW);
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'review_destination_intent',
      target: 'ask_when',
    }));
  });

  test('requires operator review when the learning guard blocks learning', () => {
    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      learningDecision: {
        version: 'phase6r.learning_guard.v1',
        learning: {
          decisionId: PHASE6R_LEARNING_DECISION_IDS.BLOCKED,
          tierId: PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
          blockedReasonCodes: ['stale_question_blocked'],
          writesPerformed: false,
        },
        profileRefresh: {
          queue: false,
          reasonCodes: [],
        },
      },
    }));

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW);
    expect(readiness.reasonCodes).toContain(
      PHASE6R_READINESS_REASON_IDS.LEARNING_BLOCKED
    );
  });

  test('requires routing after identity is known but no routing target is available', () => {
    const readiness = buildPolicyBuilderPhase6Readiness({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
      routing: {
        configured: false,
        routeReady: false,
      },
    });

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING);
    expect(readiness.nextAction).toEqual(expect.objectContaining({
      actionId: 'configure_routing',
      target: 'routing_target',
    }));
  });

  test('ignores legacy diagnostic inputs instead of making them readiness gates', () => {
    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      providerReadiness: { state: 'limited' },
      replayParity: { state: 'different' },
      tmdbCoverage: { state: 'partial' },
      rawScoringPanel: { score: 0.74 },
    }));

    expect(readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.READY);
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
    const audit = buildPolicyBuilderPhase6ReadinessEngineAudit(
      buildPolicyBuilderPhase6Readiness(buildReadyInput())
    );

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedStateCount).toBe(6);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '6r_5',
      label: 'Operator Workflow Rebuild',
    }));
  });

  test('rejects readiness boundary context that drops bounded quality', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    } = buildBoundedReadyInputs();
    const result = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
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

    expect(validatePolicyBuilderPhase6Readiness(tamperedReadiness).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
        }),
      ]));
  });

  test('rejects readiness contracts that depend on live diagnostics or miss actions', () => {
    const invalidReadiness = buildPolicyBuilderPhase6Readiness(buildReadyInput());
    invalidReadiness.nextAction = null;
    invalidReadiness.ready = false;
    invalidReadiness.inputs.liveProviderLookupPerformed = true;
    invalidReadiness.inputs.exposesRawPayload = true;
    invalidReadiness.inputs.diagnosticDependencies = ['tmdbCoverage'];

    expect(validatePolicyBuilderPhase6Readiness(invalidReadiness).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.MISSING_NEXT_ACTION,
        }),
        expect.objectContaining({
          riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.READY_STATE_MISMATCH,
        }),
        expect.objectContaining({
          riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.LIVE_PROVIDER_DEPENDENCY,
        }),
        expect.objectContaining({
          riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.RAW_PAYLOAD_DEPENDENCY,
        }),
        expect.objectContaining({
          riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.DIAGNOSTIC_DEPENDENCY,
        }),
      ]));
  });

  test('rejects readiness derived from a learning decision that already wrote', () => {
    const readiness = buildPolicyBuilderPhase6Readiness(buildReadyInput({
      learningDecision: {
        version: 'phase6r.learning_guard.v1',
        learning: {
          decisionId: PHASE6R_LEARNING_DECISION_IDS.CANDIDATE,
          tierId: PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
          writesPerformed: true,
        },
        profileRefresh: {
          queue: false,
          reasonCodes: [],
        },
      },
    }));

    expect(readiness.inputs.learningWritesPerformed).toBe(true);
    expect(validatePolicyBuilderPhase6Readiness(readiness).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_READINESS_AUDIT_RISK_IDS.LEARNING_WRITE_DEPENDENCY,
        }),
      ]));
  });
});
