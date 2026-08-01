import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS,
  POLICY_AUTHORING_COMPLETION_RISK_IDS,
  POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS,
  auditPolicyAuthoringCompletionRecords,
  buildPolicyAuthoringWorkflowCompletionAudit,
  listPolicyAuthoringClientWorkflowComponents,
  listPolicyAuthoringCompletionArtifactPaths,
  listPolicyAuthoringNormalPathExclusions,
  listPolicyAuthoringNormalWorkflowRules,
  listPolicyAuthoringServerContracts,
  validatePolicyAuthoringCompletionRecord,
} from '../../services/policyAuthoringWorkflowCompletionAudit.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

describe('policyAuthoringWorkflowCompletionAudit', () => {
  test('audits the complete policy authoring workflow completion gate', () => {
    const audit = buildPolicyAuthoringWorkflowCompletionAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      checkedServerContractCount: 23,
      checkedClientWorkflowComponentCount: 11,
      checkedNormalWorkflowRuleCount: 5,
      checkedNormalPathExclusionCount: 4,
      nextStep: expect.objectContaining({
        stepId: 'policy_evidence_engine',
      }),
    }));
  });

  test('lists all required policy authoring server contracts and client workflow components', () => {
    expect(listPolicyAuthoringServerContracts().map(record => record.id)).toEqual([
      'policy_authoring_workflow_inventory',
      'policy_authoring_destination_flow',
      'policy_authoring_component_system',
      'policy_authoring_component_inventory',
      'policy_authoring_option_selection',
      'policy_authoring_constraints',
      'policy_constraint_decision_model',
      'policy_constraint_value_eligibility',
      'policy_authoring_readiness',
      'policy_authoring_starter_template_intent_boundary',
      'policy_authoring_accessibility',
      'policy_authoring_presentation_tests',
      'policy_compatibility_maintenance_test_ownership',
      'policy_native_storage_cutover_test_handoff',
      'policy_native_storage_cutover_deletion_evidence',
      'policy_native_workflow_test_rehoming',
      'policy_compatibility_component_deletion_dependencies',
      'policy_compatibility_retirement_manifest_reconciliation',
      'policy_compatibility_retirement_execution_manifest_binding',
      'policy_compatibility_execution_manifest_named_scope_entry',
      'policy_compatibility_retirement_candidate_plan_projection',
      'policy_compatibility_retirement_candidate_plan_assembly_gate',
      'policy_compatibility_retirement_candidate_taxonomy',
    ]);

    expect(listPolicyAuthoringClientWorkflowComponents().map(record => record.id)).toEqual([
      'policy_authoring_library_first_workflow_shell',
      'policy_authoring_destination_sections',
      'policy_authoring_review_triggers',
      'policy_authoring_workflow_readiness',
      'policy_authoring_workflow_read_boundary',
      'policy_authoring_save_defer_action_boundary',
      'policy_authoring_starter_template_intent_boundary',
      'policy_authoring_accessibility_decision_load_audit',
      'policy_authoring_presentation_test_reset',
      'policy_authoring_constraint_draft_command_boundary',
      'policy_authoring_constraint_control_surface',
    ]);

    expect(listPolicyAuthoringClientWorkflowComponents()
      .filter(record => [
        'policy_authoring_destination_sections',
        'policy_authoring_review_triggers',
      ].includes(record.id))
      .map(record => ({ id: record.id, testPath: record.testPath })))
      .toEqual([
        {
          id: 'policy_authoring_destination_sections',
          testPath: 'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
        },
        {
          id: 'policy_authoring_review_triggers',
          testPath: 'client/src/__tests__/PolicyIntentReviewTriggerControl.test.js',
        },
      ]);
  });

  test('describes server contracts with durable product behavior', () => {
    const evidence = listPolicyAuthoringServerContracts()
      .filter(record => [
        'policy_authoring_workflow_inventory',
        'policy_authoring_destination_flow',
      ].includes(record.id))
      .map(record => record.evidence);

    expect(evidence).toEqual([
      'Classifies current policy-builder surfaces as keep, rewrite, replace, delete, or bridge-only with durable product ownership.',
      'Defines the destination-first operator sequence from library context through save or defer.',
    ]);
  });

  test('fails active records with temporary roadmap artifact paths', () => {
    const result = validatePolicyAuthoringCompletionRecord({
      id: 'legacy_phase_doc',
      label: 'Legacy phase doc',
      docPath: 'docs/architecture/policy-builder-phase-3r-vue-example.md',
      testPath: 'client/src/__tests__/Example.test.js',
      evidence: 'Should fail because active completion records need durable artifact paths.',
    }, POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.CLIENT_WORKFLOW_COMPONENT);

    expect(result.issues).toEqual([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.TEMPORARY_ARTIFACT_PATH,
        field: 'docPath',
      }),
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
      'destination_context_before_template_suggestions',
      'observed_evidence_requires_acceptance',
      'hard_limits_explicit',
      'one_recommended_next_action',
      'retired_diagnostics_absent',
    ]);
    rules.forEach(rule => {
      expect(rule.docPath).toMatch(/^docs\/architecture\//);
      expect(rule.testPath).toMatch(/^client\/src\/__tests__\//);
      expect(rule.evidence).toBeTruthy();
    });
  });

  test('keeps diagnostics and bridge internals out of normal authoring', () => {
    const exclusions = listPolicyAuthoringNormalPathExclusions();

    expect(exclusions.map(exclusion => exclusion.scopeId)).toEqual([
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

  test('fails bridge exclusions that are allowed in normal authoring', () => {
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
