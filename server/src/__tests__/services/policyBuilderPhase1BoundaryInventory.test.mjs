import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS,
  POLICY_BUILDER_BOUNDARY_ACTION_IDS,
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
  buildPolicyBuilderBoundaryInventoryAudit,
  classifyPolicyBuilderClientPath,
  isPolicyBuilderClientModulePath,
  listPolicyBuilderBoundaryRules,
  normalizeClientPath,
  summarizePolicyBuilderBoundaryInventory,
} from '../../services/policyBuilderPhase1BoundaryInventory.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');
const clientSrcRoot = path.join(repoRoot, 'client', 'src');

function collectClientFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectClientFiles(entryPath);
    }

    return [normalizeClientPath(path.relative(repoRoot, entryPath))];
  });
}

describe('policyBuilderPhase1BoundaryInventory', () => {
  test('classifies every current policy-builder client module path', () => {
    const policyBuilderPaths = collectClientFiles(clientSrcRoot)
      .filter(isPolicyBuilderClientModulePath);
    const inventory = summarizePolicyBuilderBoundaryInventory(policyBuilderPaths);
    const audit = buildPolicyBuilderBoundaryInventoryAudit(policyBuilderPaths);

    expect(inventory.total).toBeGreaterThan(0);
    expect(inventory.unclassifiedPaths).toEqual([]);
    expect(audit.ok).toBe(true);
    expect(audit.issues).toEqual([]);
    expect(audit.missingRequiredRuleIds).toEqual([]);
  });

  test('classifies modal orchestration as mixed but non-authoritative', () => {
    const record = classifyPolicyBuilderClientPath('client/src/components/policies/PolicyBuilderModal.vue');

    expect(record).toEqual(expect.objectContaining({
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
      actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
      mixedBoundary: true,
    }));
    expect(record.riskIds).toEqual(expect.arrayContaining([
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
    ]));
  });

  test('classifies draft state and legacy bridge modules separately', () => {
    expect(classifyPolicyBuilderClientPath('client/src/composables/usePolicyBuilderState.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DRAFT_STATE,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
      }));

    expect(classifyPolicyBuilderClientPath('client/src/utils/policyIntentDraftBridge.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.LEGACY_COMPATIBILITY_BRIDGE,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.CONTAIN_LEGACY_BRIDGE,
      }));
  });

  test('classifies reference adapters as option and observed-evidence adapters', () => {
    const record = classifyPolicyBuilderClientPath('client/src/composables/usePolicyBuilderReferenceData.js');

    expect(record.category).toBe(POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER);
    expect(record.actionId).toBe(POLICY_BUILDER_BOUNDARY_ACTION_IDS.SPLIT_REFERENCE_AND_EVIDENCE);
    expect(record.riskIds).toEqual(expect.arrayContaining([
      POLICY_BUILDER_BOUNDARY_RISK_IDS.OBSERVED_EVIDENCE_ADAPTER,
    ]));
  });

  test('classifies preview diagnostics for Phase 6R cutline review', () => {
    [
      'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
      'client/src/composables/usePolicyIntentReplayPreview.js',
      'client/src/utils/policyIntentReplayPreview.js',
    ].forEach((filePath) => {
      const record = classifyPolicyBuilderClientPath(filePath);

      expect(record.category).toBe(POLICY_BUILDER_BOUNDARY_CATEGORIES.DELETE_REPLACE_AFTER_PHASE_6R);
      expect(record.actionId).toBe(POLICY_BUILDER_BOUNDARY_ACTION_IDS.RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE);
      expect(record.riskIds).toEqual(expect.arrayContaining([
        POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      ]));
    });
  });

  test('classifies legacy combined-signal product surfaces for replacement', () => {
    const record = classifyPolicyBuilderClientPath('client/src/components/policies/PolicyCombinedSignalsSummary.vue');

    expect(record.category).toBe(POLICY_BUILDER_BOUNDARY_CATEGORIES.DELETE_REPLACE_AFTER_PHASE_6R);
    expect(record.actionId).toBe(POLICY_BUILDER_BOUNDARY_ACTION_IDS.RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE);
    expect(record.riskIds).toEqual(expect.arrayContaining([
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
    ]));
  });

  test('classifies client-side readiness and section helpers as engine candidates', () => {
    [
      'client/src/utils/policyIntentSectionProjection.js',
      'client/src/utils/policyIntentSectionVisualState.js',
      'client/src/utils/policyIntentSummary.js',
    ].forEach((filePath) => {
      const record = classifyPolicyBuilderClientPath(filePath);

      expect(record.category).toBe(POLICY_BUILDER_BOUNDARY_CATEGORIES.ENGINE_CANDIDATE);
      expect(record.actionId).toBe(POLICY_BUILDER_BOUNDARY_ACTION_IDS.MOVE_TO_SERVER_ENGINE);
      expect(record.riskIds).toEqual(expect.arrayContaining([
        POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
      ]));
    });
  });

  test('keeps leaf controls as presentation-only components', () => {
    const record = classifyPolicyBuilderClientPath('client/src/components/policies/PolicyIntentGenreControl.vue');

    expect(record).toEqual(expect.objectContaining({
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
      actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
      mixedBoundary: false,
    }));
  });

  test('keeps tests in a separate reset boundary', () => {
    const record = classifyPolicyBuilderClientPath('client/src/__tests__/PolicyIntentGenreControl.test.js');

    expect(record).toEqual(expect.objectContaining({
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.TEST_BOUNDARY,
      actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.RESET_TEST_OWNERSHIP,
    }));
  });

  test('summarizes mixed and unclassified boundaries', () => {
    const inventory = summarizePolicyBuilderBoundaryInventory([
      'client/src/components/policies/PolicyBuilderModal.vue',
      'client/src/components/policies/PolicyIntentGenreControl.vue',
      'client/src/components/policies/PolicyBuilderUnknown.vue',
      'client/src/views/settings/Sonarr.vue',
    ]);

    expect(inventory.total).toBe(3);
    expect(inventory.countsByCategory).toEqual({
      [POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION]: 1,
      [POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY]: 1,
      [POLICY_BUILDER_BOUNDARY_CATEGORIES.UNCLASSIFIED]: 1,
    });
    expect(inventory.mixedBoundaryPaths).toEqual([
      'client/src/components/policies/PolicyBuilderModal.vue',
    ]);
    expect(inventory.unclassifiedPaths).toEqual([
      'client/src/components/policies/PolicyBuilderUnknown.vue',
    ]);
  });

  test('reports inventory freshness issues explicitly', () => {
    const audit = buildPolicyBuilderBoundaryInventoryAudit([
      'client/src/components/policies/PolicyBuilderModal.vue',
      'client/src/components/policies/PolicyBuilderUnknown.vue',
    ], {
      requiredRuleIds: [
        'policy_builder_modal',
        'policy_legacy_summary_surfaces',
      ],
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.UNCLASSIFIED_MODULE,
        path: 'client/src/components/policies/PolicyBuilderUnknown.vue',
      }),
      expect.objectContaining({
        riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.MISSING_REQUIRED_RULE_COVERAGE,
        ruleId: 'policy_legacy_summary_surfaces',
      }),
    ]));
  });

  test('exposes immutable serializable rule summaries without matcher functions', () => {
    const rules = listPolicyBuilderBoundaryRules();

    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).not.toHaveProperty('matches');
    expect(Object.isFrozen(rules[0].riskIds)).toBe(true);
  });
});
