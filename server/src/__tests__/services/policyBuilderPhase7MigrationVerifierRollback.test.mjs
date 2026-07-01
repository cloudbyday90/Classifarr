import {
  buildPolicyBuilderPhase7LibraryPolicyRebuildProposal,
} from '../../services/policyBuilderPhase7LibraryPolicyRebuild.mjs';
import {
  PHASE7R_MIGRATION_DELETION_CRITERION_IDS,
  PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS,
  PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS,
  PHASE7R_MIGRATION_VERIFIER_STATUS_IDS,
  buildPolicyBuilderPhase7MigrationVerifierAudit,
  buildPolicyBuilderPhase7MigrationVerifierReport,
  validatePolicyBuilderPhase7MigrationVerifierReport,
} from '../../services/policyBuilderPhase7MigrationVerifierRollback.mjs';

function proposalInput(overrides = {}) {
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
        },
      ],
      compatibilityCandidates: [
        {
          key: 'genre:animation',
          label: 'Animation',
          count: 12,
        },
      ],
      outliers: [],
    },
    routingConfiguration: {
      configured: true,
      routeReady: true,
      targetName: 'Animated Movies',
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
    profileFreshness: {
      stale: false,
    },
    ...overrides,
  };
}

function acceptedProposal() {
  const proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(proposalInput());
  proposal.acceptanceGate.accepted = true;
  proposal.acceptanceGate.acceptedBy = 'admin-1';
  proposal.acceptanceGate.acceptedAt = '2026-06-30T12:00:00.000Z';
  return proposal;
}

describe('policyBuilderPhase7MigrationVerifierRollback', () => {
  test('builds a no-difference report with explicit rollback and deletion gates', () => {
    const report = buildPolicyBuilderPhase7MigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [
        {
          itemId: 10674,
          title: 'Mulan',
          legacy: {
            destinationLibraryId: 6,
            destinationLibraryName: 'Animated Movies',
            routeReady: true,
            confidenceScore: 0.7,
            confidenceLevel: 'medium',
          },
          proposed: {
            destinationLibraryId: 6,
            destinationLibraryName: 'Animated Movies',
            routeReady: true,
            confidenceScore: 0.7,
            confidenceLevel: 'medium',
          },
        },
      ],
      operatorAccepted: true,
      rollbackSnapshot: {
        created: true,
        snapshotId: 'snapshot-1',
        restorePath: 'policy_snapshots/snapshot-1.json',
        retentionWindowDays: 30,
      },
    });

    expect(report.statusId).toBe(PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES);
    expect(report.differenceSummary.totalCount).toBe(0);
    expect(report.applicationGate).toEqual(expect.objectContaining({
      requiresOperatorAcceptance: true,
      operatorAccepted: true,
      requiresRollbackSnapshot: true,
      canApplyReplacement: true,
    }));
    expect(report.deletionReadiness.canDeleteLegacyPaths).toBe(false);
    expect(report.deletionReadiness.criteria).toEqual(expect.arrayContaining([
      expect.objectContaining({
        criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.PHASE8_NATIVE_INTENT_STABLE,
        met: false,
      }),
    ]));
    expect(report.normalWorkflowSurface).toBe(false);
    expect(validatePolicyBuilderPhase7MigrationVerifierReport(report).ok).toBe(true);
  });

  test('emits only migration-relevant bounded differences', () => {
    const report = buildPolicyBuilderPhase7MigrationVerifierReport({
      proposal: acceptedProposal(),
      maxDifferences: 3,
      confidenceDeltaThreshold: 0.1,
      legacyComparisonSamples: [
        {
          itemId: 1,
          title: 'Different destination',
          legacy: {
            destinationLibraryId: 7,
            destinationLibraryName: 'Movies',
            routeReady: true,
            confidenceScore: 0.92,
            confidenceLevel: 'high',
          },
          proposed: {
            destinationLibraryId: 6,
            destinationLibraryName: 'Animated Movies',
            routeReady: false,
            needsReview: true,
            confidenceScore: 0.55,
            confidenceLevel: 'medium',
          },
          rawPayload: {
            suppressed: true,
          },
        },
        {
          itemId: 2,
          title: 'Newly blocked',
          legacy: {
            destinationLibraryId: 6,
            routeReady: true,
            blocked: false,
          },
          proposed: {
            destinationLibraryId: 6,
            routeReady: true,
            blocked: true,
            statusId: 'blocked',
          },
        },
      ],
    });

    expect(report.statusId).toBe(PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK);
    expect(report.differenceSummary.totalCount).toBeGreaterThan(3);
    expect(report.differenceSummary.emittedCount).toBe(3);
    expect(report.differenceSummary.truncated).toBe(true);
    expect(report.differenceSummary.byType).toEqual(expect.objectContaining({
      [PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE]: 1,
      [PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM]: 1,
      [PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_REVIEW_REQUIRED_ITEM]: 1,
      [PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.ROUTE_READINESS_CHANGE]: 1,
      [PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.EVIDENCE_CONFIDENCE_CHANGE]: 2,
    }));
    expect(report.sampleSummary.rawPayloadSuppressed).toBe(true);
    report.differences.forEach(difference => {
      expect(Object.values(PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS)).toContain(difference.typeId);
      expect(difference.exposesRawPayload).toBe(false);
      expect(difference.rawPayload).toBeUndefined();
    });
    expect(validatePolicyBuilderPhase7MigrationVerifierReport(report).ok).toBe(true);
  });

  test('does not allow replacement without operator acceptance and rollback', () => {
    const report = buildPolicyBuilderPhase7MigrationVerifierReport({
      proposal: buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(proposalInput()),
      legacyComparisonSamples: [],
    });

    expect(report.applicationGate).toEqual(expect.objectContaining({
      operatorAccepted: false,
      canApplyReplacement: false,
    }));
    expect(report.applicationGate.rollbackSnapshot.created).toBe(false);
    expect(validatePolicyBuilderPhase7MigrationVerifierReport(report).ok).toBe(true);

    report.applicationGate.canApplyReplacement = true;

    expect(validatePolicyBuilderPhase7MigrationVerifierReport(report).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_OPERATOR_ACCEPTANCE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_ROLLBACK,
        }),
      ]));
  });

  test('rejects normal-workflow verifier output, raw payload differences, and side effects', () => {
    const report = buildPolicyBuilderPhase7MigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
    });
    report.normalWorkflowSurface = true;
    report.sideEffects.policyReplaced = true;
    report.differences.push({
      typeId: PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE,
      rawPayload: {
        shouldNotLeak: true,
      },
      exposesRawPayload: true,
    });
    report.differenceSummary.emittedCount = report.differences.length;
    report.differenceSummary.totalCount = report.differences.length;

    expect(validatePolicyBuilderPhase7MigrationVerifierReport(report).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        }),
      ]));
  });

  test('blocks legacy deletion before Phase 8 stability or verifier pass', () => {
    const report = buildPolicyBuilderPhase7MigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [
        {
          itemId: 1,
          title: 'Destination changed',
          legacy: {
            destinationLibraryId: 7,
          },
          proposed: {
            destinationLibraryId: 6,
          },
        },
      ],
      rollbackSnapshot: {
        created: true,
        restorePath: 'policy_snapshots/snapshot-1.json',
      },
      deletionCriteria: {
        rollbackWindowActive: true,
        deleteChecklistApproved: true,
        customSignalReplacementDefined: true,
      },
    });

    expect(report.deletionReadiness.canDeleteLegacyPaths).toBe(false);

    report.deletionReadiness.canDeleteLegacyPaths = true;

    expect(validatePolicyBuilderPhase7MigrationVerifierReport(report).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_BEFORE_PHASE8_STABLE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_WITHOUT_VERIFIER_PASS,
        }),
      ]));
  });

  test('allows delete readiness only after all deletion criteria are met', () => {
    const report = buildPolicyBuilderPhase7MigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
      rollbackSnapshot: {
        created: true,
        restorePath: 'policy_snapshots/snapshot-1.json',
      },
      deletionCriteria: {
        phase8NativeIntentStable: true,
        rollbackWindowActive: true,
        deleteChecklistApproved: true,
        customSignalReplacementDefined: true,
      },
    });

    expect(report.deletionReadiness.canDeleteLegacyPaths).toBe(true);
    expect(validatePolicyBuilderPhase7MigrationVerifierReport(report).ok).toBe(true);
  });

  test('passes component audit and points to runtime metrics and decision trace', () => {
    const report = buildPolicyBuilderPhase7MigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
    });
    const audit = buildPolicyBuilderPhase7MigrationVerifierAudit(report);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_8',
      label: 'Runtime Metrics And Decision Trace',
    }));
  });
});
