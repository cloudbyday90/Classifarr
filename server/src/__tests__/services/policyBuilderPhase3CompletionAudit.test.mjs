import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PHASE3R_ARTIFACT_KIND_IDS,
  PHASE3R_COMPLETION_RISK_IDS,
  PHASE3R_EXCLUSION_SCOPE_IDS,
  auditPhase3CompletionRecords,
  buildPolicyBuilderPhase3CompletionAudit,
  listPolicyBuilderPhase3CompletionArtifactPaths,
  listPolicyBuilderPhase3NormalPathExclusions,
  listPolicyBuilderPhase3NormalWorkflowRules,
  listPolicyBuilderPhase3ServerContracts,
  listPolicyBuilderPhase3VueRewriteSlices,
  validatePhase3CompletionRecord,
} from '../../services/policyBuilderPhase3CompletionAudit.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

describe('policyBuilderPhase3CompletionAudit', () => {
  test('audits the complete Phase 3R completion gate', () => {
    const audit = buildPolicyBuilderPhase3CompletionAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      checkedServerContractCount: 9,
      checkedVueRewriteCount: 9,
      checkedNormalWorkflowRuleCount: 5,
      checkedNormalPathExclusionCount: 6,
      nextPhase: expect.objectContaining({
        phaseId: '6r_1',
      }),
    }));
  });

  test('lists all required Phase 3R server contracts and Vue rewrite slices', () => {
    expect(listPolicyBuilderPhase3ServerContracts().map(record => record.id)).toEqual([
      '3r_1_workflow_inventory_cutline',
      '3r_2_destination_first_flow',
      '3r_3_component_system_reset',
      '3r_4_evidence_backed_option_selection',
      '3r_5_hard_limits_avoid_ux',
      '3r_6_readiness_next_action_surface',
      '3r_7_starter_template_role_reset',
      '3r_8_accessibility_decision_load',
      '3r_9_presentation_test_reset',
    ]);

    expect(listPolicyBuilderPhase3VueRewriteSlices().map(record => record.id)).toEqual([
      'vue_setup_cards',
      'vue_destination_section_split',
      'vue_review_trigger_control',
      'vue_routing_readiness_surface',
      'vue_setup_card_state_binding',
      'vue_save_defer_action_boundary',
      'vue_starter_template_accelerator',
      'vue_accessibility_decision_load_audit',
      'vue_presentation_test_reset',
    ]);
  });

  test('references existing docs, services, and test artifacts', () => {
    const missingArtifactPaths = listPolicyBuilderPhase3CompletionArtifactPaths()
      .filter((artifactPath, index, allPaths) => allPaths.indexOf(artifactPath) === index)
      .filter(artifactPath => !existsSync(resolve(repoRoot, artifactPath)));

    expect(missingArtifactPaths).toEqual([]);
  });

  test('keeps normal workflow rules tied to regression evidence', () => {
    const rules = listPolicyBuilderPhase3NormalWorkflowRules();

    expect(rules.map(rule => rule.id)).toEqual([
      'destination_context_before_templates',
      'observed_evidence_requires_acceptance',
      'hard_limits_explicit',
      'one_recommended_next_action',
      'verifier_panels_not_default',
    ]);
    rules.forEach(rule => {
      expect(rule.docPath).toMatch(/^docs\/architecture\//);
      expect(rule.testPath).toMatch(/^client\/src\/__tests__\//);
      expect(rule.evidence).toBeTruthy();
    });
  });

  test('keeps diagnostics, verifier panels, and bridge internals out of normal authoring', () => {
    const exclusions = listPolicyBuilderPhase3NormalPathExclusions();

    expect(exclusions.map(exclusion => exclusion.scopeId)).toEqual([
      PHASE3R_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
      PHASE3R_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
      PHASE3R_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
      PHASE3R_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
      PHASE3R_EXCLUSION_SCOPE_IDS.BRIDGE_ONLY,
      PHASE3R_EXCLUSION_SCOPE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    ]);
    exclusions.forEach(exclusion => {
      expect(exclusion.normalAuthoringAllowed).not.toBe(true);
    });
  });

  test('fails records missing required completion evidence', () => {
    expect(validatePhase3CompletionRecord({
      id: '',
      label: '',
      docPath: '',
      servicePath: '',
      testPath: '',
      evidence: '',
    }, PHASE3R_ARTIFACT_KIND_IDS.SERVER_CONTRACT).issues.map(issue => issue.riskId))
      .toEqual([
        PHASE3R_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
        PHASE3R_COMPLETION_RISK_IDS.MISSING_LABEL,
        PHASE3R_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
        PHASE3R_COMPLETION_RISK_IDS.MISSING_DOC_PATH,
        PHASE3R_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH,
        PHASE3R_COMPLETION_RISK_IDS.MISSING_TEST_PATH,
      ]);
  });

  test('fails verifier or bridge exclusions that are allowed in normal authoring', () => {
    expect(validatePhase3CompletionRecord({
      id: 'raw_template_mechanics',
      label: 'Raw template mechanics',
      scopeId: PHASE3R_EXCLUSION_SCOPE_IDS.BRIDGE_ONLY,
      normalAuthoringAllowed: true,
      evidence: 'Legacy internals should remain bridge-only.',
    }, PHASE3R_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION).issues.map(issue => issue.riskId))
      .toContain(PHASE3R_COMPLETION_RISK_IDS.INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH);
  });

  test('fails unknown artifact kinds', () => {
    expect(auditPhase3CompletionRecords([], 'unknown_kind')).toEqual(expect.objectContaining({
      ok: false,
      checkedCount: 0,
      issueCount: 1,
      results: [
        expect.objectContaining({
          issues: [
            expect.objectContaining({
              riskId: PHASE3R_COMPLETION_RISK_IDS.UNKNOWN_ARTIFACT_KIND,
            }),
          ],
        }),
      ],
    }));
  });
});
