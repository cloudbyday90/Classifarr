import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS,
  POLICY_AUTHORING_COMPLETION_RISK_IDS,
  POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS,
  auditPolicyAuthoringCompletionRecords,
  buildPolicyAuthoringWorkflowCompletionAudit,
  listPolicyAuthoringCompletionArtifactPaths,
  listPolicyAuthoringNormalPathExclusions,
  listPolicyAuthoringNormalWorkflowRules,
  listPolicyAuthoringServerContracts,
  listPolicyAuthoringVueRewriteSlices,
  validatePolicyAuthoringCompletionRecord,
} from '../../services/policyAuthoringWorkflowCompletionAudit.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

describe('policyAuthoringWorkflowCompletionAudit', () => {
  test('audits the complete policy authoring workflow completion gate', () => {
    const audit = buildPolicyAuthoringWorkflowCompletionAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      checkedServerContractCount: 9,
      checkedVueRewriteCount: 9,
      checkedNormalWorkflowRuleCount: 5,
      checkedNormalPathExclusionCount: 6,
      nextStep: expect.objectContaining({
        stepId: 'policy_evidence_engine',
      }),
    }));
  });

  test('lists all required policy authoring server contracts and Vue rewrite slices', () => {
    expect(listPolicyAuthoringServerContracts().map(record => record.id)).toEqual([
      'policy_authoring_workflow_inventory',
      'policy_authoring_destination_flow',
      'policy_authoring_component_system',
      'policy_authoring_option_selection',
      'policy_authoring_constraints',
      'policy_authoring_readiness',
      'policy_authoring_starter_templates',
      'policy_authoring_accessibility',
      'policy_authoring_presentation_tests',
    ]);

    expect(listPolicyAuthoringVueRewriteSlices().map(record => record.id)).toEqual([
      'policy_authoring_setup_cards',
      'policy_authoring_destination_sections',
      'policy_authoring_review_triggers',
      'policy_authoring_routing_readiness',
      'policy_authoring_setup_card_progress',
      'policy_authoring_save_defer_action_boundary',
      'policy_authoring_starter_template_accelerator',
      'vue_policy_authoring_accessibility_audit',
      'vue_policy_authoring_presentation_tests',
    ]);
  });

  test('references existing docs, services, and test artifacts', () => {
    const missingArtifactPaths = listPolicyAuthoringCompletionArtifactPaths()
      .filter((artifactPath, index, allPaths) => allPaths.indexOf(artifactPath) === index)
      .filter(artifactPath => !existsSync(resolve(repoRoot, artifactPath)));

    expect(missingArtifactPaths).toEqual([]);
  });

  test('keeps normal workflow rules tied to regression evidence', () => {
    const rules = listPolicyAuthoringNormalWorkflowRules();

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
    const exclusions = listPolicyAuthoringNormalPathExclusions();

    expect(exclusions.map(exclusion => exclusion.scopeId)).toEqual([
      POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
      POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
      POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
      POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
      POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.BRIDGE_ONLY,
      POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    ]);
    exclusions.forEach(exclusion => {
      expect(exclusion.normalAuthoringAllowed).not.toBe(true);
    });
  });

  test('fails records missing required completion evidence', () => {
    expect(validatePolicyAuthoringCompletionRecord({
      id: '',
      label: '',
      docPath: '',
      servicePath: '',
      testPath: '',
      evidence: '',
    }, POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT).issues.map(issue => issue.riskId))
      .toEqual([
        POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
        POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_LABEL,
        POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
        POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_DOC_PATH,
        POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH,
        POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_TEST_PATH,
      ]);
  });

  test('fails verifier or bridge exclusions that are allowed in normal authoring', () => {
    expect(validatePolicyAuthoringCompletionRecord({
      id: 'raw_template_mechanics',
      label: 'Raw template mechanics',
      scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.BRIDGE_ONLY,
      normalAuthoringAllowed: true,
      evidence: 'Legacy internals should remain bridge-only.',
    }, POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION).issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_COMPLETION_RISK_IDS.INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH);
  });

  test('fails unknown artifact kinds', () => {
    expect(auditPolicyAuthoringCompletionRecords([], 'unknown_kind')).toEqual(expect.objectContaining({
      ok: false,
      checkedCount: 0,
      issueCount: 1,
      results: [
        expect.objectContaining({
          issues: [
            expect.objectContaining({
              riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.UNKNOWN_ARTIFACT_KIND,
            }),
          ],
        }),
      ],
    }));
  });
});
