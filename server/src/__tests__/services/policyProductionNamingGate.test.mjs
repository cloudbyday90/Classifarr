import {
  POLICY_PRODUCTION_NAMING_GATE_STATUS_IDS,
  buildPolicyProductionNamingGate,
} from '../../../../scripts/lib/policyProductionNamingGate.mjs';
import {
  POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE,
} from '../../services/policyProductionNamingRegressionAudit.mjs';

function inventory(overrides = {}) {
  return {
    version: 'policy_builder.production_name_inventory.v1',
    validation: {
      ok: true,
      riskCount: 0,
      risks: [],
    },
    summary: {
      productionReferenceCount: 0,
      renameCandidateCount: 0,
      obsoleteToolingCount: 0,
    },
    references: [],
    sideEffects: {
      filesRead: true,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    },
    ...overrides,
  };
}

describe('policyProductionNamingGate', () => {
  test('completes when the current repository inventory satisfies the zero-debt baseline', () => {
    const gate = buildPolicyProductionNamingGate({
      inventory: inventory(),
      generatedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(gate.statusId).toBe(POLICY_PRODUCTION_NAMING_GATE_STATUS_IDS.COMPLETE);
    expect(gate.complete).toBe(true);
    expect(gate.riskCount).toBe(0);
    expect(gate.nextAction.id).toBe('continue_next_product_domain_component');
    expect(gate.sideEffects).toEqual({
      filesRead: true,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
  });

  test('blocks when a newly introduced production reference exceeds the baseline', () => {
    const gate = buildPolicyProductionNamingGate({
      inventory: inventory({
        summary: {
          productionReferenceCount:
            POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxProductionReferenceCount + 1,
          renameCandidateCount:
            POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxRenameCandidateCount + 1,
          obsoleteToolingCount: 0,
        },
      }),
    });

    expect(gate.statusId).toBe(POLICY_PRODUCTION_NAMING_GATE_STATUS_IDS.BLOCKED);
    expect(gate.complete).toBe(false);
    expect(gate.riskCount).toBeGreaterThan(0);
    expect(gate.nextAction.id).toBe('reduce_or_classify_new_temporary_references');
  });
});
