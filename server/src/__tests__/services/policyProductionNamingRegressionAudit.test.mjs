import {
  PRODUCTION_NAMING_CATEGORY_IDS,
  PRODUCTION_NAMING_DECISION_IDS,
} from '../../../../scripts/lib/policyProductionNamingInventory.mjs';
import {
  POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE,
  POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS,
  buildPolicyProductionNamingRegressionAudit,
} from '../../services/policyProductionNamingRegressionAudit.mjs';

function buildInventory(overrides = {}) {
  return {
    validation: {
      ok: true,
      riskCount: 0,
      risks: [],
    },
    summary: {
      productionReferenceCount:
        POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxProductionReferenceCount,
      renameCandidateCount:
        POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxRenameCandidateCount,
      obsoleteToolingCount:
        POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxObsoleteToolingCount,
      ...overrides.summary,
    },
    references: overrides.references || [],
    sideEffects: {
      filesRead: true,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
      ...overrides.sideEffects,
    },
    ...overrides.inventory,
  };
}

describe('policyProductionNamingRegressionAudit', () => {
  test('passes when current phase-coded production naming debt stays within baseline', () => {
    const audit = buildPolicyProductionNamingRegressionAudit({
      inventory: buildInventory(),
    });

    expect(audit.ok).toBe(true);
    expect(audit.riskCount).toBe(0);
    expect(audit.summary.remainingProductionRenameCount)
      .toBe(POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxRenameCandidateCount);
    expect(audit.deltas).toEqual({
      productionReferenceDelta: 0,
      renameCandidateDelta: 0,
      obsoleteToolingDelta: 0,
    });
    expect(audit.nextAction.id).toBe('continue_durable_module_cutover');
  });

  test('rejects missing or invalid inventory input', () => {
    const missingAudit = buildPolicyProductionNamingRegressionAudit();
    const invalidAudit = buildPolicyProductionNamingRegressionAudit({
      inventory: buildInventory({
        inventory: {
          validation: {
            ok: false,
            riskCount: 1,
            risks: [
              {
                riskId: 'unclassified_reference',
              },
            ],
          },
        },
      }),
    });

    expect(missingAudit.ok).toBe(false);
    expect(missingAudit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.MISSING_INVENTORY,
      }),
    ]));
    expect(invalidAudit.ok).toBe(false);
    expect(invalidAudit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.INVENTORY_INVALID,
        inventoryRiskCount: 1,
      }),
    ]));
  });

  test('rejects increases in production references, rename candidates, and obsolete tooling', () => {
    const audit = buildPolicyProductionNamingRegressionAudit({
      inventory: buildInventory({
        summary: {
          productionReferenceCount:
            POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxProductionReferenceCount + 1,
          renameCandidateCount:
            POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxRenameCandidateCount + 1,
          obsoleteToolingCount:
            POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE.maxObsoleteToolingCount + 1,
        },
      }),
    });

    expect(audit.ok).toBe(false);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.PRODUCTION_REFERENCE_INCREASED,
      }),
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.RENAME_CANDIDATE_INCREASED,
      }),
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.OBSOLETE_TOOLING_INCREASED,
      }),
    ]));
    expect(audit.nextAction.id).toBe('reduce_or_classify_new_temporary_references');
  });

  test('rejects unbounded temporary adapters and side effects', () => {
    const audit = buildPolicyProductionNamingRegressionAudit({
      inventory: buildInventory({
        references: [
          {
            repoPath: 'server/src/services/policyIntentInference.mjs',
            lineNumber: 10,
            categoryId: PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION,
            decisionId: PRODUCTION_NAMING_DECISION_IDS.TEMPORARY_ADAPTER_WITH_DELETION_GATE,
            adapterDeletionGate: '',
          },
        ],
        sideEffects: {
          filesWritten: true,
        },
      }),
    });

    expect(audit.ok).toBe(false);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.ADAPTER_DELETION_GATE_MISSING,
        repoPath: 'server/src/services/policyIntentInference.mjs',
      }),
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffectId: 'filesWritten',
      }),
    ]));
  });

  test('requires a generated inventory instead of scanning source files from application code', () => {
    const audit = buildPolicyProductionNamingRegressionAudit({
      files: [
        {
          path: 'server/src/services/policyIntentEngine.mjs',
          content: 'export const phaseName = "Phase 6R";',
        },
      ],
    });

    expect(audit.ok).toBe(false);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.MISSING_INVENTORY,
      }),
    ]));
  });
});
