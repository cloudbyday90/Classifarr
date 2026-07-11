import {
  POLICY_RUNTIME_COMPLETION_COMPONENT_IDS,
  POLICY_RUNTIME_COMPLETION_RISK_IDS,
  buildPolicyRuntimeCompletionAudit,
  listPolicyRuntimeCompletionComponents,
  validatePolicyRuntimeCompletionRecord,
} from '../../services/policyRuntimeCompletionAudit.mjs';

describe('policyRuntimeCompletionAudit', () => {
  test('lists runtime components in runtime/rebuild order', () => {
    expect(listPolicyRuntimeCompletionComponents().map(component => component.id))
      .toEqual([
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.AUTOMATION_DECISION_CONTRACT,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_QUESTION_REDUCTION,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.REQUEST_TIME_LEARNING,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_POLICY_REBUILD,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET,
      ]);
  });

  test('passes the default runtime completion audit', () => {
    const audit = buildPolicyRuntimeCompletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedComponentCount).toBe(9);
    expect(audit.requiredComponentCount).toBe(9);
    expect(audit.componentChecks.every(check =>
      check.recordOk === true && check.auditOk === true && check.testContractCoverageOk === true
    )).toBe(true);
    expect(audit.componentChecks.map(check => check.actualNextStepId))
      .toEqual([
        'runtime_evidence_projection',
        'automation_decision_contract',
        'runtime_question_reduction',
        'request_time_learning',
        'library_policy_rebuild',
        'migration_verifier_rollback',
        'runtime_metrics_trace',
        'runtime_rebuild_test_reset',
        'completion_audit',
      ]);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'native_intent_storage',
      label: 'Native Intent Storage And Legacy Removal',
    }));
  });

  test('rejects missing required components', () => {
    const components = listPolicyRuntimeCompletionComponents()
      .filter(component =>
        component.id !== POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE
      );
    const audit = buildPolicyRuntimeCompletionAudit({ components });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_COMPONENT,
        componentId: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE,
      }),
    ]));
  });

  test('rejects failed component audits and next-step drift', () => {
    const componentAudits = {
      [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY]: {
        ok: true,
        issueCount: 0,
        nextStep: {
          stepId: 'wrong',
        },
      },
      [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION]: {
        ok: false,
        issueCount: 1,
        nextStep: {
          stepId: 'automation_decision_contract',
        },
      },
    };
    const components = listPolicyRuntimeCompletionComponents()
      .filter(component => [
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
        POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
      ].includes(component.id));
    const audit = buildPolicyRuntimeCompletionAudit({
      components,
      componentAudits,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_COMPLETION_RISK_IDS.NEXT_STEP_MISMATCH,
        componentId: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
        componentId: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
      }),
    ]));
  });

  test('rejects a passing reset audit with incomplete contract ownership', () => {
    const components = listPolicyRuntimeCompletionComponents()
      .filter(component =>
        component.id === POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET
      );
    const componentAudits = {
      [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET]: {
        ok: true,
        issueCount: 0,
        requiredContractCount: 9,
        coveredRequiredContractCount: 8,
        nextStep: {
          stepId: 'completion_audit',
        },
      },
    };
    const audit = buildPolicyRuntimeCompletionAudit({ components, componentAudits });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_COMPLETION_RISK_IDS.TEST_RESET_CONTRACT_COVERAGE_INCOMPLETE,
        componentId: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET,
        requiredContractCount: 9,
        coveredRequiredContractCount: 8,
      }),
    ]));
  });

  test('rejects completion records with missing artifact paths', () => {
    const record = {
      ...listPolicyRuntimeCompletionComponents()[0],
      servicePath: 'server/src/services/missingRuntimeService.mjs',
    };

    expect(validatePolicyRuntimeCompletionRecord(record).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
          fieldName: 'servicePath',
          path: 'server/src/services/missingRuntimeService.mjs',
        }),
      ]));
  });
});
