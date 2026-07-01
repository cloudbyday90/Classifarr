import {
  PHASE7R_TEST_RESET_AUDIT_RISK_IDS,
  PHASE7R_TEST_RESET_COVERAGE_IDS,
  PHASE7R_TEST_RESET_DECISION_IDS,
  buildPolicyBuilderPhase7RuntimeRebuildTestReset,
  buildPolicyBuilderPhase7RuntimeRebuildTestResetAudit,
  listPolicyBuilderPhase7TestResetArtifacts,
  validatePolicyBuilderPhase7RuntimeRebuildTestReset,
} from '../../services/policyBuilderPhase7RuntimeRebuildTestReset.mjs';

describe('policyBuilderPhase7RuntimeRebuildTestReset', () => {
  test('categorizes existing runtime, rebuild, and old diagnostic preview tests', () => {
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset();

    expect(reset.version).toBe('phase7r.runtime_rebuild_test_reset.v1');
    expect(reset.summary.decisionCounts).toEqual(expect.objectContaining({
      [PHASE7R_TEST_RESET_DECISION_IDS.KEEP_CLASSIFICATION_REGRESSION]: 1,
      [PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_EVIDENCE_PROJECTION]: 1,
      [PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION]: 1,
      [PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_QUESTION_CONTRACT]: 1,
      [PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_LEARNING_GUARD]: 1,
      [PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER]: 2,
      [PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_RUNTIME_METRICS]: 1,
      [PHASE7R_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC]: 2,
    }));
    expect(reset.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'server/src/__tests__/services/policyBuilderPhase7AutomationDecisionContract.test.mjs',
        decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION,
      }),
      expect.objectContaining({
        path: 'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
        decisionId: PHASE7R_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC,
        normalWorkflowAllowed: false,
      }),
      expect.objectContaining({
        path: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
        decisionId: PHASE7R_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC,
        normalWorkflowAllowed: false,
      }),
    ]));
    expect(reset.validation.ok).toBe(true);
  });

  test('maps required runtime and rebuild reset coverage to server-owned contracts', () => {
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset();
    const coverageById = new Map(
      reset.coveragePlan.map(coverage => [coverage.coverageId, coverage])
    );

    [
      PHASE7R_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
      PHASE7R_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
      PHASE7R_TEST_RESET_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
      PHASE7R_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
      PHASE7R_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
      PHASE7R_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ].forEach(coverageId => {
      expect(coverageById.get(coverageId)).toEqual(expect.objectContaining({
        covered: true,
      }));
      expect(coverageById.get(coverageId).artifactPaths.length).toBeGreaterThan(0);
    });

    expect(coverageById.get(
      PHASE7R_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED
    ).artifactPaths).toContain(
      'server/src/__tests__/services/policyBuilderPhase7AutomationDecisionContract.test.mjs'
    );
  });

  test('rejects missing required coverage before the reset can pass', () => {
    const artifacts = listPolicyBuilderPhase7TestResetArtifacts()
      .map(artifact => ({
        ...artifact,
        coverageIds: artifact.coverageIds.filter(coverageId =>
          coverageId !== PHASE7R_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD
        ),
      }));
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_COVERAGE_UNMAPPED,
        coverageId: PHASE7R_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
      }),
    ]));
  });

  test('rejects runtime rewrites that do not protect server authority', () => {
    const artifacts = listPolicyBuilderPhase7TestResetArtifacts();
    const weakened = artifacts.map(artifact =>
      artifact.decisionId === PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION
        ? { ...artifact, protectsAuthority: false }
        : artifact
    );
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset({ artifacts: weakened });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.SERVER_AUTHORITY_NOT_PROTECTED,
        artifactPath: 'server/src/__tests__/services/policyBuilderPhase7AutomationDecisionContract.test.mjs',
      }),
    ]));
  });

  test('rejects missing-routing coverage that does not distinguish classification from routing', () => {
    const artifacts = listPolicyBuilderPhase7TestResetArtifacts();
    const weakened = artifacts.map(artifact =>
      artifact.coverageIds.includes(
        PHASE7R_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED
      )
        ? { ...artifact, distinguishesClassificationFromRouting: false }
        : artifact
    );
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset({ artifacts: weakened });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.CLASSIFICATION_ROUTING_NOT_DISTINGUISHED,
      }),
    ]));
  });

  test('rejects old preview UI as frozen migration behavior or active workflow', () => {
    const artifacts = listPolicyBuilderPhase7TestResetArtifacts();
    const frozen = artifacts.map(artifact =>
      artifact.path === 'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js'
        ? {
          ...artifact,
          preservesOldPreviewUi: true,
          normalWorkflowAllowed: true,
        }
        : artifact
    );
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset({ artifacts: frozen });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
      }),
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.DELETE_TARGET_STILL_NORMAL_WORKFLOW,
      }),
    ]));
  });

  test('rejects unknown decisions, coverage ids, missing replacement, and missing trace reasons', () => {
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset({
      artifacts: [
        {
          path: 'server/src/__tests__/services/example.test.mjs',
          owner: 'server',
          decisionId: 'unknown',
          coverageIds: ['unknown_coverage'],
          replacement: '',
          protectsAuthority: true,
          distinguishesClassificationFromRouting: true,
          preservesOldPreviewUi: false,
          deleteAfterMigration: false,
          normalWorkflowAllowed: true,
          traceReasons: [],
        },
      ],
    });

    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_DECISION,
      }),
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_COVERAGE,
      }),
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
      }),
      expect.objectContaining({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      }),
    ]));
  });

  test('audits cleanly and points to the Phase 7R completion audit', () => {
    const reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset();
    const audit = buildPolicyBuilderPhase7RuntimeRebuildTestResetAudit(reset);

    expect(validatePolicyBuilderPhase7RuntimeRebuildTestReset(reset).ok).toBe(true);
    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      artifactCount: reset.artifacts.length,
      nextPhase: expect.objectContaining({
        phaseId: 'phase7r_completion_audit',
      }),
    }));
  });
});
