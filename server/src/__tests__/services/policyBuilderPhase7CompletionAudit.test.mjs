import {
  PHASE7R_COMPLETION_COMPONENT_IDS,
  PHASE7R_COMPLETION_RISK_IDS,
  buildPolicyBuilderPhase7CompletionAudit,
  listPolicyBuilderPhase7CompletionComponents,
  validatePolicyBuilderPhase7CompletionRecord,
} from '../../services/policyBuilderPhase7CompletionAudit.mjs';

describe('policyBuilderPhase7CompletionAudit', () => {
  test('lists Phase 7R components in runtime/rebuild order', () => {
    expect(listPolicyBuilderPhase7CompletionComponents().map(component => component.id))
      .toEqual([
        PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
        PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
        PHASE7R_COMPLETION_COMPONENT_IDS.AUTOMATION_DECISION_CONTRACT,
        PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_QUESTION_REDUCTION,
        PHASE7R_COMPLETION_COMPONENT_IDS.REQUEST_TIME_LEARNING,
        PHASE7R_COMPLETION_COMPONENT_IDS.LIBRARY_POLICY_REBUILD,
        PHASE7R_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK,
        PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE,
        PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET,
      ]);
  });

  test('passes the default Phase 7R completion audit', () => {
    const audit = buildPolicyBuilderPhase7CompletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedComponentCount).toBe(9);
    expect(audit.requiredComponentCount).toBe(9);
    expect(audit.componentChecks.every(check =>
      check.recordOk === true && check.auditOk === true
    )).toBe(true);
    expect(audit.componentChecks.map(check => check.actualNextPhaseId))
      .toEqual([
        '7r_2',
        '7r_3',
        '7r_4',
        '7r_5',
        '7r_6',
        '7r_7',
        '7r_8',
        '7r_9',
        'phase7r_completion_audit',
      ]);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_1',
      label: 'Native Intent Storage And Legacy Removal',
    }));
  });

  test('rejects missing required components', () => {
    const components = listPolicyBuilderPhase7CompletionComponents()
      .filter(component =>
        component.id !== PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE
      );
    const audit = buildPolicyBuilderPhase7CompletionAudit({ components });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_COMPLETION_RISK_IDS.MISSING_COMPONENT,
        componentId: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE,
      }),
    ]));
  });

  test('rejects failed component audits and next-phase drift', () => {
    const componentAudits = {
      [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY]: {
        ok: true,
        issueCount: 0,
        nextPhase: {
          phaseId: 'wrong',
        },
      },
      [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION]: {
        ok: false,
        issueCount: 1,
        nextPhase: {
          phaseId: '7r_3',
        },
      },
    };
    const components = listPolicyBuilderPhase7CompletionComponents()
      .filter(component => [
        PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
        PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
      ].includes(component.id));
    const audit = buildPolicyBuilderPhase7CompletionAudit({
      components,
      componentAudits,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_COMPLETION_RISK_IDS.NEXT_PHASE_MISMATCH,
        componentId: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
      }),
      expect.objectContaining({
        riskId: PHASE7R_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
        componentId: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
      }),
    ]));
  });

  test('rejects completion records with missing artifact paths', () => {
    const record = {
      ...listPolicyBuilderPhase7CompletionComponents()[0],
      servicePath: 'server/src/services/missingPhase7Service.mjs',
    };

    expect(validatePolicyBuilderPhase7CompletionRecord(record).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
          fieldName: 'servicePath',
          path: 'server/src/services/missingPhase7Service.mjs',
        }),
      ]));
  });
});
