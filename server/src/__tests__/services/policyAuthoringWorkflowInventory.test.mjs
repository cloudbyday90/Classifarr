import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POLICY_AUTHORING_WORKFLOW_DECISION_IDS,
  POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS,
  POLICY_AUTHORING_WORKFLOW_RISK_IDS,
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
  classifyPolicyAuthoringWorkflowSurface,
  isPolicyAuthoringBuilderPath,
  listPolicyAuthoringWorkflowRules,
  normalizeClientPath,
  summarizePolicyAuthoringWorkflowInventory,
  validatePolicyAuthoringWorkflowInventory,
  validatePolicyAuthoringWorkflowRequirement,
} from '../../services/policyAuthoringWorkflowInventory.mjs';

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

describe('policyAuthoringWorkflowInventory', () => {
  test('classifies every current policy-builder client surface with a policy authoring cutline decision', () => {
    const policyBuilderPaths = collectClientFiles(clientSrcRoot)
      .filter(isPolicyAuthoringBuilderPath);
    const inventory = summarizePolicyAuthoringWorkflowInventory(policyBuilderPaths);

    expect(inventory.total).toBeGreaterThanOrEqual(90);
    expect(inventory.unclassifiedPaths).toEqual([]);
    expect(validatePolicyAuthoringWorkflowInventory(policyBuilderPaths)).toEqual(expect.objectContaining({
      valid: true,
    }));
  });

  test('classifies the shell as rewrite but still allowed in the normal workflow role', () => {
    const record = classifyPolicyAuthoringWorkflowSurface('client/src/components/policies/PolicyBuilderModal.vue');

    expect(record).toEqual(expect.objectContaining({
      decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
      roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.WORKFLOW_SHELL,
      normalAuthoringAllowed: true,
      migrationSupportOnly: false,
    }));
    expect(record.riskIds).toEqual([
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.OLD_MODAL_SHAPE,
    ]);
  });

  test('keeps destination context in the normal authoring path', () => {
    [
      'client/src/components/policies/PolicyBuilderLibraryContext.vue',
      'client/src/utils/policyBuilderLibraryGenreOptions.js',
      'client/src/composables/usePolicyBuilderReferenceData.js',
    ].forEach((filePath) => {
      expect(classifyPolicyAuthoringWorkflowSurface(filePath)).toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.KEEP,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DESTINATION_CONTEXT,
        normalAuthoringAllowed: true,
      }));
    });
  });

  test('keeps leaf intent controls while rewriting old editor grouping', () => {
    expect(classifyPolicyAuthoringWorkflowSurface('client/src/components/policies/PolicyIntentGenreControl.vue'))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.KEEP,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
        normalAuthoringAllowed: true,
      }));

    expect(classifyPolicyAuthoringWorkflowSurface('client/src/components/policies/PolicyIntentEditor.vue'))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
        normalAuthoringAllowed: true,
      }));
  });

  test('keeps starter templates out of the normal authoring path', () => {
    [
      'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
      'client/src/components/policies/PolicyStarterTemplateBrowser.vue',
      'client/src/components/policies/PolicyStarterTemplateDetails.vue',
      'client/src/components/policies/PolicySelectedStarterTemplates.vue',
      'client/src/composables/usePolicyBuilderTemplateSignals.js',
    ].forEach((filePath) => {
      const record = classifyPolicyAuthoringWorkflowSurface(filePath);

      expect(record).toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.STARTER_TEMPLATE_ACCELERATOR,
        normalAuthoringAllowed: false,
        migrationSupportOnly: true,
      }));
      expect(record.riskIds).toEqual(expect.arrayContaining([
        POLICY_AUTHORING_WORKFLOW_RISK_IDS.STARTER_TEMPLATE_FIRST_MODEL,
      ]));
    });
  });

  test('keeps migration notices out of the normal authoring path', () => {
    expect(classifyPolicyAuthoringWorkflowSurface('client/src/components/policies/PolicyPresetMigrationNotice.vue'))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
        normalAuthoringAllowed: false,
        migrationSupportOnly: true,
      }));
  });

  test('does not retain removed preview and replay diagnostic workflow rules', () => {
    expect(listPolicyAuthoringWorkflowRules().map(rule => rule.id))
      .not.toContain('preview_replay_diagnostics');
  });

  test('replaces raw advanced scoring and combined-signal UI mechanics', () => {
    expect(classifyPolicyAuthoringWorkflowSurface('client/src/components/policies/PolicyBuilderAdvancedSettings.vue'))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REPLACE,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.ADVANCED_SUPPORT_ONLY,
        normalAuthoringAllowed: false,
      }));

    expect(classifyPolicyAuthoringWorkflowSurface('client/src/composables/usePolicyBuilderCombinedSignals.js'))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REPLACE,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.FUTURE_SERVER_ENGINE_INPUT,
        normalAuthoringAllowed: false,
      }));
  });

  test('keeps draft and bridge utilities as compatibility support, not normal product surfaces', () => {
    [
      'client/src/composables/usePolicyBuilderState.js',
      'client/src/composables/usePolicyIntentDraft.js',
      'client/src/utils/policyIntentDraftBridge.js',
      'client/src/utils/policyIntentDraftView.js',
    ].forEach((filePath) => {
      expect(classifyPolicyAuthoringWorkflowSurface(filePath)).toEqual(expect.objectContaining({
        decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.KEEP,
        roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
        normalAuthoringAllowed: false,
        migrationSupportOnly: true,
      }));
    });
  });

  test('validates the normal authoring path excludes diagnostics, provider readiness, raw weights, templates, and tests', () => {
    const policyBuilderPaths = collectClientFiles(clientSrcRoot)
      .filter(isPolicyAuthoringBuilderPath);

    [
      POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.EVERY_SURFACE_CLASSIFIED,
      POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_DIAGNOSTICS,
      POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_PROVIDER_READINESS,
      POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_RAW_SCORING_WEIGHTS,
      POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.STARTER_TEMPLATES_ARE_ACCELERATORS,
      POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.TESTS_DO_NOT_FREEZE_OLD_UI,
    ].forEach((requirementId) => {
      expect(validatePolicyAuthoringWorkflowRequirement(requirementId, policyBuilderPaths))
        .toEqual(expect.objectContaining({
          valid: true,
          riskId: null,
        }));
    });
  });

  test('returns a failed requirement for unknown requirement ids', () => {
    expect(validatePolicyAuthoringWorkflowRequirement('unknown', [])).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_WORKFLOW_RISK_IDS.UNCLASSIFIED_SURFACE,
      evidence: {
        reason: 'Unknown policy authoring workflow requirement.',
      },
    });
  });

  test('exposes immutable serializable rules without matcher functions', () => {
    const rules = listPolicyAuthoringWorkflowRules();

    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).not.toHaveProperty('matches');
    expect(Object.isFrozen(rules[0].riskIds)).toBe(true);
  });
});
