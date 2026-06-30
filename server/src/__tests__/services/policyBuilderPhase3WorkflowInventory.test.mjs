import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PHASE_3R_WORKFLOW_DECISION_IDS,
  PHASE_3R_WORKFLOW_REQUIREMENT_IDS,
  PHASE_3R_WORKFLOW_RISK_IDS,
  PHASE_3R_WORKFLOW_ROLE_IDS,
  classifyPhase3RWorkflowSurface,
  isPhase3RPolicyBuilderPath,
  listPhase3RWorkflowRules,
  normalizeClientPath,
  summarizePhase3RWorkflowInventory,
  validatePhase3RWorkflowInventory,
  validatePhase3RWorkflowRequirement,
} from '../../services/policyBuilderPhase3WorkflowInventory.mjs';

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

describe('policyBuilderPhase3WorkflowInventory', () => {
  test('classifies every current policy-builder client surface with a Phase 3R cutline decision', () => {
    const policyBuilderPaths = collectClientFiles(clientSrcRoot)
      .filter(isPhase3RPolicyBuilderPath);
    const inventory = summarizePhase3RWorkflowInventory(policyBuilderPaths);

    expect(inventory.total).toBeGreaterThanOrEqual(90);
    expect(inventory.unclassifiedPaths).toEqual([]);
    expect(validatePhase3RWorkflowInventory(policyBuilderPaths)).toEqual(expect.objectContaining({
      valid: true,
    }));
  });

  test('classifies the shell as rewrite but still allowed in the normal workflow role', () => {
    const record = classifyPhase3RWorkflowSurface('client/src/components/policies/PolicyBuilderModal.vue');

    expect(record).toEqual(expect.objectContaining({
      decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.REWRITE,
      roleId: PHASE_3R_WORKFLOW_ROLE_IDS.WORKFLOW_SHELL,
      normalAuthoringAllowed: true,
      migrationSupportOnly: false,
    }));
    expect(record.riskIds).toEqual([
      PHASE_3R_WORKFLOW_RISK_IDS.OLD_MODAL_SHAPE,
    ]);
  });

  test('keeps destination context in the normal authoring path', () => {
    [
      'client/src/components/policies/PolicyBuilderLibraryContext.vue',
      'client/src/utils/policyBuilderLibraryGenreOptions.js',
      'client/src/composables/usePolicyBuilderReferenceData.js',
    ].forEach((filePath) => {
      expect(classifyPhase3RWorkflowSurface(filePath)).toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.KEEP,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.DESTINATION_CONTEXT,
        normalAuthoringAllowed: true,
      }));
    });
  });

  test('keeps leaf intent controls while rewriting old editor grouping', () => {
    expect(classifyPhase3RWorkflowSurface('client/src/components/policies/PolicyIntentGenreControl.vue'))
      .toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.KEEP,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
        normalAuthoringAllowed: true,
      }));

    expect(classifyPhase3RWorkflowSurface('client/src/components/policies/PolicyIntentEditor.vue'))
      .toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.REWRITE,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
        normalAuthoringAllowed: true,
      }));
  });

  test('keeps starter templates out of the normal authoring path', () => {
    [
      'client/src/components/policies/PolicyStarterTemplateBrowser.vue',
      'client/src/components/policies/PolicyStarterTemplateDetails.vue',
      'client/src/components/policies/PolicySelectedStarterTemplates.vue',
      'client/src/composables/usePolicyBuilderTemplateSignals.js',
    ].forEach((filePath) => {
      const record = classifyPhase3RWorkflowSurface(filePath);

      expect(record).toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.REWRITE,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.STARTER_TEMPLATE_ACCELERATOR,
        normalAuthoringAllowed: false,
        migrationSupportOnly: true,
      }));
      expect(record.riskIds).toEqual(expect.arrayContaining([
        PHASE_3R_WORKFLOW_RISK_IDS.STARTER_TEMPLATE_FIRST_MODEL,
      ]));
    });
  });

  test('keeps migration notices out of the normal authoring path', () => {
    expect(classifyPhase3RWorkflowSurface('client/src/components/policies/PolicyPresetMigrationNotice.vue'))
      .toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.REWRITE,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
        normalAuthoringAllowed: false,
        migrationSupportOnly: true,
      }));
  });

  test('removes preview and replay diagnostics from the normal workflow', () => {
    [
      'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
      'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
      'client/src/composables/usePolicyIntentReplayPreview.js',
      'client/src/utils/policyIntentImpactPreview.js',
    ].forEach((filePath) => {
      const record = classifyPhase3RWorkflowSurface(filePath);

      expect(record).toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
        normalAuthoringAllowed: false,
        migrationSupportOnly: true,
      }));
      expect(record.riskIds).toEqual(expect.arrayContaining([
        PHASE_3R_WORKFLOW_RISK_IDS.DIAGNOSTIC_PRODUCT_PATH,
        PHASE_3R_WORKFLOW_RISK_IDS.PROVIDER_READINESS_IN_NORMAL_UX,
      ]));
    });
  });

  test('replaces raw advanced scoring and combined-signal UI mechanics', () => {
    expect(classifyPhase3RWorkflowSurface('client/src/components/policies/PolicyBuilderAdvancedSettings.vue'))
      .toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.REPLACE,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.ADVANCED_SUPPORT_ONLY,
        normalAuthoringAllowed: false,
      }));

    expect(classifyPhase3RWorkflowSurface('client/src/composables/usePolicyBuilderCombinedSignals.js'))
      .toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.REPLACE,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.FUTURE_SERVER_ENGINE_INPUT,
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
      expect(classifyPhase3RWorkflowSurface(filePath)).toEqual(expect.objectContaining({
        decisionId: PHASE_3R_WORKFLOW_DECISION_IDS.KEEP,
        roleId: PHASE_3R_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
        normalAuthoringAllowed: false,
        migrationSupportOnly: true,
      }));
    });
  });

  test('validates the normal authoring path excludes diagnostics, provider readiness, raw weights, templates, and tests', () => {
    const policyBuilderPaths = collectClientFiles(clientSrcRoot)
      .filter(isPhase3RPolicyBuilderPath);

    [
      PHASE_3R_WORKFLOW_REQUIREMENT_IDS.EVERY_SURFACE_CLASSIFIED,
      PHASE_3R_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_DIAGNOSTICS,
      PHASE_3R_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_PROVIDER_READINESS,
      PHASE_3R_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_RAW_SCORING_WEIGHTS,
      PHASE_3R_WORKFLOW_REQUIREMENT_IDS.STARTER_TEMPLATES_ARE_ACCELERATORS,
      PHASE_3R_WORKFLOW_REQUIREMENT_IDS.TESTS_DO_NOT_FREEZE_OLD_UI,
    ].forEach((requirementId) => {
      expect(validatePhase3RWorkflowRequirement(requirementId, policyBuilderPaths))
        .toEqual(expect.objectContaining({
          valid: true,
          riskId: null,
        }));
    });
  });

  test('returns a failed requirement for unknown requirement ids', () => {
    expect(validatePhase3RWorkflowRequirement('unknown', [])).toEqual({
      valid: false,
      riskId: PHASE_3R_WORKFLOW_RISK_IDS.UNCLASSIFIED_SURFACE,
      evidence: {
        reason: 'Unknown Phase 3R workflow requirement.',
      },
    });
  });

  test('exposes immutable serializable rules without matcher functions', () => {
    const rules = listPhase3RWorkflowRules();

    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).not.toHaveProperty('matches');
    expect(Object.isFrozen(rules[0].riskIds)).toBe(true);
  });
});
