import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  POLICY_INTENT_FIELD_IDS,
} from '../../services/policyIntentEngine.mjs';
import {
  POLICY_AUTOMATION_READINESS_STATE_IDS,
} from '../../services/policyAutomationReadinessEngine.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
} from '../../services/policyRuntimeQuestionReduction.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
} from '../../services/policyRequestTimeLearning.mjs';
import {
  buildPolicyRequestTimeEvent,
} from '../../services/policyRequestTimeEvent.mjs';
import {
  buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions,
} from '../../services/policyGuardedOutcomeProjection.mjs';
import {
  POLICY_REBUILD_AUDIT_RISK_IDS,
  POLICY_REBUILD_PROPOSAL_STATUS_IDS,
  POLICY_REBUILD_REASON_IDS,
  POLICY_REBUILD_WARNING_IDS,
  buildPolicyLibraryPolicyRebuildAudit,
  buildPolicyLibraryPolicyRebuildProposalFromGuardedOutcomeProjection,
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput as buildPolicyLibraryPolicyRebuildProposal,
  validatePolicyLibraryPolicyRebuildProposal,
} from '../../services/policyLibraryPolicyRebuild.mjs';

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

function guardedOutcome(overrides = {}) {
  const requestEvent = buildPolicyRequestTimeEvent({
    eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
    sourceEventId: 'test:policy-library-policy-rebuild:manual-destination-change',
    operatorDestination: destination(),
    answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
    candidate: {
      key: 'studio:pixar',
      label: 'Pixar',
      evidenceCount: 4,
    },
    ...overrides,
  });

  return buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
    questionReductionPlan: questionReductionPlan(),
    requestEvent,
  });
}

function profileEvidence(overrides = {}) {
  return {
    version: 'policy.library_profile_evidence.v1',
    libraryProfile: {
      identityCandidates: [],
      compatibilityCandidates: [
        {
          key: 'genre:animation',
          label: 'Animation',
          value: '80%',
          count: 8,
          confidence: 0.8,
          reasonCode: 'observed_library_distribution',
        },
      ],
      outliers: [],
    },
    sideEffects: {
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      policyStorageMutated: false,
    },
    ...overrides,
  };
}

function profileHandoff(overrides = {}) {
  return {
    version: 'policy.library_profile_evidence_loader.v1',
    ok: true,
    statusId: 'ready',
    libraryId: 6,
    profileEvidence: profileEvidence(),
    profileEvidenceAudit: { ok: true },
    profileFreshness: {
      stale: false,
      updatedAt: '2026-06-30T12:00:00.000Z',
      reasonCode: 'current_profile_timestamp',
    },
    evidenceBoundary: { ok: true },
    evidenceBoundaryAudit: { ok: true },
    sideEffects: {
      libraryProfileRead: true,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      evidenceProjectionBuilt: true,
      policyStorageMutated: false,
    },
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    profileHandoff: profileHandoff(),
    operatorIntent: {
      belongsHere: [
        {
          key: 'studio:disney',
          label: 'Disney',
          count: 7,
          confidence: 0.92,
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
    ...overrides,
  };
}

describe('policyLibraryPolicyRebuild', () => {
  test('preserves structured strict-constraint descriptors through the bounded intent draft', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
      existingConstraints: {
        hardLimits: [{
          key: 'certification:pg-13',
          label: 'PG-13 maximum',
          strictConstraint: {
            version: 'policy.strict_constraint_descriptor.v1',
            signal_type: 'certifications',
            operator: 'max',
            values: { mode: 'max', max: 'PG-13' },
            constraint_mode: 'strict',
            semantics: 'compatibility',
          },
        }],
        avoid: [],
      },
    }));

    expect(proposal.intentDraft.hard_limits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'certification:pg-13',
        strictConstraint: expect.objectContaining({
          signal_type: 'certifications',
          operator: 'max',
          values: { mode: 'max', max: 'PG-13' },
        }),
      }),
    ]));
  });

  test('requires a guarded-outcome projection for the decision-only rebuild reducer', () => {
    const rawInput = baseInput();
    const { guardedOutcomes, ...rebuildInput } = rawInput;
    const guardedOutcomeProjection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
      requestTimeDecisions: guardedOutcomes,
    });

    expect(() => buildPolicyLibraryPolicyRebuildProposalFromGuardedOutcomeProjection(rawInput))
      .toThrow('does not accept "guardedOutcomes"');
    expect(() => buildPolicyLibraryPolicyRebuildProposalFromGuardedOutcomeProjection({
      ...rebuildInput,
      guardedOutcomeProjection,
      learningDecision: {},
    })).toThrow('does not accept "learningDecision"');
    expect(() => buildPolicyLibraryPolicyRebuildProposal({
      ...rebuildInput,
      guardedOutcomeProjection,
    })).toThrow('does not accept "guardedOutcomeProjection"');

    const proposal = buildPolicyLibraryPolicyRebuildProposalFromGuardedOutcomeProjection({
      ...rebuildInput,
      guardedOutcomeProjection,
    });

    expect(proposal.guardedOutcomeProjection).toBe(guardedOutcomeProjection);
    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('builds a side-effect-free proposal from profile, guarded outcomes, constraints, and routing', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());

    expect(proposal.version).toBe('policy.library_policy_rebuild.v1');
    expect(proposal.statusId).toBe(
      POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_OPERATOR_CONSTRAINT_REVIEW
    );
    expect(proposal.intentDraft.belongs_here).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'studio:disney',
        label: 'Disney',
        fieldId: POLICY_INTENT_FIELD_IDS.BELONGS_HERE,
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
    expect(proposal.evidenceBoundary).toEqual(expect.objectContaining({
      ok: true,
      statusId: 'ready',
      projectionFingerprint: expect.objectContaining({
        algorithm: 'sha256',
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    }));
    expect(proposal.readinessBoundary).toEqual(expect.objectContaining({
      ok: true,
      statusId: 'ready',
      readinessAuditOk: true,
      projectionFingerprintMatch: true,
      evidenceBoundary: expect.objectContaining({
        statusId: 'ready',
        projectionFingerprint: expect.objectContaining({ algorithm: 'sha256' }),
      }),
      intentBoundary: expect.objectContaining({
        statusId: 'ready',
        projectionFingerprint: expect.objectContaining({ algorithm: 'sha256' }),
      }),
      learningBoundary: expect.objectContaining({
        statusId: 'ready',
        projectionFingerprint: expect.objectContaining({ algorithm: 'sha256' }),
      }),
    }));
    expect(proposal.readinessBoundary.evidenceBoundary.projectionFingerprint.fingerprint)
      .toBe(proposal.evidenceBoundary.projectionFingerprint.fingerprint);
    expect(proposal.readinessBoundary.intentBoundary.projectionFingerprint.fingerprint)
      .toBe(proposal.evidenceBoundary.projectionFingerprint.fingerprint);
    expect(proposal.readinessBoundary.learningBoundary.projectionFingerprint.fingerprint)
      .toBe(proposal.evidenceBoundary.projectionFingerprint.fingerprint);
    expect(proposal.trace.attributes).toEqual(expect.objectContaining({
      'classifarr.policy.rebuild.guarded_outcome_fingerprint_count': 1,
      'classifarr.policy.rebuild.guarded_outcome_missing_fingerprint_count': 0,
      'classifarr.policy.rebuild.guarded_outcome_request_proof_count': 1,
      'classifarr.policy.rebuild.guarded_outcome_missing_request_proof_count': 0,
      'classifarr.policy.rebuild.guarded_outcome_invalid_request_proof_count': 0,
      'classifarr.policy.rebuild.readiness_boundary_status': 'ready',
      'classifarr.policy.rebuild.readiness_boundary_ready': true,
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
    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('rejects raw library profile data before proposal composition', () => {
    expect(() => buildPolicyLibraryPolicyRebuildProposal(baseInput({
      libraryProfile: {
        identityCandidates: [{
          key: 'studio:disney',
          label: 'Disney',
        }],
      },
    }))).toThrow('does not accept "libraryProfile"');
  });

  test('rejects derived contracts attached to an evidence-boundary-blocked proposal', () => {
    const blockedProposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    blockedProposal.statusId = POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY;
    blockedProposal.evidenceBoundary.ok = false;
    blockedProposal.intentDraft = {
      version: 'policy.intent.v1',
    };

    expect(validatePolicyLibraryPolicyRebuildProposal(blockedProposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_EVIDENCE_BOUNDARY_WITH_DERIVED_CONTRACT,
        }),
      ]));
  });

  test('rejects guarded outcomes without upstream evidence fingerprints and does not consume them', () => {
    const outcome = guardedOutcome();
    outcome.upstreamEvidenceFingerprint = null;
    outcome.learningGuardContext.upstreamEvidenceFingerprint = null;
    outcome.trace.attributes['classifarr.runtime.request_learning.upstream_evidence_fingerprint'] = undefined;

    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
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
        reasonId: POLICY_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
        severity: 'error',
      }),
    ]));
    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
        }),
      ]));
  });

  test('rejects guarded outcomes without valid request-time proof and does not consume them', () => {
    const missingProof = guardedOutcome();
    const invalidProof = guardedOutcome();

    missingProof.questionReductionProof = null;
    invalidProof.questionReductionProof.validation.ok = false;
    invalidProof.questionReductionProof.validation.issueCount = 1;

    const missingProofProposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
      guardedOutcomes: [missingProof],
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));
    const invalidProofProposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
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
    expect(validatePolicyLibraryPolicyRebuildProposal(missingProofProposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_WITHOUT_REQUEST_PROOF,
        }),
      ]));
    expect(validatePolicyLibraryPolicyRebuildProposal(invalidProofProposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_INVALID_REQUEST_PROOF,
        }),
      ]));
  });

  test('rejects guarded outcome fingerprint trace mismatches', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    proposal.trace.attributes['classifarr.policy.rebuild.guarded_outcome_fingerprint_count'] = 0;
    proposal.trace.attributes['classifarr.policy.rebuild.guarded_outcome_request_proof_count'] = 0;

    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_FINGERPRINT_MISMATCH,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_REQUEST_PROOF_MISMATCH,
        }),
      ]));
  });

  test('keeps observed absence as a warning and never promotes it to avoid', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
      profileHandoff: profileHandoff({
        profileEvidence: profileEvidence({
          libraryProfile: {
            identityCandidates: [],
            compatibilityCandidates: [],
            outliers: [{
              key: 'genre:musical',
              label: 'Musical',
              count: 0,
              confidence: null,
              reasonCode: 'observed_absence_requires_review',
            }],
          },
        }),
      }),
    }));

    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
      }),
    ]));
    expect(proposal.intentDraft.avoid).toHaveLength(0);
    expect(proposal.intentDraft.ask_when).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'genre:musical',
      }),
    ]));
    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('requires routing configuration when no route target exists', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
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

    expect(proposal.statusId).toBe(POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_ROUTING_CONFIGURATION);
    expect(proposal.readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING);
    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_REBUILD_WARNING_IDS.MISSING_ROUTING_CONFIGURATION,
      }),
    ]));
    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('requires profile refresh when library profile evidence is stale', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
      profileHandoff: profileHandoff({
        statusId: 'ready_with_stale_profile',
        profileFreshness: {
          stale: true,
          updatedAt: '2026-06-01T12:00:00.000Z',
          reasonCode: 'stale_profile_timestamp',
        },
      }),
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));

    expect(proposal.statusId).toBe(POLICY_REBUILD_PROPOSAL_STATUS_IDS.STALE_PROFILE);
    expect(proposal.readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE);
    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_REBUILD_WARNING_IDS.STALE_PROFILE,
      }),
    ]));
    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('requires more evidence when the observed library profile has no identity', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
      operatorIntent: {
        belongsHere: [],
      },
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));

    expect(proposal.statusId).toBe(POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE);
    expect(proposal).toEqual(expect.objectContaining({
      evidenceProjection: null,
      intentDraft: null,
      readiness: null,
      intentBoundary: expect.objectContaining({
        ok: false,
        statusId: 'blocked_by_evidence_quality',
      }),
    }));
    expect(proposal.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_REBUILD_WARNING_IDS.MISSING_IDENTITY_EVIDENCE,
      }),
    ]));
    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).ok).toBe(true);
  });

  test('rejects derived contracts on a rebuild stopped by the intent boundary', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput({
      operatorIntent: {
        belongsHere: [],
      },
      existingConstraints: {
        hardLimits: [],
        avoid: [],
      },
    }));
    proposal.intentDraft = { version: 'policy.intent.v1' };

    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_INTENT_BOUNDARY_WITH_DERIVED_CONTRACT,
        }),
      ]));
  });

  test('rejects a ready rebuild proposal whose intent provenance no longer matches bounded evidence', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    proposal.intentBoundary.projectionFingerprint.fingerprint = '0'.repeat(64);

    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INTENT_BOUNDARY_PROVENANCE_MISMATCH,
        }),
      ]));
  });

  test('rejects a ready rebuild proposal without a bounded intent summary', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    proposal.intentBoundary = null;

    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_INTENT_BOUNDARY,
        }),
      ]));
  });

  test('rejects missing or tampered bounded readiness provenance', () => {
    const missingBoundaryProposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    missingBoundaryProposal.readinessBoundary = null;

    expect(validatePolicyLibraryPolicyRebuildProposal(missingBoundaryProposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_READINESS_BOUNDARY,
        }),
      ]));

    const tamperedBoundaryProposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    tamperedBoundaryProposal.readinessBoundary.learningBoundary.projectionFingerprint.fingerprint =
      '0'.repeat(64);

    expect(validatePolicyLibraryPolicyRebuildProposal(tamperedBoundaryProposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.READINESS_BOUNDARY_PROVENANCE_MISMATCH,
        }),
      ]));
  });

  test('rejects direct activation, replacement, deletion, learning, or routing writes', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    proposal.sideEffects.policyActivated = true;
    proposal.sideEffects.policyReplaced = true;
    proposal.sideEffects.policyDeleted = true;
    proposal.sideEffects.learningWritten = true;
    proposal.sideEffects.routingWritten = true;

    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_ACTIVATION,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_REPLACEMENT,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_DELETE,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_LEARNING_WRITE,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_ROUTING_WRITE,
        }),
      ]));
  });

  test('rejects missing acceptance, rollback, source summary, and preserved-constraint gates', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    proposal.acceptanceGate.requiresExplicitOperatorAcceptance = false;
    proposal.rollbackGate.requiresRollbackSnapshot = false;
    proposal.evidenceSourceSummary.explicitConstraints.preserved = false;
    proposal.evidenceSourceSummary.libraryProfile = null;

    expect(validatePolicyLibraryPolicyRebuildProposal(proposal).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_OPERATOR_ACCEPTANCE_GATE,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_ROLLBACK_GATE,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.EXPLICIT_CONSTRAINT_NOT_PRESERVED,
        }),
        expect.objectContaining({
          riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_EVIDENCE_SOURCE_SUMMARY,
        }),
      ]));
  });

  test('uses product-domain validation language for missing intent and readiness', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    proposal.intentDraft = null;
    proposal.readiness = {};

    const validation = validatePolicyLibraryPolicyRebuildProposal(proposal);
    const messages = validation.issues.map(issue => issue.message);

    expect(messages).toEqual(expect.arrayContaining([
      'Library policy rebuild proposal must include a bounded policy intent draft.',
      'Library policy rebuild proposal must include valid policy automation readiness.',
    ]));
    expect(messages.join(' ')).not.toContain('Phase');
  });

  test('passes component audit and points to migration verifier rollback work', () => {
    const proposal = buildPolicyLibraryPolicyRebuildProposal(baseInput());
    const audit = buildPolicyLibraryPolicyRebuildAudit(proposal);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'library_rebuild_acceptance_transition',
      label: 'Library Rebuild Acceptance Transition',
    }));
    expect(proposal.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_REBUILD_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
      }),
      expect.objectContaining({
        reasonId: POLICY_REBUILD_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
      }),
    ]));
  });
});
