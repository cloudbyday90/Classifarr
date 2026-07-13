import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from '../../services/policyConversionActorSources.mjs';
import {
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput,
} from '../../services/policyLibraryPolicyRebuild.mjs';
import {
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS,
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS,
  buildPolicyLibraryRebuildAcceptanceTransition,
  buildPolicyLibraryRebuildAcceptanceTransitionAudit,
  validatePolicyLibraryRebuildAcceptanceTransition,
} from '../../services/policyLibraryRebuildAcceptanceTransition.mjs';
import {
  buildPolicyRollbackSnapshotWindow,
} from '../../services/policyRollbackSnapshotWindow.mjs';

const NOW = '2026-07-12T12:00:00.000Z';

function profileHandoff() {
  return {
    version: 'policy.library_profile_evidence_loader.v1',
    ok: true,
    statusId: 'ready',
    libraryId: 6,
    profileEvidence: {
      version: 'policy.library_profile_evidence.v1',
      libraryProfile: {
        identityCandidates: [],
        compatibilityCandidates: [{
          key: 'genre:animation',
          label: 'Animation',
          value: '80%',
          count: 8,
          confidence: 0.8,
          reasonCode: 'observed_library_distribution',
        }],
        outliers: [],
      },
      sideEffects: {
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
      },
    },
    profileEvidenceAudit: { ok: true },
    profileFreshness: {
      stale: false,
      updatedAt: NOW,
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
  };
}

function proposal() {
  return buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput({
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    profileHandoff: profileHandoff(),
    operatorIntent: {
      belongsHere: [{
        key: 'studio:disney',
        label: 'Disney',
        count: 7,
      }],
    },
    routingConfiguration: {
      configured: true,
      routeReady: true,
      targetName: 'Animated Movies',
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
  });
}

function policyContext() {
  return {
    policyId: 44,
    intentId: 101,
    libraryId: 6,
  };
}

function rollbackWindowPlan(overrides = {}) {
  return buildPolicyRollbackSnapshotWindow({
    policy: {
      id: 44,
      intent_id: 101,
      library_id: 6,
      customSignals: {
        genres: {
          require_any: ['Animation'],
        },
      },
    },
    action: {
      actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      actorId: 'admin:1',
      reasonCode: 'library_rebuild',
      reason: 'Operator accepted a library rebuild proposal.',
    },
    now: NOW,
    ...overrides,
  });
}

function acceptedTransition(overrides = {}) {
  const rebuildProposal = overrides.proposal || proposal();

  return buildPolicyLibraryRebuildAcceptanceTransition({
    proposal: rebuildProposal,
    policyContext: overrides.policyContext || policyContext(),
    rollbackWindowPlan: overrides.rollbackWindowPlan || rollbackWindowPlan(),
    operatorDecision: overrides.operatorDecision || {
      actorId: 'admin:1',
      actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      decisionId: 'accept_rebuild',
    },
    acceptanceWindowMinutes: overrides.acceptanceWindowMinutes,
    now: overrides.now || NOW,
  });
}

describe('policyLibraryRebuildAcceptanceTransition', () => {
  test('binds a current operator acceptance to the complete rebuild proposal and rollback plan', () => {
    const rebuildProposal = proposal();
    const transition = acceptedTransition({ proposal: rebuildProposal });

    expect(transition.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION);
    expect(transition.validation.ok).toBe(true);
    expect(transition.application).toEqual(expect.objectContaining({
      canEnterMigrationVerification: true,
      canApplyReplacement: false,
      requiresPersistedRollbackSnapshot: true,
      persistedRollbackSnapshotPresent: false,
    }));
    expect(transition.acceptance).toEqual(expect.objectContaining({
      accepted: true,
      actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      actorReference: expect.stringMatching(/^[a-f0-9]{64}$/),
      acceptedAt: NOW,
      expiresAt: '2026-07-12T12:30:00.000Z',
      windowMinutes: 30,
    }));
    expect(transition.replayProtection).toEqual(expect.objectContaining({
      idempotencyKey: expect.stringMatching(/^policy:library_rebuild_acceptance:[a-f0-9]{64}$/),
      persistentRecordRequired: true,
      replayEnforcedInThisContract: false,
    }));
    expect(transition.proposalFingerprint.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(transition.rollbackPlanFingerprint.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(transition)).not.toContain('admin:1');
    expect(validatePolicyLibraryRebuildAcceptanceTransition({
      transition,
      proposal: rebuildProposal,
      now: NOW,
    }).ok).toBe(true);
  });

  test('keeps a valid proposal pending when no explicit operator decision exists', () => {
    const rebuildProposal = proposal();
    const transition = buildPolicyLibraryRebuildAcceptanceTransition({
      proposal: rebuildProposal,
      policyContext: policyContext(),
      rollbackWindowPlan: rollbackWindowPlan(),
      now: NOW,
    });

    expect(transition.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.AWAITING_OPERATOR_ACCEPTANCE);
    expect(transition.acceptance.accepted).toBe(false);
    expect(transition.application.canEnterMigrationVerification).toBe(false);
    expect(transition.validation.ok).toBe(true);
  });

  test('does not accept raw legacy approval or snapshot flags on the proposal', () => {
    const rebuildProposal = proposal();
    rebuildProposal.acceptanceGate.accepted = true;
    rebuildProposal.rollbackGate.snapshotCreated = true;

    const transition = acceptedTransition({ proposal: rebuildProposal });
    const riskIds = transition.validation.issues.map(issue => issue.riskId);

    expect(transition.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.BLOCKED_BY_PROPOSAL);
    expect(riskIds).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.LEGACY_PROPOSAL_ACCEPTANCE_USED,
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.LEGACY_PROPOSAL_SNAPSHOT_USED,
    ]));
  });

  test('rejects a decision that does not represent a direct manual acceptance', () => {
    expect(() => acceptedTransition({
      operatorDecision: {
        actorId: 'admin:1',
        actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY,
        decisionId: 'accept_rebuild',
      },
    })).toThrow('manual operator accept_rebuild');

    expect(() => acceptedTransition({
      operatorDecision: {
        actorId: 'admin:1',
        actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
        decisionId: 'approve_everything',
      },
    })).toThrow('manual operator accept_rebuild');
  });

  test('blocks a rollback plan that is not bound to the same policy and intent', () => {
    const mismatchedPlan = rollbackWindowPlan({
      policy: {
        id: 45,
        intent_id: 102,
        library_id: 6,
      },
    });
    const transition = acceptedTransition({ rollbackWindowPlan: mismatchedPlan });
    const riskIds = transition.validation.issues.map(issue => issue.riskId);

    expect(transition.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.BLOCKED_BY_ROLLBACK_PLAN);
    expect(riskIds).toContain(
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ROLLBACK_PLAN_CONTEXT_MISMATCH
    );
  });

  test('detects altered fingerprints, direct replacement, and expired approvals', () => {
    const rebuildProposal = proposal();
    const transition = acceptedTransition({ proposal: rebuildProposal });
    const altered = JSON.parse(JSON.stringify(transition));
    altered.proposalFingerprint.fingerprint = '0'.repeat(64);
    altered.application.canApplyReplacement = true;
    const alteredRiskIds = validatePolicyLibraryRebuildAcceptanceTransition({
      transition: altered,
      proposal: rebuildProposal,
      now: NOW,
    }).issues.map(issue => issue.riskId);
    const expiredRiskIds = validatePolicyLibraryRebuildAcceptanceTransition({
      transition,
      proposal: rebuildProposal,
      now: '2026-07-12T12:31:00.000Z',
    }).issues.map(issue => issue.riskId);

    expect(alteredRiskIds).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.PROPOSAL_FINGERPRINT_MISMATCH,
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.DIRECT_REPLACEMENT_ALLOWED,
    ]));
    expect(expiredRiskIds).toContain(
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ACCEPTANCE_EXPIRED
    );
  });

  test('rejects unsafe transition objects before any accessor can influence validation', () => {
    const rebuildProposal = proposal();
    const unsafeTransition = {};
    Object.defineProperty(unsafeTransition, 'proposalFingerprint', {
      enumerable: true,
      get() {
        throw new Error('must not read untrusted accessor');
      },
    });

    const validation = validatePolicyLibraryRebuildAcceptanceTransition({
      transition: unsafeTransition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.UNSAFE_TRANSITION_DATA,
      }),
    ]));
  });

  test('audits the transition and identifies migration verification as the next bounded step', () => {
    const rebuildProposal = proposal();
    const transition = acceptedTransition({ proposal: rebuildProposal });
    const audit = buildPolicyLibraryRebuildAcceptanceTransitionAudit({
      transition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      statusId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION,
      canEnterMigrationVerification: true,
      canApplyReplacement: false,
      persistentReplayProtectionRequired: true,
      nextStep: expect.objectContaining({
        stepId: 'migration_verifier_rollback',
      }),
    }));
  });
});
