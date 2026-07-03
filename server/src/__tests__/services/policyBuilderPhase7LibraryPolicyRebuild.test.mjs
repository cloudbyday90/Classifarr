import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  PHASE6R_INTENT_FIELD_IDS,
} from '../../services/policyBuilderPhase6IntentEngine.mjs';
import {
  PHASE6R_READINESS_STATE_IDS,
} from '../../services/policyBuilderPhase6ReadinessEngine.mjs';
import {
  buildPolicyBuilderPhase7RuntimeQuestionReduction,
} from '../../services/policyBuilderPhase7RuntimeQuestionReduction.mjs';
import {
  PHASE7R_REQUEST_EVENT_TYPE_IDS,
  buildPolicyBuilderPhase7RequestTimeLearningDecision,
} from '../../services/policyBuilderPhase7RequestTimeLearning.mjs';
import {
  PHASE7R_REBUILD_AUDIT_RISK_IDS,
  PHASE7R_REBUILD_PROPOSAL_STATUS_IDS,
  PHASE7R_REBUILD_REASON_IDS,
  PHASE7R_REBUILD_WARNING_IDS,
  buildPolicyBuilderPhase7LibraryPolicyRebuildAudit,
  buildPolicyBuilderPhase7LibraryPolicyRebuildProposal,
  validatePolicyBuilderPhase7LibraryPolicyRebuildProposal,
} from '../../services/policyBuilderPhase7LibraryPolicyRebuild.mjs';

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

function guardedOutcome(overrides = {}) {
  return buildPolicyBuilderPhase7RequestTimeLearningDecision({
    eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
    questionReductionPlan: questionReductionPlan(),
    operatorDestination: destination(),
    answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
    candidate: {
      key: 'studio:pixar',
      label: 'Pixar',
      evidenceCount: 4,
    },
    ...overrides,
  });
}

function baseInput(overrides = {}) {
  return {
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    libraryProfile: {
      identityCandidates: [
        {
          key: 'studio:disney',
          label: 'Disney',
          count: 7,
          confidence: 0.92,
        },
      ],
      compatibilityCandidates: [
        {
          key: 'genre:animation',
          label: 'Animation',
          count: 18,
        },
      ],
      outliers: [
        {
          key: 'genre:live-action',
          label: 'Live action',
          count: 2,
        },
      ],
    },
    guardedOutcomes: [
      guardedOutcome(),
    ],
    existingConstraints: {
      hardLimits: [
        {
          key: 'rating:r',
          label: 'R rating',
        },
      ],
      avoid: [
        {
          key: 'genre:horror',
          label: 'Horror',
        },
      ],
    },
    routingConfiguration: {
      configured: true,
      routeReady: true,
      targetName: 'Animated Movies',
      arrType: 'radarr',
      arrConfigId: 1,
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
    profileFreshness: {
      stale: false,
      updatedAt: '2026-06-30T12:00:00.000Z',
    },
    ...overrides,
  };
}

describe('policyBuilderPhase7LibraryPolicyRebuild', () => {
  test('builds a side-effect-free proposal from profile, guarded outcomes, constraints, and routing', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput());

    expect(proposal.version).toBe('phase7r.library_policy_rebuild.v1');
    expect(proposal.statusId).toBe(
      PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_OPERATOR_CONSTRAINT_REVIEW
    );
    expect(proposal.intentDraft.belongs_here).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'studio:disney',
        label: 'Disney',
        fieldId: PHASE6R_INTENT_FIELD_IDS.BELONGS_HERE,
      }),
    ]));
    expect(proposal.intentDraft.helpful_matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'studio:pixar',
        label: 'Pixar',
      }),
    ]));
    expect(proposal.evidenceSourceSummary.guardedOutcomes).toEqual(expect.objectContaining({
      count: 1,
      acceptedCount: 1,
      missingFingerprintCount: 0,
      requestProofCount: 1,
      missingRequestProofCount: 0,
      invalidRequestProofCount: 0,
      fingerprintCount: 1,
    }));
    expect(proposal.evidenceSourceSummary.guardedOutcomes.fingerprints[0])
      .toMatch(/^[a-f0-9]{64}$/u);
    expect(proposal.trace.attributes).toEqual(expect.objectContaining({
      'classifarr.policy.rebuild.guarded_outcome_fingerprint_count': 1,
      'classifarr.policy.rebuild.guarded_outcome_missing_fingerprint_count': 0,
      'classifarr.policy.rebuild.guarded_outcome_request_proof_count': 1,
      'classifarr.policy.rebuild.guarded_outcome_missing_request_proof_count': 0,
      'classifarr.policy.rebuild.guarded_outcome_invalid_request_proof_count': 0,
    }));
    expect(JSON.stringify(proposal.evidenceSourceSummary.guardedOutcomes.fingerprints))
      .not.toContain('Animated Movies');
    expect(proposal.intentDraft.hard_limits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'rating:r',
        operatorDeclared: true,
      }),
    ]));
    expect(proposal.intentDraft.routing_target).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Animated Movies',
      }),
    ]));
    expect(proposal.acceptanceGate.requiresExplicitOperatorAcceptance).toBe(true);
    expect(proposal.acceptanceGate.accepted).toBe(false);
    expect(proposal.rollbackGate.requiresRollbackSnapshot).toBe(true);
    expect(proposal.rollbackGate.snapshotCreated).toBe(false);
    expect(proposal.sideEffects).toEqual({
      policyActivated: false,
      policyReplaced: false,
      policyDeleted: false,
      learningWritten: false,
      routingWritten: false,
    });
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('rejects guarded outcomes without upstream evidence fingerprints and does not consume them', () => {
    const outcome = guardedOutcome();
    outcome.upstreamEvidenceFingerprint = null;
    outcome.learningGuardContext.upstreamEvidenceFingerprint = null;
    outcome.trace.attributes['classifarr.runtime.request_learning.upstream_evidence_fingerprint'] = undefined;

    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput({
      guardedOutcomes: [
        outcome,
      ],
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));

    expect(proposal.intentDraft.helpful_matches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'studio:pixar',
      }),
    ]));
    expect(proposal.evidenceSourceSummary.guardedOutcomes).toEqual(expect.objectContaining({
      count: 1,
      acceptedCount: 0,
      missingFingerprintCount: 1,
      fingerprintCount: 0,
    }));
    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
        severity: 'error',
      }),
    ]));
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
        }),
      ]));
  });

  test('rejects guarded outcomes without valid request-time proof and does not consume them', () => {
    const missingProof = guardedOutcome();
    const invalidProof = guardedOutcome();

    missingProof.questionReductionProof = null;
    invalidProof.questionReductionProof.validation.ok = false;
    invalidProof.questionReductionProof.validation.issueCount = 1;

    const missingProofProposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput({
      guardedOutcomes: [missingProof],
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));
    const invalidProofProposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput({
      guardedOutcomes: [invalidProof],
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));

    expect(missingProofProposal.intentDraft.helpful_matches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'studio:pixar',
      }),
    ]));
    expect(missingProofProposal.evidenceSourceSummary.guardedOutcomes)
      .toEqual(expect.objectContaining({
        count: 1,
        acceptedCount: 0,
        missingRequestProofCount: 1,
        invalidRequestProofCount: 0,
      }));
    expect(invalidProofProposal.evidenceSourceSummary.guardedOutcomes)
      .toEqual(expect.objectContaining({
        count: 1,
        acceptedCount: 0,
        missingRequestProofCount: 0,
        invalidRequestProofCount: 1,
      }));
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(missingProofProposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_WITHOUT_REQUEST_PROOF,
        }),
      ]));
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(invalidProofProposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_INVALID_REQUEST_PROOF,
        }),
      ]));
  });

  test('rejects guarded outcome fingerprint trace mismatches', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput());
    proposal.trace.attributes['classifarr.policy.rebuild.guarded_outcome_fingerprint_count'] = 0;
    proposal.trace.attributes['classifarr.policy.rebuild.guarded_outcome_request_proof_count'] = 0;

    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_FINGERPRINT_MISMATCH,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_REQUEST_PROOF_MISMATCH,
        }),
      ]));
  });

  test('keeps observed absence as a warning and never promotes it to avoid', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput({
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
      observedAbsences: [
        {
          key: 'genre:musical',
          label: 'Musical',
        },
      ],
    }));

    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
      }),
    ]));
    expect(proposal.intentDraft.avoid).toHaveLength(0);
    expect(proposal.intentDraft.ask_when).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'genre:musical',
      }),
    ]));
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('requires routing configuration when no route target exists', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput({
      libraryProfile: {
        identityCandidates: [
          {
            key: 'studio:disney',
            label: 'Disney',
            count: 7,
          },
        ],
        compatibilityCandidates: [],
        outliers: [],
      },
      guardedOutcomes: [],
      routingConfiguration: {
        configured: false,
        routeReady: false,
      },
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));

    expect(proposal.statusId).toBe(PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_ROUTING_CONFIGURATION);
    expect(proposal.readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING);
    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REBUILD_WARNING_IDS.MISSING_ROUTING_CONFIGURATION,
      }),
    ]));
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('requires profile refresh when library profile evidence is stale', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput({
      profileFreshness: {
        stale: true,
        reasonCode: 'stale_profile',
      },
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));

    expect(proposal.statusId).toBe(PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.STALE_PROFILE);
    expect(proposal.readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.STALE_PROFILE);
    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REBUILD_WARNING_IDS.STALE_PROFILE,
      }),
    ]));
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('requires more evidence when the observed library profile has no identity', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput({
      libraryProfile: {
        identityCandidates: [],
        compatibilityCandidates: [
          {
            key: 'genre:animation',
            label: 'Animation',
          },
        ],
      },
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));

    expect(proposal.statusId).toBe(PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE);
    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REBUILD_WARNING_IDS.MISSING_IDENTITY_EVIDENCE,
      }),
    ]));
    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('rejects direct activation, replacement, deletion, learning, or routing writes', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput());
    proposal.sideEffects.policyActivated = true;
    proposal.sideEffects.policyReplaced = true;
    proposal.sideEffects.policyDeleted = true;
    proposal.sideEffects.learningWritten = true;
    proposal.sideEffects.routingWritten = true;

    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_ACTIVATION,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_REPLACEMENT,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_DELETE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_LEARNING_WRITE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_ROUTING_WRITE,
        }),
      ]));
  });

  test('rejects missing acceptance, rollback, source summary, and preserved-constraint gates', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput());
    proposal.acceptanceGate.requiresExplicitOperatorAcceptance = false;
    proposal.rollbackGate.requiresRollbackSnapshot = false;
    proposal.evidenceSourceSummary.explicitConstraints.preserved = false;
    proposal.evidenceSourceSummary.libraryProfile = null;

    expect(validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_OPERATOR_ACCEPTANCE_GATE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_ROLLBACK_GATE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.EXPLICIT_CONSTRAINT_NOT_PRESERVED,
        }),
        expect.objectContaining({
          riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_EVIDENCE_SOURCE_SUMMARY,
        }),
      ]));
  });

  test('passes component audit and points to migration verifier rollback work', () => {
    const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(baseInput());
    const audit = buildPolicyBuilderPhase7LibraryPolicyRebuildAudit(proposal);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_7',
      label: 'Migration Verifier And Rollback Path',
    }));
    expect(proposal.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_REBUILD_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
      }),
      expect.objectContaining({
        reasonId: PHASE7R_REBUILD_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
      }),
    ]));
  });
});
