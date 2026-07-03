import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  ANSWER_OUTCOME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildPolicyBuilderPhase6BoundedEvidenceProjection,
} from '../../services/policyBuilderPhase6EvidenceBoundary.mjs';
import {
  buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence,
} from '../../services/policyBuilderPhase6IntentEngine.mjs';
import {
  PHASE6R_LEARNING_BOUNDARY_STATUS_IDS,
  PHASE6R_LEARNING_DECISION_IDS,
  PHASE6R_LEARNING_EVENT_SOURCE_IDS,
  PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS,
  PHASE6R_LEARNING_REASON_IDS,
  PHASE6R_LEARNING_TIER_IDS,
  buildPolicyBuilderPhase6LearningDecision,
  buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent,
  buildPolicyBuilderPhase6LearningGuardAudit,
  getPolicyBuilderPhase6LearningSource,
  getPolicyBuilderPhase6LearningTier,
  isBroadGenreCandidate,
  listPolicyBuilderPhase6LearningSources,
  listPolicyBuilderPhase6LearningTiers,
  validatePolicyBuilderPhase6LearningDecision,
} from '../../services/policyBuilderPhase6LearningGuard.mjs';

describe('policyBuilderPhase6LearningGuard', () => {
  test('defines the explicit learning tiers in roadmap order', () => {
    expect(listPolicyBuilderPhase6LearningTiers().map(tier => tier.id)).toEqual([
      PHASE6R_LEARNING_TIER_IDS.NONE,
      PHASE6R_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY,
      PHASE6R_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
      PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      PHASE6R_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE,
    ]);

    expect(getPolicyBuilderPhase6LearningTier(PHASE6R_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE))
      .toEqual(expect.objectContaining({
        canWriteLearning: false,
        destinationEvidenceChanging: true,
        requiresExplicitPolicyEdit: true,
      }));
  });

  test('defines all Phase 6R learning event sources as manual-outcome authority', () => {
    expect(listPolicyBuilderPhase6LearningSources().map(source => source.id)).toEqual([
      PHASE6R_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE,
      PHASE6R_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
      PHASE6R_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
      PHASE6R_LEARNING_EVENT_SOURCE_IDS.REQUEST_DESTINATION_CHOICE,
      PHASE6R_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
    ]);

    listPolicyBuilderPhase6LearningSources().forEach(source => {
      expect(source.authoritySourceId).toBe(AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME);
    });
    expect(getPolicyBuilderPhase6LearningSource(PHASE6R_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER)
      .label)
      .toBe('Discord pending answer');
  });

  test('records final outcome separately when no learning is requested', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
      sourceId: PHASE6R_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
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
      decisionId: PHASE6R_LEARNING_DECISION_IDS.OUTCOME_ONLY,
      tierId: PHASE6R_LEARNING_TIER_IDS.NONE,
      canWriteLearning: false,
      writesPerformed: false,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
  });

  test('approves exact-item memory without changing destination profile evidence', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
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
      decisionId: PHASE6R_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: PHASE6R_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY,
      canWriteLearning: true,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
    expect(decision.learning.reasonCodes).toEqual(expect.arrayContaining([
      PHASE6R_LEARNING_REASON_IDS.EXACT_ITEM_MEMORY_CANDIDATE,
      PHASE6R_LEARNING_REASON_IDS.LEARNING_CANDIDATE_APPROVED,
    ]));
  });

  test('approves compatibility evidence from a Discord answer and queues profile refresh', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
      sourceId: PHASE6R_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
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
      decisionId: PHASE6R_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: PHASE6R_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
      canWriteLearning: true,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    }));
    expect(decision.profileRefresh).toEqual({
      queue: true,
      reasonCodes: [PHASE6R_LEARNING_REASON_IDS.PROFILE_REFRESH_REQUIRED],
    });
  });

  test('builds bounded learning only from a successful bounded intent result', () => {
    const boundedEvidenceResult = buildPolicyBuilderPhase6BoundedEvidenceProjection({
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
    const boundedIntentResult = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const result = buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent({
      boundedIntentResult,
      learningInput: {
        sourceId: PHASE6R_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
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
      statusId: PHASE6R_LEARNING_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextPhase: expect.objectContaining({
        phaseId: '6r_4',
      }),
    }));
    expect(result.intentBoundary).toEqual(expect.objectContaining({
      statusId: boundedIntentResult.statusId,
      intentVersion: boundedIntentResult.intent.version,
      evidenceBoundary: expect.objectContaining({
        projectionFingerprint: expect.objectContaining({
          fingerprint: boundedEvidenceResult.projectionFingerprint.fingerprint,
        }),
      }),
    }));
    expect(result.decision.learning).toEqual(expect.objectContaining({
      decisionId: PHASE6R_LEARNING_DECISION_IDS.CANDIDATE,
      tierId: PHASE6R_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
      canWriteLearning: true,
    }));
    expect(JSON.stringify(result.intentBoundary)).not.toContain('Pixar');
    expect(result.learningAudit.ok).toBe(true);
  });

  test('blocks bounded learning when bounded intent failed or lacks evidence fingerprint', () => {
    const blocked = buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent({
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
      statusId: PHASE6R_LEARNING_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      learningAudit: null,
    }));
    expect(blocked.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_BOUNDED_INTENT,
      }),
      expect.objectContaining({
        riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_INTENT_EVIDENCE_FINGERPRINT,
      }),
    ]));

    const missingFingerprint = buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent({
      boundedIntentResult: {
        ok: true,
        statusId: 'ready',
        intent: {
          version: 'phase6r.intent.v1',
          source: 'phase6r_bounded_evidence_boundary',
        },
        evidenceBoundary: {},
      },
    });

    expect(missingFingerprint.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_INTENT_EVIDENCE_FINGERPRINT,
      }),
    ]));
  });

  test('blocks stale question learning while still recording the final outcome', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
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
      decisionId: PHASE6R_LEARNING_DECISION_IDS.BLOCKED,
      tierId: PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      canWriteLearning: false,
    }));
    expect(decision.learning.blockedReasonCodes).toContain(
      PHASE6R_LEARNING_REASON_IDS.STALE_QUESTION_BLOCKED
    );
  });

  test('blocks ambiguous answer labels', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: '', ambiguous: true },
      candidate: {
        key: 'keyword:princess',
        label: 'Princess',
        signalType: 'keyword',
        evidenceCount: 4,
      },
    });

    expect(decision.learning.decisionId).toBe(PHASE6R_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toContain(
      PHASE6R_LEARNING_REASON_IDS.AMBIGUOUS_ANSWER_BLOCKED
    );
  });

  test('blocks rejected question frames such as broad genre priority', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
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

    expect(decision.learning.decisionId).toBe(PHASE6R_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toContain(
      PHASE6R_LEARNING_REASON_IDS.REJECTED_QUESTION_FRAME_BLOCKED
    );
  });

  test('blocks AI text, provider state, replay diagnostics, and TMDB diagnostics', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
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

    expect(decision.learning.decisionId).toBe(PHASE6R_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toEqual(expect.arrayContaining([
      PHASE6R_LEARNING_REASON_IDS.AI_EXPLANATION_BLOCKED,
      PHASE6R_LEARNING_REASON_IDS.PROVIDER_STATE_BLOCKED,
      PHASE6R_LEARNING_REASON_IDS.REPLAY_DIAGNOSTIC_BLOCKED,
      PHASE6R_LEARNING_REASON_IDS.TMDB_DIAGNOSTIC_BLOCKED,
    ]));
  });

  test('blocks broad one-off genre learning', () => {
    expect(isBroadGenreCandidate({
      key: 'genre:animation',
      label: 'Animation',
      signalType: 'genre',
    })).toBe(true);

    const decision = buildPolicyBuilderPhase6LearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'genre:animation',
        label: 'Animation',
        signalType: 'genre',
        evidenceCount: 1,
      },
    });

    expect(decision.learning.decisionId).toBe(PHASE6R_LEARNING_DECISION_IDS.BLOCKED);
    expect(decision.learning.blockedReasonCodes).toContain(
      PHASE6R_LEARNING_REASON_IDS.BROAD_ONE_OFF_GENRE_BLOCKED
    );
  });

  test('requires explicit policy edit for hard-limit learning', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
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
      decisionId: PHASE6R_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED,
      tierId: PHASE6R_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE,
      canWriteLearning: false,
      requiresExplicitPolicyEdit: true,
    }));
    expect(decision.profileRefresh.queue).toBe(false);
  });

  test('passes the default learning guard audit', () => {
    const decision = buildPolicyBuilderPhase6LearningDecision({
      answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      answer: { label: 'Animated Movies' },
      candidate: {
        key: 'studio:pixar',
        label: 'Pixar',
        signalType: 'studio',
        evidenceCount: 4,
      },
    });
    const audit = buildPolicyBuilderPhase6LearningGuardAudit(decision);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedTierCount).toBe(5);
    expect(audit.checkedSourceCount).toBe(5);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '6r_4',
      label: 'Automation Readiness Engine',
    }));
  });

  test('rejects invalid decisions that try to write directly or refresh without destination learning', () => {
    const invalidDecision = buildPolicyBuilderPhase6LearningDecision();
    invalidDecision.learning.writesPerformed = true;
    invalidDecision.profileRefresh.queue = true;

    expect(validatePolicyBuilderPhase6LearningDecision(invalidDecision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.DIRECT_WRITE_PERFORMED,
        }),
        expect.objectContaining({
          riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.PROFILE_REFRESH_WITHOUT_DESTINATION_LEARNING,
        }),
      ]));
  });

  test('rejects blocked decisions that claim write permission', () => {
    const invalidDecision = buildPolicyBuilderPhase6LearningDecision({
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

    expect(validatePolicyBuilderPhase6LearningDecision(invalidDecision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.BLOCKED_DECISION_CAN_WRITE,
        }),
      ]));
  });

  test('exposes immutable tier and source contracts', () => {
    const tiers = listPolicyBuilderPhase6LearningTiers();
    const sources = listPolicyBuilderPhase6LearningSources();

    expect(Object.isFrozen(tiers)).toBe(true);
    expect(Object.isFrozen(tiers[0])).toBe(true);
    expect(Object.isFrozen(sources)).toBe(true);
    expect(Object.isFrozen(sources[0])).toBe(true);
  });
});
