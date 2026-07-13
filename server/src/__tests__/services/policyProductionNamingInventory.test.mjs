import {
  PRODUCTION_NAMING_CATEGORY_IDS,
  PRODUCTION_NAMING_DECISION_IDS,
  PRODUCTION_NAMING_RISK_IDS,
  buildPolicyProductionNamingInventory,
  extractInventoryReferences,
  validatePolicyBuilderProductionNameInventory,
} from '../../../../scripts/lib/policyProductionNamingInventory.mjs';

function sampleFiles() {
  return [
    {
      path: 'server/src/services/policyIntentEngine.mjs',
      content: `
const PHASE6_INTENT_VERSION = 'phase6r.intent_engine.v1';
export function buildPolicyBuilderPhase6IntentEngine() {}
`,
    },
    {
      path: 'server/src/services/policyBuilderPhase8NativeRuntimeReadPath.mjs',
      content: `
const PHASE8R_NATIVE_RUNTIME_READ_PATH_VERSION = 'phase8r.native_runtime_read_path.v1';
`,
    },
    {
      path: 'server/src/routes/classificationProgress.mjs',
      content: "import { classificationProgressStageService } from '../services/classificationProgressStageService.mjs';",
    },
    {
      path: 'docs/architecture/policy-builder-intent-model-roadmap.md',
      content: '## Phase 8R: Native Intent Storage And Legacy Removal',
    },
    {
      path: 'server/src/__tests__/services/policyNativeSchemaContract.test.mjs',
      content: "test('keeps Phase 8R migration evidence', () => {});",
    },
    {
      path: 'scripts/generate-policy-builder-phase-8r-completion-audit.mjs',
      content: "console.log('Phase 8R completion audit artifact');",
    },
    {
      path: 'package.json',
      content: '"policy:phase8r:completion-audit": "node scripts/generate-policy-builder-phase-8r-completion-audit.mjs"',
    },
  ];
}

describe('policyProductionNamingInventory', () => {
  test('classifies phase-coded production references before any durable rename work begins', () => {
    const inventory = buildPolicyProductionNamingInventory({
      files: sampleFiles(),
      generatedAt: '2026-07-03T10:00:00.000Z',
    });

    expect(inventory.validation.ok).toBe(true);
    expect(inventory.summary.productionReferenceCount).toBeGreaterThan(0);
    expect(inventory.summary.renameCandidateCount).toBeGreaterThan(0);
    expect(inventory.summary.keepHistoryCount).toBeGreaterThan(0);
    expect(inventory.summary.testOrMigrationEvidenceCount).toBeGreaterThan(0);
    expect(inventory.summary.obsoleteToolingCount).toBeGreaterThan(0);
    expect(inventory.nextStep.stepId).toBe('durable_domain_module_cutover');
    expect(inventory.nextPhase).toBeUndefined();
    expect(inventory.sideEffects).toEqual({
      filesRead: false,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
  });

  test('maps production phase-coded services to durable product-domain targets', () => {
    const inventory = buildPolicyProductionNamingInventory({
      files: sampleFiles(),
      generatedAt: '2026-07-03T10:00:00.000Z',
    });

    expect(inventory.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        repoPath: 'server/src/services/policyIntentEngine.mjs',
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE,
        durableTarget: 'policyIntentInference',
      }),
      expect.objectContaining({
        repoPath: 'server/src/services/policyBuilderPhase8NativeRuntimeReadPath.mjs',
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE,
        durableTarget: 'nativePolicyIntentReadPath',
      }),
    ]));
    expect(inventory.renameMap).toEqual(expect.arrayContaining([
      expect.objectContaining({
        repoPath: 'server/src/services/policyIntentEngine.mjs',
        durableTarget: 'policyIntentInference',
      }),
    ]));
    expect(inventory.references).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        repoPath: 'server/src/routes/classificationProgress.mjs',
        durableTarget: 'classificationProgressStageService',
      }),
    ]));
  });

  test('keeps docs and tests as history or migration evidence while scripts/package commands are deletion candidates', () => {
    const inventory = buildPolicyProductionNamingInventory({
      files: sampleFiles(),
      generatedAt: '2026-07-03T10:00:00.000Z',
    });

    expect(inventory.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        repoPath: 'docs/architecture/policy-builder-intent-model-roadmap.md',
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.DOCS_HISTORY,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.KEEP_DOCS_HISTORY,
      }),
      expect.objectContaining({
        repoPath: 'server/src/__tests__/services/policyNativeSchemaContract.test.mjs',
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.TEST,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.KEEP_TEST_MIGRATION_EVIDENCE,
      }),
      expect.objectContaining({
        repoPath: 'scripts/generate-policy-builder-phase-8r-completion-audit.mjs',
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.SCRIPT_OR_COMMAND,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.DELETE_WITH_OBSOLETE_MIGRATION_TOOLING,
      }),
      expect.objectContaining({
        repoPath: 'package.json',
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.SCRIPT_OR_COMMAND,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.DELETE_WITH_OBSOLETE_MIGRATION_TOOLING,
      }),
    ]));
  });

  test('keeps historic-token scanners in maintenance tooling without treating them as production debt', () => {
    const inventory = buildPolicyProductionNamingInventory({
      files: [
        {
          path: 'scripts/lib/policyProductionNamingInventory.mjs',
          content: "const tokens = ['Phase', '6R'];",
        },
        {
          path: 'scripts/lib/policyProductLanguageAudit.mjs',
          content: "const matcher = /phase[0-9]+/i;",
        },
        {
          path: 'scripts/lib/policyDeliveryTermMatcher.mjs',
          content: "const tokens = ['0R', 'R6'];",
        },
      ],
    });

    expect(inventory.validation.ok).toBe(true);
    expect(inventory.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.SCRIPT_OR_COMMAND,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.KEEP_MAINTENANCE_HISTORIC_SCANNER,
      }),
    ]));
    expect(inventory.summary.productionReferenceCount).toBe(0);
    expect(inventory.summary.renameCandidateCount).toBe(0);
  });

  test('extracts only lines that contain phase-coded tokens', () => {
    const references = extractInventoryReferences([
      {
        path: 'server/src/services/policyIntentInference.mjs',
        content: [
          'const stableName = true;',
          "const oldName = 'phase6r.intent_engine.v1';",
        ].join('\n'),
      },
    ]);

    expect(references).toHaveLength(1);
    expect(references[0]).toEqual(expect.objectContaining({
      lineNumber: 2,
      tokens: expect.arrayContaining(['phase']),
    }));
  });

  test('rejects unclassified references, production keeps without adapter gates, missing durable targets, and side effects', () => {
    const validation = validatePolicyBuilderProductionNameInventory({
      references: [
        {
          repoPath: 'server/src/services/example.mjs',
          lineNumber: 1,
          categoryId: PRODUCTION_NAMING_CATEGORY_IDS.UNKNOWN,
          decisionId: '',
          durableTarget: '',
        },
        {
          repoPath: 'server/src/services/example.mjs',
          lineNumber: 2,
          categoryId: PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION,
          decisionId: PRODUCTION_NAMING_DECISION_IDS.KEEP_DOCS_HISTORY,
          durableTarget: '',
        },
        {
          repoPath: 'server/src/services/example.mjs',
          lineNumber: 3,
          categoryId: PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION,
          decisionId: PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE,
          durableTarget: '',
        },
      ],
      sideEffects: {
        filesRead: true,
        filesWritten: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PRODUCTION_NAMING_RISK_IDS.UNCLASSIFIED_REFERENCE,
      }),
      expect.objectContaining({
        riskId: PRODUCTION_NAMING_RISK_IDS.PRODUCTION_KEEP_WITHOUT_ADAPTER_GATE,
      }),
      expect.objectContaining({
        riskId: PRODUCTION_NAMING_RISK_IDS.MISSING_DURABLE_TARGET,
      }),
      expect.objectContaining({
        riskId: PRODUCTION_NAMING_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffectId: 'filesWritten',
      }),
    ]));
  });
});
