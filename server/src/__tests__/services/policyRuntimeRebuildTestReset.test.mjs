import {
  POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS,
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS,
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS,
  buildPolicyRuntimeRebuildTestReset,
  buildPolicyRuntimeRebuildTestResetAudit,
  listPolicyRuntimeRebuildTestResetArtifacts,
  validatePolicyRuntimeRebuildTestReset,
} from '../../services/policyRuntimeRebuildTestReset.mjs';

describe('policyRuntimeRebuildTestReset', () => {
  test('categorizes current runtime and rebuild tests without retired browser diagnostics', () => {
    const reset = buildPolicyRuntimeRebuildTestReset();

    expect(reset.version).toBe('policy.runtime_rebuild_test_reset.v1');
    expect(reset.summary.decisionCounts).toEqual(expect.objectContaining({
      [POLICY_RUNTIME_TEST_RESET_DECISION_IDS.KEEP_CLASSIFICATION_REGRESSION]: 1,
      [POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_EVIDENCE_PROJECTION]: 1,
      [POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION]: 1,
      [POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_QUESTION_CONTRACT]: 1,
      [POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_LEARNING_GUARD]: 2,
      [POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER]: 3,
      [POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_RUNTIME_METRICS]: 2,
    }));
    expect(reset.summary.existingArtifactCount).toBe(reset.summary.artifactCount);
    expect(reset.artifactAvailability.every(artifact =>
      artifact.withinRepo === true && artifact.exists === true
    )).toBe(true);
    expect(reset.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'server/src/__tests__/services/policyAutomationDecisionContract.test.mjs',
        decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION,
      }),
    ]));
    expect(reset.validation.ok).toBe(true);
    expect(reset.summary.requiredContractCount).toBe(10);
    expect(reset.summary.coveredRequiredContractCount).toBe(10);
  });

  test('rejects missing or repository-escaping reset artifact paths', () => {
    const artifacts = [
      {
        ...listPolicyRuntimeRebuildTestResetArtifacts()[0],
        path: 'server/src/__tests__/services/missing-runtime-reset.test.mjs',
      },
      {
        ...listPolicyRuntimeRebuildTestResetArtifacts()[1],
        path: '../outside-repo.test.mjs',
      },
    ];
    const reset = buildPolicyRuntimeRebuildTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_FILE_MISSING,
        artifactPath: 'server/src/__tests__/services/missing-runtime-reset.test.mjs',
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_PATH_OUTSIDE_REPO,
        artifactPath: '../outside-repo.test.mjs',
      }),
    ]));
  });

  test('maps required runtime and rebuild reset coverage to server-owned contracts', () => {
    const reset = buildPolicyRuntimeRebuildTestReset();
    const coverageById = new Map(
      reset.coveragePlan.map(coverage => [coverage.coverageId, coverage])
    );

    [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ].forEach(coverageId => {
      expect(coverageById.get(coverageId)).toEqual(expect.objectContaining({
        covered: true,
      }));
      expect(coverageById.get(coverageId).artifactPaths.length).toBeGreaterThan(0);
    });

    expect(coverageById.get(
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED
    ).artifactPaths).toContain(
      'server/src/__tests__/services/policyAutomationDecisionContract.test.mjs'
    );
  });

  test('rejects missing required coverage before the reset can pass', () => {
    const artifacts = listPolicyRuntimeRebuildTestResetArtifacts()
      .map(artifact => ({
        ...artifact,
        coverageIds: artifact.coverageIds.filter(coverageId =>
          coverageId !== POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD
        ),
      }));
    const reset = buildPolicyRuntimeRebuildTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_COVERAGE_UNMAPPED,
        coverageId: POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
      }),
    ]));
  });

  test('rejects runtime rewrites that do not protect server authority', () => {
    const artifacts = listPolicyRuntimeRebuildTestResetArtifacts();
    const weakened = artifacts.map(artifact =>
      artifact.decisionId === POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION
        ? { ...artifact, protectsAuthority: false }
        : artifact
    );
    const reset = buildPolicyRuntimeRebuildTestReset({ artifacts: weakened });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.SERVER_AUTHORITY_NOT_PROTECTED,
        artifactPath: 'server/src/__tests__/services/policyAutomationDecisionContract.test.mjs',
      }),
    ]));
  });

  test('rejects missing-routing coverage that does not distinguish classification from routing', () => {
    const artifacts = listPolicyRuntimeRebuildTestResetArtifacts();
    const weakened = artifacts.map(artifact =>
      artifact.coverageIds.includes(
        POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED
      )
        ? { ...artifact, distinguishesClassificationFromRouting: false }
        : artifact
    );
    const reset = buildPolicyRuntimeRebuildTestReset({ artifacts: weakened });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.CLASSIFICATION_ROUTING_NOT_DISTINGUISHED,
      }),
    ]));
  });

  test('rejects a synthetic retired diagnostic test when it is reintroduced into the workflow', () => {
    const artifacts = listPolicyRuntimeRebuildTestResetArtifacts();
    const frozen = artifacts.map(artifact =>
      artifact.path === 'server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs'
        ? {
          ...artifact,
          decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC,
          preservesOldPreviewUi: true,
          normalWorkflowAllowed: true,
        }
        : artifact
    );
    const reset = buildPolicyRuntimeRebuildTestReset({ artifacts: frozen });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.DELETE_TARGET_STILL_NORMAL_WORKFLOW,
      }),
    ]));
  });

  test('rejects a runtime artifact that does not import its declared contract', () => {
    const artifacts = listPolicyRuntimeRebuildTestResetArtifacts().map(artifact =>
      artifact.path === 'server/src/__tests__/services/policyRuntimeMetricsInput.test.mjs'
        ? {
          ...artifact,
          contractIds: [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_TRACE],
        }
        : artifact
    );
    const reset = buildPolicyRuntimeRebuildTestReset({ artifacts });

    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_CONTRACT_MARKER_MISSING,
        artifactPath: 'server/src/__tests__/services/policyRuntimeMetricsInput.test.mjs',
        contractId: POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_TRACE,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_CONTRACT_UNMAPPED,
        contractId: POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_INPUT,
      }),
    ]));
  });

  test('rejects unknown decisions, coverage ids, missing replacement, and missing trace reasons', () => {
    const reset = buildPolicyRuntimeRebuildTestReset({
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
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_DECISION,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_COVERAGE,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      }),
    ]));
  });

  test('audits cleanly and points to the runtime contract completion audit', () => {
    const reset = buildPolicyRuntimeRebuildTestReset();
    const audit = buildPolicyRuntimeRebuildTestResetAudit(reset);

    expect(validatePolicyRuntimeRebuildTestReset(reset).ok).toBe(true);
    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      artifactCount: reset.artifacts.length,
      requiredContractCount: 10,
      coveredRequiredContractCount: 10,
      nextStep: expect.objectContaining({
        stepId: 'completion_audit',
      }),
    }));
  });
});
