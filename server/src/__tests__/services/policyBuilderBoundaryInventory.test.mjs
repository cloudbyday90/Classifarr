import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS,
  POLICY_BUILDER_BOUNDARY_ACTION_IDS,
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_OWNER_IDS,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
  buildPolicyBuilderBoundaryInventoryAudit,
  buildPolicyBuilderBoundaryRuleAudit,
  classifyPolicyBuilderClientPath,
  isPolicyBuilderClientModulePath,
  listPolicyBuilderBoundaryRules,
  normalizeClientPath,
  summarizePolicyBuilderBoundaryInventory,
  validatePolicyBuilderBoundaryRule,
} from '../../services/policyBuilderBoundaryInventory.mjs';

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

describe('policyBuilderBoundaryInventory', () => {
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
      ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
      actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
      clientEngineAuthorityAllowed: false,
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
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_DRAFT_PROJECTION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
      }));

    expect(classifyPolicyBuilderClientPath('client/src/utils/policyIntentDraftBridge.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.LEGACY_COMPATIBILITY_BRIDGE,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_COMPATIBILITY_BRIDGE,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.CONTAIN_LEGACY_BRIDGE,
      }));
  });

  test('classifies accepted intent-signal state as a native draft projection', () => {
    [
      'client/src/utils/policyIntentSignalDraft.js',
      'client/src/composables/usePolicyIntentSignalDraft.js',
    ].forEach((filePath) => {
      expect(classifyPolicyBuilderClientPath(filePath)).toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DRAFT_STATE,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_DRAFT_PROJECTION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
        clientEngineAuthorityAllowed: false,
        engineCutlineDecisionRequired: false,
      }));
    });
  });

  test('classifies explicit constraint commands as a native draft projection', () => {
    [
      'client/src/utils/policyIntentConstraintDraft.js',
      'client/src/composables/usePolicyIntentConstraintDraft.js',
      'client/src/utils/policyIntentConstraintValueEligibility.js',
      'client/src/utils/policyIntentConstraintControlSurface.js',
      'client/src/components/policies/PolicyIntentConstraintControlSurface.vue',
    ].forEach((filePath) => {
      expect(classifyPolicyBuilderClientPath(filePath)).toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DRAFT_STATE,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_DRAFT_PROJECTION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
        clientEngineAuthorityAllowed: false,
        engineCutlineDecisionRequired: false,
      }));
    });
  });

  test('classifies reference adapters as option and observed-evidence adapters', () => {
    const record = classifyPolicyBuilderClientPath('client/src/composables/usePolicyBuilderReferenceData.js');

    expect(record.category).toBe(POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER);
    expect(record.ownerId).toBe(POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_REFERENCE_ADAPTER);
    expect(record.actionId).toBe(POLICY_BUILDER_BOUNDARY_ACTION_IDS.SPLIT_REFERENCE_AND_EVIDENCE);
    expect(record.riskIds).toEqual(expect.arrayContaining([
      POLICY_BUILDER_BOUNDARY_RISK_IDS.OBSERVED_EVIDENCE_ADAPTER,
    ]));
  });

  test('keeps the library-first workflow read adapter and shell non-authoritative', () => {
    expect(classifyPolicyBuilderClientPath('client/src/utils/policyAuthoringWorkflowPresentation.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_REFERENCE_ADAPTER,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.SPLIT_REFERENCE_AND_EVIDENCE,
        clientEngineAuthorityAllowed: false,
      }));

    expect(classifyPolicyBuilderClientPath('client/src/composables/usePolicyOperatorWorkflow.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_REFERENCE_ADAPTER,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.SPLIT_REFERENCE_AND_EVIDENCE,
        clientEngineAuthorityAllowed: false,
      }));

    expect(classifyPolicyBuilderClientPath('client/src/components/policies/PolicyBuilderWorkflowShell.vue'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
        clientEngineAuthorityAllowed: false,
      }));

    expect(classifyPolicyBuilderClientPath('client/src/components/policies/PolicyBuilderDestinationQuestions.vue'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
        clientEngineAuthorityAllowed: false,
      }));
  });

  test('keeps lifecycle and prepared-proposal boundaries server-owned', () => {
    [
      'client/src/utils/policyAuthoringLifecyclePresentation.js',
      'client/src/utils/policyAuthoringProposalPresentation.js',
      'client/src/utils/policyAuthoringProposalAdmission.js',
    ].forEach((filePath) => {
      expect(classifyPolicyBuilderClientPath(filePath)).toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_REFERENCE_ADAPTER,
        clientEngineAuthorityAllowed: false,
      }));
    });

    [
      'client/src/composables/usePolicyAuthoringLifecycleList.js',
      'client/src/composables/usePolicyAuthoringDestinationProposal.js',
      'client/src/composables/usePolicyAuthoringProposalAdmission.js',
    ].forEach((filePath) => {
      expect(classifyPolicyBuilderClientPath(filePath)).toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
        clientEngineAuthorityAllowed: false,
      }));
    });

    expect(classifyPolicyBuilderClientPath('client/src/components/policies/PolicyDestinationProposalCard.vue'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        clientEngineAuthorityAllowed: false,
      }));
  });

  test('keeps native create action binding and action feedback non-authoritative', () => {
    expect(classifyPolicyBuilderClientPath('client/src/composables/usePolicyNativeCreateAction.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
        clientEngineAuthorityAllowed: false,
      }));

    expect(classifyPolicyBuilderClientPath('client/src/utils/policyAuthoringActionFeedback.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
        clientEngineAuthorityAllowed: false,
      }));
  });

  test('keeps workflow status priority as display-only feedback', () => {
    [
      'client/src/components/policies/PolicyBuilderWorkflowStatusNotice.vue',
      'client/src/utils/policyBuilderWorkflowStatusPriority.js',
    ].forEach((filePath) => {
      expect(classifyPolicyBuilderClientPath(filePath)).toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
        clientEngineAuthorityAllowed: false,
        engineCutlineDecisionRequired: false,
      }));
    });
  });

  test('keeps empty-state guidance as presentation without recovery orchestration', () => {
    expect(classifyPolicyBuilderClientPath('client/src/components/policies/PolicyDestinationEmptyStateNotice.vue'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
        clientEngineAuthorityAllowed: false,
      }));

    [
      'client/src/components/policies/DestinationContextCard.vue',
      'client/src/components/policies/ObservedProfileSummary.vue',
    ].forEach((filePath) => {
      expect(classifyPolicyBuilderClientPath(filePath)).toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        clientEngineAuthorityAllowed: false,
      }));
    });
  });

  test('keeps the persisted-id experience switch as non-authoritative UI orchestration', () => {
    expect(classifyPolicyBuilderClientPath('client/src/utils/policyBuilderExperienceMode.js'))
      .toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
        clientEngineAuthorityAllowed: false,
        engineCutlineDecisionRequired: false,
      }));
  });

  test('does not retain deleted preview diagnostics in current boundary rules', () => {
    expect(listPolicyBuilderBoundaryRules().map(rule => rule.id))
      .not.toContain('policy_preview_diagnostics');
  });

  test('does not retain deleted combined-signal product surfaces', () => {
    expect(listPolicyBuilderBoundaryRules().map(rule => rule.id))
      .not.toContain('policy_legacy_summary_surfaces');
  });

  test('classifies the client-side section helper as an engine candidate', () => {
    [
      'client/src/utils/policyIntentSectionProjection.js',
    ].forEach((filePath) => {
      const record = classifyPolicyBuilderClientPath(filePath);

      expect(record.category).toBe(POLICY_BUILDER_BOUNDARY_CATEGORIES.ENGINE_CANDIDATE);
      expect(record.ownerId).toBe(POLICY_BUILDER_BOUNDARY_OWNER_IDS.SERVER_ENGINE_CANDIDATE);
      expect(record.actionId).toBe(POLICY_BUILDER_BOUNDARY_ACTION_IDS.MOVE_TO_SERVER_ENGINE);
      expect(record.clientEngineAuthorityAllowed).toBe(false);
      expect(record.engineCutlineDecisionRequired).toBe(true);
      expect(record.riskIds).toEqual(expect.arrayContaining([
        POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
      ]));
    });
  });

  test('keeps leaf controls as presentation-only components', () => {
    [
      'client/src/components/policies/PolicyIntentCustomSignalEntry.vue',
      'client/src/components/policies/PolicyIntentGenreControl.vue',
    ].forEach((filePath) => {
      const record = classifyPolicyBuilderClientPath(filePath);

      expect(record).toEqual(expect.objectContaining({
        category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
        ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
        actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
        mixedBoundary: false,
      }));
    });
  });

  test('keeps the typed candidate picker as presentation-only support', () => {
    const record = classifyPolicyBuilderClientPath(
      'client/src/components/policies/IntentSignalPicker.vue'
    );

    expect(record).toEqual(expect.objectContaining({
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
      ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
      actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
      clientEngineAuthorityAllowed: false,
      engineCutlineDecisionRequired: false,
      mixedBoundary: false,
    }));
  });

  test('keeps tests in a separate reset boundary', () => {
    const record = classifyPolicyBuilderClientPath('client/src/__tests__/PolicyIntentGenreControl.test.js');

    expect(record).toEqual(expect.objectContaining({
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.TEST_BOUNDARY,
      ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.TEST_CONTRACT,
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
    expect(rules[0]).toEqual(expect.objectContaining({
      ownerId: expect.any(String),
      clientEngineAuthorityAllowed: false,
      engineCutlineDecisionRequired: expect.any(Boolean),
    }));
    expect(Object.isFrozen(rules[0].riskIds)).toBe(true);
  });

  test('audits boundary rule ownership and engine cutline metadata', () => {
    expect(buildPolicyBuilderBoundaryRuleAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedRuleCount: listPolicyBuilderBoundaryRules().length,
      issues: [],
    }));
  });

  test('rejects boundary rules that accidentally grant client engine authority', () => {
    const result = validatePolicyBuilderBoundaryRule({
      id: 'unsafe_client_engine',
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.ENGINE_CANDIDATE,
      ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
      actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
      clientEngineAuthorityAllowed: true,
      engineCutlineDecisionRequired: false,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual([
      POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.CLIENT_ENGINE_AUTHORITY_ALLOWED,
      POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.INVALID_ENGINE_CANDIDATE_ACTION,
      POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.MISSING_ENGINE_CUTLINE_DECISION,
    ]);
  });

  test('rejects delete or replace rules without verifier or deletion cutline action', () => {
    const result = validatePolicyBuilderBoundaryRule({
      id: 'unsafe_diagnostic_surface',
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REWRITE_OR_DELETE_AFTER_ENGINE_CUTLINE,
      ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.MAINTAINER_VERIFIER_OR_DELETE,
      actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
      clientEngineAuthorityAllowed: false,
      engineCutlineDecisionRequired: false,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual([
      POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.INVALID_DELETE_REPLACE_ACTION,
      POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.MISSING_ENGINE_CUTLINE_DECISION,
    ]);
  });
});
