import {
  PRODUCTION_NAMING_CATEGORY_IDS,
  PRODUCTION_NAMING_DECISION_IDS,
  PRODUCTION_NAMING_RISK_IDS,
  buildPolicyBuilderProductionNameInventory,
  extractInventoryReferences,
  validatePolicyBuilderProductionNameInventory,
} from '../../services/policyBuilderProductionNameInventory.mjs';

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
      path: 'server/src/services/policyBuilderPhase8NativeSchemaContract.mjs',
      content: `
const PHASE8R_NATIVE_SCHEMA_CONTRACT_VERSION = 'phase8r.native_schema_contract.v1';
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
      path: 'server/src/__tests__/services/policyBuilderPhase8NativeSchemaContract.test.mjs',
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

describe('policyBuilderProductionNameInventory', () => {
  test('classifies phase-coded production references before any durable rename work begins', () => {
    const inventory = buildPolicyBuilderProductionNameInventory({
      files: sampleFiles(),
      generatedAt: '2026-07-03T10:00:00.000Z',
    });

    expect(inventory.validation.ok).toBe(true);
    expect(inventory.summary.productionReferenceCount).toBeGreaterThan(0);
    expect(inventory.summary.renameCandidateCount).toBeGreaterThan(0);
    expect(inventory.summary.keepHistoryCount).toBeGreaterThan(0);
    expect(inventory.summary.testOrMigrationEvidenceCount).toBeGreaterThan(0);
    expect(inventory.summary.obsoleteToolingCount).toBeGreaterThan(0);
    expect(inventory.nextPhase.phaseId).toBe('9r_2');
    expect(inventory.sideEffects).toEqual({
      filesRead: false,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
  });

  test('maps production phase-coded services to durable product-domain targets', () => {
    const inventory = buildPolicyBuilderProductionNameInventory({
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
        repoPath: 'server/src/services/policyBuilderPhase8NativeSchemaContract.mjs',
        categoryId: PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION,
        decisionId: PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE,
        durableTarget: 'nativePolicyIntentSchemaContract',
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
    const inventory = buildPolicyBuilderProductionNameInventory({
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
        repoPath: 'server/src/__tests__/services/policyBuilderPhase8NativeSchemaContract.test.mjs',
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
