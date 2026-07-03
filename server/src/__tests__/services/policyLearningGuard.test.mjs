import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  ANSWER_OUTCOME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';
import {
  buildPolicyIntentDraftFromBoundedEvidence,
} from '../../services/policyIntentEngine.mjs';
import {
  POLICY_LEARNING_BOUNDARY_STATUS_IDS,
  POLICY_LEARNING_DECISION_IDS,
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  POLICY_LEARNING_GUARD_AUDIT_RISK_IDS,
  POLICY_LEARNING_REASON_IDS,
  POLICY_LEARNING_TIER_IDS,
  buildPolicyLearningDecision,
  buildPolicyLearningDecisionFromBoundedIntent,
  buildPolicyLearningGuardAudit,
  getPolicyLearningSource,
  getPolicyLearningTier,
  isBroadGenreCandidate,
  listPolicyLearningSources,
  listPolicyLearningTiers,
  validatePolicyLearningDecision,
} from '../../services/policyLearningGuard.mjs';

describe('policyLearningGuard', () => {
  test('defines the explicit learning tiers in roadmap order', () => {
    expect(listPolicyLearningTiers().map(tier => tier.id)).toEqual([
      POLICY_LEARNING_TIER_IDS.NONE,
      POLICY_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY,
      POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
      POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      POLICY_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE,
    ]);

    expect(getPolicyLearningTier(POLICY_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE))
      .toEqual(expect.objectContaining({
        canWriteLearning: false,
        destinationEvidenceChanging: true,
        requiresExplicitPolicyEdit: true,
      }));
  });

  test('defines all policy learning event sources as manual-outcome authority', () => {
    expect(listPolicyLearningSources().map(source => source.id)).toEqual([
      POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE,
      POLICY_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
      POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
      POLICY_LEARNING_EVENT_SOURCE_IDS.REQUEST_DESTINATION_CHOICE,
      POLICY_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
    ]);

    listPolicyLearningSources().forEach(source => {
      expect(source.authoritySourceId).toBe(AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME);
    });
    expect(getPolicyLearningSource(POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER)
      .label)
      .toBe('Discord pending answer');
  });

  test('records final outcome separately when no learning is requested', () => {
    const decision = buildPolicyLearningDecision({
      sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
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
    });

    expect(decision.finalOutcome).toEqual(expect.objectContaining({
      recorded: true,
      itemId: 10674,
      destinationLibraryId: 6,
      destinationLibraryName: 'Animated Movies',
    }));
    expect(decision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY,
      tierId: POLICY_LEARNING_TIER_IDS.NONE,
      canWriteLearning: false,
      writesPerformed: false,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
  });

  test('approves exact-item memory without changing destination profile evidence', () => {
    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.REMEMBER_EXACT_ITEM,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'tmdb:10674',
        label: 'Mulan',
        signalType: 'exact_item',
        evidenceCount: 1,
      },
    });

    expect(decision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: POLICY_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY,
      canWriteLearning: true,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
    expect(decision.learning.reasonCodes).toEqual(expect.arrayContaining([
      POLICY_LEARNING_REASON_IDS.EXACT_ITEM_MEMORY_CANDIDATE,
      POLICY_LEARNING_REASON_IDS.LEARNING_CANDIDATE_APPROVED,
    ]));
  });

  test('approves compatibility evidence from a Discord answer and queues profile refresh', () => {
    const decision = buildPolicyLearningDecision({
      sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:pixar',
        label: 'Pixar',
        signalType: 'studio',
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
        evidenceCount: 5,
      },
    });

    expect(decision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
      canWriteLearning: true,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    }));
    expect(decision.profileRefresh).toEqual({
      queue: true,
      reasonCodes: [POLICY_LEARNING_REASON_IDS.PROFILE_REFRESH_REQUIRED],
    });
  });

  test('builds bounded learning only from a successful bounded intent result', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        libraryProfile: {
          identityCandidates: [
            { key: 'studio:pixar', label: 'Pixar', count: 10 },
          ],
        },
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const result = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult,
      learningInput: {
        sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
        candidate: {
          key: 'studio:pixar',
          label: 'Pixar',
          signalType: 'studio',
          destinationLibraryId: 6,
          destinationLibraryName: 'Animated Movies',
          evidenceCount: 10,
        },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LEARNING_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextStep: expect.objectContaining({
        stepId: 'automation_readiness',
      }),
    }));
    expect(result.intentBoundary).toEqual(expect.objectContaining({
      statusId: boundedIntentResult.statusId,
      intentVersion: boundedIntentResult.intent.version,
      evidenceBoundary: expect.objectContaining({
        quality: expect.objectContaining({
          statusId: boundedIntentResult.intent.evidenceBoundary.quality.statusId,
          nextActionId: boundedIntentResult.intent.evidenceBoundary.quality.nextActionId,
          reasonIds: boundedIntentResult.intent.evidenceBoundary.quality.reasonIds,
        }),
        projectionFingerprint: expect.objectContaining({
          fingerprint: boundedEvidenceResult.projectionFingerprint.fingerprint,
        }),
      }),
    }));
    expect(result.decision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
      canWriteLearning: true,
    }));
    expect(JSON.stringify(result.intentBoundary)).not.toContain('Pixar');
    expect(result.learningAudit.ok).toBe(true);
  });

  test('blocks bounded learning when intent evidence quality is missing', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const result = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: {
        ...boundedIntentResult,
        evidenceBoundary: {
          ...boundedIntentResult.evidenceBoundary,
          quality: null,
        },
      },
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LEARNING_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      learningAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_INTENT_EVIDENCE_QUALITY,
      }),
    ]));
  });

  test('blocks bounded learning when intent evidence quality is insufficient', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const insufficientQuality = {
      ...boundedIntentResult.evidenceBoundary.quality,
      statusId: 'insufficient',
      nextActionId: 'confirm_destination_identity',
      reasonIds: ['missing_identity_evidence'],
    };
    const result = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: {
        ...boundedIntentResult,
        evidenceBoundary: {
          ...boundedIntentResult.evidenceBoundary,
          quality: insufficientQuality,
        },
        intent: {
          ...boundedIntentResult.intent,
          evidenceBoundary: {
            ...boundedIntentResult.intent.evidenceBoundary,
            quality: insufficientQuality,
          },
        },
      },
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LEARNING_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      learningAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.INSUFFICIENT_INTENT_EVIDENCE_QUALITY,
        nextActionId: 'confirm_destination_identity',
      }),
    ]));
  });

  test('blocks bounded learning when intent evidence quality differs from the wrapper', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const result = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: {
        ...boundedIntentResult,
        intent: {
          ...boundedIntentResult.intent,
          evidenceBoundary: {
            ...boundedIntentResult.intent.evidenceBoundary,
            quality: {
              ...boundedIntentResult.intent.evidenceBoundary.quality,
              nextActionId: 'refresh_profile_examples',
            },
          },
        },
      },
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LEARNING_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      learningAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.INTENT_EVIDENCE_QUALITY_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded learning when bounded intent evidence audit is not passing', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const result = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: {
        ...boundedIntentResult,
        evidenceFingerprintAudit: {
          ok: false,
          issues: [{ riskId: 'fingerprint_mismatch' }],
        },
      },
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LEARNING_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      learningAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_INTENT_EVIDENCE_AUDIT,
      }),
    ]));
  });

  test('blocks bounded learning when intent evidence fingerprint differs from the wrapper', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const tamperedIntentResult = {
      ...boundedIntentResult,
      intent: {
        ...boundedIntentResult.intent,
        evidenceBoundary: {
          ...boundedIntentResult.intent.evidenceBoundary,
          projectionFingerprint: {
            ...boundedIntentResult.intent.evidenceBoundary.projectionFingerprint,
            fingerprint: 'b'.repeat(64),
          },
        },
      },
    };
    const result = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: tamperedIntentResult,
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LEARNING_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      learningAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.INTENT_EVIDENCE_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded learning when bounded intent failed or lacks evidence fingerprint', () => {
    const blocked = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: {
        ok: false,
        intent: null,
      },
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
      },
    });

    expect(blocked).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LEARNING_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      learningAudit: null,
    }));
    expect(blocked.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_BOUNDED_INTENT,
      }),
      expect.objectContaining({
        riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_INTENT_EVIDENCE_FINGERPRINT,
      }),
    ]));

    const missingFingerprint = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: {
        ok: true,
        statusId: 'ready',
        intent: {
          version: 'policy.intent.v1',
          source: 'policy_bounded_evidence_boundary',
        },
        evidenceBoundary: {},
      },
    });

    expect(missingFingerprint.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_INTENT_EVIDENCE_FINGERPRINT,
      }),
    ]));
  });

  test('blocks stale question learning while still recording the final outcome', () => {
    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
      question: { stale: true },
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:disney',
        label: 'Disney',
        signalType: 'studio',
        evidenceCount: 3,
      },
    });

    expect(decision.finalOutcome.recorded).toBe(true);
    expect(decision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.BLOCKED,
      tierId: POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      canWriteLearning: false,
    }));
    expect(decision.learning.blockedReasonCodes).toContain(
      POLICY_LEARNING_REASON_IDS.STALE_QUESTION_BLOCKED
    );
  });

  test('blocks ambiguous answer labels', () => {
    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: '', ambiguous: true },
      candidate: {
        key: 'keyword:princess',
        label: 'Princess',
        signalType: 'keyword',
        evidenceCount: 4,
      },
    });

    expect(decision.learning.decisionId).toBe(POLICY_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toContain(
      POLICY_LEARNING_REASON_IDS.AMBIGUOUS_ANSWER_BLOCKED
    );
  });

  test('blocks rejected question frames such as broad genre priority', () => {
    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      question: { frameId: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY },
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:disney',
        label: 'Disney',
        signalType: 'studio',
        evidenceCount: 3,
      },
    });

    expect(decision.learning.decisionId).toBe(POLICY_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toContain(
      POLICY_LEARNING_REASON_IDS.REJECTED_QUESTION_FRAME_BLOCKED
    );
  });

  test('blocks AI text, provider state, replay diagnostics, and TMDB diagnostics', () => {
    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:disney',
        label: 'Disney',
        signalType: 'studio',
        evidenceCount: 3,
      },
      context: {
        aiExplanationText: 'The AI said this should be learned.',
        providerQuotaState: 'limited',
        replayDiagnosticState: 'different',
        tmdbCoverageState: 'partial',
      },
    });

    expect(decision.learning.decisionId).toBe(POLICY_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toEqual(expect.arrayContaining([
      POLICY_LEARNING_REASON_IDS.AI_EXPLANATION_BLOCKED,
      POLICY_LEARNING_REASON_IDS.PROVIDER_STATE_BLOCKED,
      POLICY_LEARNING_REASON_IDS.REPLAY_DIAGNOSTIC_BLOCKED,
      POLICY_LEARNING_REASON_IDS.TMDB_DIAGNOSTIC_BLOCKED,
    ]));
  });

  test('blocks broad one-off genre learning', () => {
    expect(isBroadGenreCandidate({
      key: 'genre:animation',
      label: 'Animation',
      signalType: 'genre',
    })).toBe(true);

    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'genre:animation',
        label: 'Animation',
        signalType: 'genre',
        evidenceCount: 1,
      },
    });

    expect(decision.learning.decisionId).toBe(POLICY_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toContain(
      POLICY_LEARNING_REASON_IDS.BROAD_ONE_OFF_GENRE_BLOCKED
    );
  });

  test('requires explicit policy edit for hard-limit learning', () => {
    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE,
      answer: { label: 'Block NC-17' },
      candidate: {
        key: 'rating:nc17',
        label: 'NC-17',
        signalType: 'certification',
        evidenceCount: 3,
      },
    });

    expect(decision.learning).toEqual(expect.objectContaining({
      decisionId: POLICY_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED,
      tierId: POLICY_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE,
      canWriteLearning: false,
      requiresExplicitPolicyEdit: true,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
  });

  test('passes the default learning guard audit', () => {
    const decision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:pixar',
        label: 'Pixar',
        signalType: 'studio',
        evidenceCount: 4,
      },
    });
    const audit = buildPolicyLearningGuardAudit(decision);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedTierCount).toBe(5);
    expect(audit.checkedSourceCount).toBe(5);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'automation_readiness',
      label: 'Automation Readiness Engine',
    }));
  });

  test('rejects learning decisions that drop bounded intent quality', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const result = buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult,
      learningInput: {
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        answer: { label: 'Animated Movies' },
        candidate: {
          key: 'studio:pixar',
          label: 'Pixar',
          signalType: 'studio',
          evidenceCount: 4,
        },
      },
    });
    const tamperedDecision = {
      ...result.decision,
      intentBoundary: {
        ...result.decision.intentBoundary,
        evidenceBoundary: {
          ...result.decision.intentBoundary.evidenceBoundary,
          quality: null,
        },
      },
    };

    expect(validatePolicyLearningDecision(tamperedDecision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_INTENT_EVIDENCE_QUALITY,
        }),
      ]));
  });

  test('rejects invalid decisions that try to write directly or refresh without destination learning', () => {
    const invalidDecision = buildPolicyLearningDecision();
    invalidDecision.learning.writesPerformed = true;
    invalidDecision.profileRefresh.queue = true;

    expect(validatePolicyLearningDecision(invalidDecision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.DIRECT_WRITE_PERFORMED,
        }),
        expect.objectContaining({
          riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.PROFILE_REFRESH_WITHOUT_DESTINATION_LEARNING,
        }),
      ]));
  });

  test('rejects blocked decisions that claim write permission', () => {
    const invalidDecision = buildPolicyLearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
      question: { stale: true },
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:disney',
        label: 'Disney',
        signalType: 'studio',
        evidenceCount: 3,
      },
    });
    invalidDecision.learning.canWriteLearning = true;

    expect(validatePolicyLearningDecision(invalidDecision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LEARNING_GUARD_AUDIT_RISK_IDS.BLOCKED_DECISION_CAN_WRITE,
        }),
      ]));
  });

  test('exposes immutable tier and source contracts', () => {
    const tiers = listPolicyLearningTiers();
    const sources = listPolicyLearningSources();

    expect(Object.isFrozen(tiers)).toBe(true);
    expect(Object.isFrozen(tiers[0])).toBe(true);
    expect(Object.isFrozen(sources)).toBe(true);
    expect(Object.isFrozen(sources[0])).toBe(true);
  });
});
