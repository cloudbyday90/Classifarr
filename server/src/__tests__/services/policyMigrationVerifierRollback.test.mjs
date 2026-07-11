import {
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput as buildPolicyLibraryPolicyRebuildProposal,
} from '../../services/policyLibraryPolicyRebuild.mjs';
import {
  POLICY_MIGRATION_DELETION_CRITERION_IDS,
  POLICY_MIGRATION_DIFFERENCE_TYPE_IDS,
  POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS,
  POLICY_MIGRATION_VERIFIER_STATUS_IDS,
  buildPolicyMigrationVerifierAudit,
  buildPolicyMigrationVerifierReportFromRebuildProposal as buildPolicyMigrationVerifierReport,
  buildPolicyMigrationVerifierReportFromRuntimeInput,
  validatePolicyMigrationVerifierReport,
} from '../../services/policyMigrationVerifierRollback.mjs';

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
  const proposal = buildPolicyLibraryPolicyRebuildProposal(proposalInput());
  proposal.acceptanceGate.accepted = true;
  proposal.acceptanceGate.acceptedBy = 'admin-1';
  proposal.acceptanceGate.acceptedAt = '2026-06-30T12:00:00.000Z';
  return proposal;
}

describe('policyMigrationVerifierRollback', () => {
  test('requires a valid rebuild proposal for the decision-only verifier reducer', () => {
    const proposal = acceptedProposal();

    expect(() => buildPolicyMigrationVerifierReport({
      proposal,
      proposalInput: proposalInput(),
    })).toThrow('raw input key "proposalInput"');
    expect(() => buildPolicyMigrationVerifierReport({
      proposal: {
        version: 'policy.library_policy_rebuild.v1',
      },
    })).toThrow('requires a valid rebuild proposal');
    expect(() => buildPolicyMigrationVerifierReportFromRuntimeInput({
      proposal,
    })).toThrow('received a rebuild proposal');

    const report = buildPolicyMigrationVerifierReport({
      proposal,
      legacyComparisonSamples: [],
    });
    const runtimeReport = buildPolicyMigrationVerifierReportFromRuntimeInput({
      proposalInput: proposalInput(),
      legacyComparisonSamples: [],
    });

    expect(report.proposal).toBe(proposal);
    expect(validatePolicyMigrationVerifierReport(report).ok).toBe(true);
    expect(validatePolicyMigrationVerifierReport(runtimeReport).ok).toBe(true);
  });

  test('builds a no-difference report with explicit rollback and deletion gates', () => {
    const report = buildPolicyMigrationVerifierReport({
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

    expect(report.statusId).toBe(POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES);
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
        criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.NATIVE_INTENT_STORAGE_STABLE,
        met: false,
      }),
    ]));
    expect(report.normalWorkflowSurface).toBe(false);
    expect(validatePolicyMigrationVerifierReport(report).ok).toBe(true);
  });

  test('emits only migration-relevant bounded differences', () => {
    const report = buildPolicyMigrationVerifierReport({
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

    expect(report.statusId).toBe(POLICY_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK);
    expect(report.differenceSummary.totalCount).toBeGreaterThan(3);
    expect(report.differenceSummary.emittedCount).toBe(3);
    expect(report.differenceSummary.truncated).toBe(true);
    expect(report.differenceSummary.byType).toEqual(expect.objectContaining({
      [POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE]: 1,
      [POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM]: 1,
      [POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_REVIEW_REQUIRED_ITEM]: 1,
      [POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.ROUTE_READINESS_CHANGE]: 1,
      [POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.EVIDENCE_CONFIDENCE_CHANGE]: 2,
    }));
    expect(report.sampleSummary.rawPayloadSuppressed).toBe(true);
    expect(report.sampleSetFingerprint).toEqual(expect.objectContaining({
      version: 'policy.migration_verifier_sample_set_fingerprint.v1',
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      provenance: expect.objectContaining({
        sampleCount: 2,
        rawPayloadSuppressed: true,
        maxDifferences: 3,
        confidenceDeltaThreshold: 0.1,
      }),
    }));
    expect(report.trace.attributes['classifarr.policy.migration_verifier.sample_set_fingerprint'])
      .toBe(report.sampleSetFingerprint.fingerprint);
    expect(JSON.stringify(report.sampleSetFingerprint)).not.toContain('Different destination');
    expect(JSON.stringify(report.sampleSetFingerprint)).not.toContain('Animated Movies');
    report.differences.forEach(difference => {
      expect(Object.values(POLICY_MIGRATION_DIFFERENCE_TYPE_IDS)).toContain(difference.typeId);
      expect(difference.exposesRawPayload).toBe(false);
      expect(difference.rawPayload).toBeUndefined();
    });
    expect(validatePolicyMigrationVerifierReport(report).ok).toBe(true);
  });

  test('builds stable sample-set fingerprints and changes them when comparison inputs change', () => {
    const baseReport = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      maxDifferences: 5,
      legacyComparisonSamples: [
        {
          itemId: 10674,
          title: 'Mulan',
          legacy: {
            destinationLibraryId: 6,
            routeReady: true,
            confidenceScore: 0.8,
          },
          proposed: {
            destinationLibraryId: 6,
            routeReady: true,
            confidenceScore: 0.8,
          },
        },
      ],
    });
    const reorderedEquivalentReport = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      maxDifferences: 5,
      legacyComparisonSamples: [
        {
          title: 'Mulan',
          itemId: 10674,
          proposed: {
            confidenceScore: 0.8,
            routeReady: true,
            destinationLibraryId: 6,
          },
          legacy: {
            confidenceScore: 0.8,
            routeReady: true,
            destinationLibraryId: 6,
          },
        },
      ],
    });
    const changedReport = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      maxDifferences: 5,
      legacyComparisonSamples: [
        {
          itemId: 10674,
          title: 'Mulan',
          legacy: {
            destinationLibraryId: 6,
            routeReady: true,
            confidenceScore: 0.8,
          },
          proposed: {
            destinationLibraryId: 7,
            routeReady: true,
            confidenceScore: 0.8,
          },
        },
      ],
    });

    expect(baseReport.sampleSetFingerprint.fingerprint)
      .toBe(reorderedEquivalentReport.sampleSetFingerprint.fingerprint);
    expect(baseReport.sampleSetFingerprint.fingerprint)
      .not.toBe(changedReport.sampleSetFingerprint.fingerprint);
    expect(validatePolicyMigrationVerifierReport(baseReport).ok).toBe(true);
  });

  test('rejects missing, malformed, or mismatched sample-set fingerprints', () => {
    const report = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
    });
    const missing = {
      ...report,
      sampleSetFingerprint: null,
    };
    const malformed = {
      ...report,
      sampleSetFingerprint: {
        ...report.sampleSetFingerprint,
        fingerprint: 'not-a-sha256',
      },
    };
    const mismatched = {
      ...report,
      trace: {
        ...report.trace,
        attributes: {
          ...report.trace.attributes,
          'classifarr.policy.migration_verifier.sample_set_fingerprint': 'b'.repeat(64),
        },
      },
    };

    expect(validatePolicyMigrationVerifierReport(missing).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_SAMPLE_SET_FINGERPRINT,
        }),
      ]));
    expect(validatePolicyMigrationVerifierReport(malformed).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MALFORMED_SAMPLE_SET_FINGERPRINT,
        }),
      ]));
    expect(validatePolicyMigrationVerifierReport(mismatched).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.TRACE_SAMPLE_SET_FINGERPRINT_MISMATCH,
        }),
      ]));
  });

  test('rejects stale proposal validation proof and sample-set provenance drift', () => {
    const report = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
    });
    const missingValidation = {
      ...report,
      proposalValidation: undefined,
    };
    const staleValidation = {
      ...report,
      proposal: {
        ...report.proposal,
        acceptanceGate: {
          ...report.proposal.acceptanceGate,
          requiresExplicitOperatorAcceptance: false,
        },
      },
    };
    const provenanceDrift = {
      ...report,
      sampleSetFingerprint: {
        ...report.sampleSetFingerprint,
        provenance: {
          ...report.sampleSetFingerprint.provenance,
          proposalGuardedOutcomeRequestProofCount: 999,
        },
      },
    };

    expect(validatePolicyMigrationVerifierReport(missingValidation).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_PROPOSAL_VALIDATION,
        }),
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_PROPOSAL,
        }),
      ]));
    expect(validatePolicyMigrationVerifierReport(staleValidation).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.PROPOSAL_VALIDATION_MISMATCH,
        }),
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_PROPOSAL,
        }),
      ]));
    expect(validatePolicyMigrationVerifierReport(provenanceDrift).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.SAMPLE_SET_PROVENANCE_MISMATCH,
        }),
      ]));
  });

  test('does not allow replacement without operator acceptance and rollback', () => {
    const report = buildPolicyMigrationVerifierReport({
      proposal: buildPolicyLibraryPolicyRebuildProposal(proposalInput()),
      legacyComparisonSamples: [],
    });

    expect(report.applicationGate).toEqual(expect.objectContaining({
      operatorAccepted: false,
      canApplyReplacement: false,
    }));
    expect(report.applicationGate.rollbackSnapshot.created).toBe(false);
    expect(validatePolicyMigrationVerifierReport(report).ok).toBe(true);

    report.applicationGate.canApplyReplacement = true;

    expect(validatePolicyMigrationVerifierReport(report).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_OPERATOR_ACCEPTANCE,
        }),
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_ROLLBACK,
        }),
      ]));
  });

  test('rejects normal-workflow verifier output, raw payload differences, and side effects', () => {
    const report = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
    });
    report.normalWorkflowSurface = true;
    report.sideEffects.policyReplaced = true;
    report.differences.push({
      typeId: POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE,
      rawPayload: {
        shouldNotLeak: true,
      },
      exposesRawPayload: true,
    });
    report.differenceSummary.emittedCount = report.differences.length;
    report.differenceSummary.totalCount = report.differences.length;

    expect(validatePolicyMigrationVerifierReport(report).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
        }),
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        }),
      ]));
  });

  test('blocks legacy deletion before native intent storage is stable or verifier passes', () => {
    const report = buildPolicyMigrationVerifierReport({
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

    expect(validatePolicyMigrationVerifierReport(report).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_BEFORE_NATIVE_INTENT_STABLE,
        }),
        expect.objectContaining({
          riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_WITHOUT_VERIFIER_PASS,
        }),
      ]));
  });

  test('allows delete readiness only after all deletion criteria are met', () => {
    const report = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
      rollbackSnapshot: {
        created: true,
        restorePath: 'policy_snapshots/snapshot-1.json',
      },
      deletionCriteria: {
        nativeIntentStorageStable: true,
        rollbackWindowActive: true,
        deleteChecklistApproved: true,
        customSignalReplacementDefined: true,
      },
    });

    expect(report.deletionReadiness.canDeleteLegacyPaths).toBe(true);
    expect(validatePolicyMigrationVerifierReport(report).ok).toBe(true);
  });

  test('does not accept the retired phase-named native storage criterion', () => {
    const report = buildPolicyMigrationVerifierReport({
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

    expect(report.deletionReadiness.canDeleteLegacyPaths).toBe(false);
    expect(report.deletionReadiness.criteria).toEqual(expect.arrayContaining([
      expect.objectContaining({
        criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.NATIVE_INTENT_STORAGE_STABLE,
        met: false,
      }),
    ]));
  });

  test('passes component audit and points to runtime metrics and decision trace', () => {
    const report = buildPolicyMigrationVerifierReport({
      proposal: acceptedProposal(),
      legacyComparisonSamples: [],
    });
    const audit = buildPolicyMigrationVerifierAudit(report);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'runtime_metrics_trace',
      label: 'Runtime Metrics And Decision Trace',
    }));
  });
});
