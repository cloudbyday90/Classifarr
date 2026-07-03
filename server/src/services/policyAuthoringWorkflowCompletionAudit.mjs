const POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS = Object.freeze({
  SERVER_CONTRACT: 'server_contract',
  VUE_REWRITE_SLICE: 'vue_rewrite_slice',
  NORMAL_WORKFLOW_RULE: 'normal_workflow_rule',
  NORMAL_PATH_EXCLUSION: 'normal_path_exclusion',
});

const POLICY_AUTHORING_COMPLETION_RISK_IDS = Object.freeze({
  MISSING_RECORD_ID: 'missing_record_id',
  MISSING_LABEL: 'missing_label',
  MISSING_DOC_PATH: 'missing_doc_path',
  MISSING_SERVICE_PATH: 'missing_service_path',
  MISSING_TEST_PATH: 'missing_test_path',
  MISSING_EVIDENCE: 'missing_evidence',
  UNKNOWN_ARTIFACT_KIND: 'unknown_artifact_kind',
  INVALID_EXCLUSION_SCOPE: 'invalid_exclusion_scope',
  INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH: 'internal_surface_allowed_in_normal_path',
});

const POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS = Object.freeze({
  NORMAL_PATH_FORBIDDEN: 'normal_path_forbidden',
  MIGRATION_VERIFIER_ONLY: 'migration_verifier_only',
  BRIDGE_ONLY: 'bridge_only',
  DELETE_AFTER_NATIVE_STORAGE: 'delete_after_native_storage',
});

const POLICY_AUTHORING_SERVER_CONTRACTS = Object.freeze([
  {
    id: 'policy_authoring_workflow_inventory',
    label: 'Policy authoring workflow inventory',
    docPath: 'docs/architecture/policy-authoring-workflow-inventory.md',
    servicePath: 'server/src/services/policyAuthoringWorkflowInventory.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringWorkflowInventory.test.mjs',
    evidence: 'Classifies current policy-builder surfaces as keep, rewrite, replace, delete, bridge-only, or verifier-only without phase-specific module names.',
  },
  {
    id: 'policy_authoring_destination_flow',
    label: 'Policy authoring destination flow',
    docPath: 'docs/architecture/policy-authoring-destination-flow.md',
    servicePath: 'server/src/services/policyAuthoringDestinationFlow.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringDestinationFlow.test.mjs',
    evidence: 'Defines the normal operator sequence from library context through save or defer without phase-specific module names.',
  },
  {
    id: 'policy_authoring_component_system',
    label: 'Policy authoring component system',
    docPath: 'docs/architecture/policy-authoring-component-system.md',
    servicePath: 'server/src/services/policyAuthoringComponentSystem.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringComponentSystem.test.mjs',
    evidence: 'Defines the policy-authoring component vocabulary, option sources, interaction rules, and accessibility rules before Vue rebuilds.',
  },
  {
    id: 'policy_authoring_option_selection',
    label: 'Policy authoring option selection',
    docPath: 'docs/architecture/policy-authoring-option-selection.md',
    servicePath: 'server/src/services/policyAuthoringOptionSelection.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringOptionSelection.test.mjs',
    evidence: 'Separates option sources, observed evidence, selectable suggestions, disabled choices, and typed add commands.',
  },
  {
    id: 'policy_authoring_constraints',
    label: 'Policy authoring constraints',
    docPath: 'docs/architecture/policy-authoring-constraints.md',
    servicePath: 'server/src/services/policyAuthoringConstraints.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringConstraints.test.mjs',
    evidence: 'Separates hard limits, avoid values, review warnings, certification semantics, and explicit operator-action requirements.',
  },
  {
    id: 'policy_authoring_readiness',
    label: 'Policy authoring readiness',
    docPath: 'docs/architecture/policy-authoring-readiness.md',
    servicePath: 'server/src/services/policyAuthoringReadiness.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringReadiness.test.mjs',
    evidence: 'Replaces dense diagnostics with action-oriented readiness states and one primary next action.',
  },
  {
    id: 'policy_authoring_starter_templates',
    label: 'Policy authoring starter templates',
    docPath: 'docs/architecture/policy-authoring-starter-templates.md',
    servicePath: 'server/src/services/policyAuthoringStarterTemplates.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringStarterTemplates.test.mjs',
    evidence: 'Keeps starter templates as optional accelerators after destination context.',
  },
  {
    id: 'policy_authoring_accessibility',
    label: 'Policy authoring accessibility',
    docPath: 'docs/architecture/policy-authoring-accessibility.md',
    servicePath: 'server/src/services/policyAuthoringAccessibility.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringAccessibility.test.mjs',
    evidence: 'Defines labels, helper text, keyboard, disabled reason, and one-primary-action requirements.',
  },
  {
    id: 'policy_authoring_presentation_tests',
    label: 'Policy authoring presentation tests',
    docPath: 'docs/architecture/policy-authoring-presentation-tests.md',
    servicePath: 'server/src/services/policyAuthoringPresentationTests.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringPresentationTests.test.mjs',
    evidence: 'Classifies presentation tests so they protect simplified workflow behavior instead of old diagnostics.',
  },
]);

const POLICY_AUTHORING_VUE_REWRITE_SLICES = Object.freeze([
  {
    id: 'policy_authoring_setup_cards',
    label: 'Policy authoring setup cards',
    docPath: 'docs/architecture/policy-authoring-setup-cards.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Renders four setup cards after library context and keeps verifier panels out of default workflow.',
  },
  {
    id: 'policy_authoring_destination_sections',
    label: 'Policy authoring destination sections',
    docPath: 'docs/architecture/policy-authoring-destination-sections.md',
    testPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    evidence: 'Splits review behavior, destination identity, destination rules, and confidence support anchors.',
  },
  {
    id: 'policy_authoring_review_triggers',
    label: 'Policy authoring review triggers',
    docPath: 'docs/architecture/policy-authoring-review-triggers.md',
    testPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    evidence: 'Adds Ask When Unsure review triggers through typed draft serialization.',
  },
  {
    id: 'policy_authoring_routing_readiness',
    label: 'Policy authoring routing readiness',
    docPath: 'docs/architecture/policy-authoring-routing-readiness.md',
    testPath: 'client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js',
    evidence: 'Projects selected-library routing context without executing routing or saving policy intent.',
  },
  {
    id: 'vue_setup_card_state_binding',
    label: 'Vue setup card state binding',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-setup-card-state-binding.md',
    testPath: 'client/src/__tests__/PolicyBuilderSetupCards.test.js',
    evidence: 'Derives setup progress from existing modal projections without new API calls or diagnostics.',
  },
  {
    id: 'vue_save_defer_action_boundary',
    label: 'Vue save and defer action boundary',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-save-defer-action-boundary.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Exposes save readiness, disabled reasons, and defer-without-saving while preserving event contracts.',
  },
  {
    id: 'vue_starter_template_accelerator',
    label: 'Vue starter template accelerator',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-starter-template-accelerator.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Makes starter templates optional accelerators collapsed behind an accessible disclosure.',
  },
  {
    id: 'vue_policy_authoring_accessibility_audit',
    label: 'Vue accessibility decision-load audit',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-accessibility-decision-load-audit.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Marks one recommended next action and routes setup links to existing targets.',
  },
  {
    id: 'vue_policy_authoring_presentation_tests',
    label: 'Vue policy authoring presentation tests',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-presentation-test-reset.md',
    testPath: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    evidence: 'Resets impact and replay preview tests around read-only verifier behavior, no execution, and opt-in gates.',
  },
]);

const POLICY_AUTHORING_NORMAL_WORKFLOW_RULES = Object.freeze([
  {
    id: 'destination_context_before_templates',
    label: 'Destination context appears before starter-template mechanics',
    docPath: 'docs/architecture/policy-authoring-destination-flow.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Normal workflow starts from library and destination meaning; templates are secondary.',
  },
  {
    id: 'observed_evidence_requires_acceptance',
    label: 'Observed evidence requires explicit acceptance before becoming intent',
    docPath: 'docs/architecture/policy-authoring-option-selection.md',
    testPath: 'client/src/__tests__/PolicyIntentGenreControl.test.js',
    evidence: 'Observed profile suggestions remain suggestions until typed draft commands accept them.',
  },
  {
    id: 'hard_limits_explicit',
    label: 'Hard limits require explicit operator action',
    docPath: 'docs/architecture/policy-authoring-constraints.md',
    testPath: 'client/src/__tests__/PolicyIntentCertificationControl.test.js',
    evidence: 'Blockers are separate from avoid hints and require explicit declared intent.',
  },
  {
    id: 'one_recommended_next_action',
    label: 'Readiness exposes one recommended next action',
    docPath: 'docs/architecture/policy-authoring-readiness.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Setup cards expose one current step with supporting status and completion context.',
  },
  {
    id: 'verifier_panels_not_default',
    label: 'Verifier panels are not default policy-authoring path',
    docPath: 'docs/architecture/policy-authoring-presentation-tests.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Impact and replay verifier panels are absent unless the explicit verifier prop is enabled.',
  },
]);

const POLICY_AUTHORING_NORMAL_PATH_EXCLUSIONS = Object.freeze([
  {
    id: 'impact_preview_panel',
    label: 'Intent impact preview panel',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
    evidence: 'Read-only verifier surface; not part of default policy authoring.',
  },
  {
    id: 'representative_replay_panel',
    label: 'Representative replay preview panel',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
    evidence: 'Read-only verifier surface with no execution; not part of default policy authoring.',
  },
  {
    id: 'provider_readiness_details',
    label: 'Provider readiness details',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
    evidence: 'Provider configuration and quota diagnostics belong outside normal policy authoring.',
  },
  {
    id: 'tmdb_coverage_details',
    label: 'TMDB coverage details',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
    evidence: 'Metadata coverage is diagnostic evidence, not normal policy setup copy.',
  },
  {
    id: 'raw_template_mechanics',
    label: 'Raw starter-template mechanics',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.BRIDGE_ONLY,
    evidence: 'Legacy weights, removed markers, and raw custom signals remain bridge-only.',
  },
  {
    id: 'legacy_policy_storage_shape',
    label: 'Legacy policy storage shape',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    evidence: 'Legacy preset/custom-signal storage remains compatible until native intent storage replacement.',
  },
]);

function validatePolicyAuthoringCompletionRecord(record = {}, artifactKindId) {
  const issues = [];

  if (!record.id) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
      artifactKindId,
      message: 'Policy authoring completion records must have a stable id.',
    });
  }

  if (!record.label) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_LABEL,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring completion records must have an operator-readable label.',
    });
  }

  if (!record.evidence) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring completion records must explain what proves the record.',
    });
  }

  if ([
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.VUE_REWRITE_SLICE,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE,
  ].includes(artifactKindId) && !record.docPath) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_DOC_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring implementation records must link to an architecture document.',
    });
  }

  if (artifactKindId === POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT && !record.servicePath) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring server contracts must link to the owning ESM service.',
    });
  }

  if ([
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.VUE_REWRITE_SLICE,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE,
  ].includes(artifactKindId) && !record.testPath) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_TEST_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring implementation records must link to a regression test.',
    });
  }

  if (artifactKindId === POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION) {
    if (!Object.values(POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS).includes(record.scopeId)) {
      issues.push({
        riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.INVALID_EXCLUSION_SCOPE,
        artifactKindId,
        recordId: record.id || null,
        message: 'Policy authoring exclusions must use an approved exclusion scope.',
      });
    }

    if (record.scopeId !== POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN &&
        record.normalAuthoringAllowed === true) {
      issues.push({
        riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH,
        artifactKindId,
        recordId: record.id || null,
        message: 'Verifier, bridge, and deletion-target surfaces cannot be allowed in normal authoring.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    artifactKindId,
    recordId: record.id || null,
    issues,
  };
}

function auditPolicyAuthoringCompletionRecords(records, artifactKindId) {
  if (!Object.values(POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS).includes(artifactKindId)) {
    return {
      ok: false,
      artifactKindId,
      checkedCount: 0,
      issueCount: 1,
      results: [{
        ok: false,
        artifactKindId,
        recordId: null,
        issues: [{
          riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.UNKNOWN_ARTIFACT_KIND,
          artifactKindId,
          message: 'Policy authoring completion audits must use an approved artifact kind.',
        }],
      }],
    };
  }

  const results = (Array.isArray(records) ? records : [])
    .map(record => validatePolicyAuthoringCompletionRecord(record, artifactKindId));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    artifactKindId,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function buildPolicyAuthoringWorkflowCompletionAudit({
  serverContracts = POLICY_AUTHORING_SERVER_CONTRACTS,
  vueRewriteSlices = POLICY_AUTHORING_VUE_REWRITE_SLICES,
  normalWorkflowRules = POLICY_AUTHORING_NORMAL_WORKFLOW_RULES,
  normalPathExclusions = POLICY_AUTHORING_NORMAL_PATH_EXCLUSIONS,
} = {}) {
  const serverContractAudit = auditPolicyAuthoringCompletionRecords(
    serverContracts,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT
  );
  const vueRewriteAudit = auditPolicyAuthoringCompletionRecords(
    vueRewriteSlices,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.VUE_REWRITE_SLICE
  );
  const normalWorkflowAudit = auditPolicyAuthoringCompletionRecords(
    normalWorkflowRules,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE
  );
  const normalPathExclusionAudit = auditPolicyAuthoringCompletionRecords(
    normalPathExclusions,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION
  );
  const issueCount = [
    serverContractAudit,
    vueRewriteAudit,
    normalWorkflowAudit,
    normalPathExclusionAudit,
  ].reduce((count, audit) => count + audit.issueCount, 0);

  return {
    ok: issueCount === 0,
    issueCount,
    checkedServerContractCount: serverContractAudit.checkedCount,
    checkedVueRewriteCount: vueRewriteAudit.checkedCount,
    checkedNormalWorkflowRuleCount: normalWorkflowAudit.checkedCount,
    checkedNormalPathExclusionCount: normalPathExclusionAudit.checkedCount,
    serverContractAudit,
    vueRewriteAudit,
    normalWorkflowAudit,
    normalPathExclusionAudit,
    nextStep: {
      stepId: 'policy_evidence_engine',
      label: 'Policy Evidence Engine',
      reason: 'Policy evidence can consume operator intent only after normal authoring, verifier-only surfaces, and bridge-only surfaces are separated.',
    },
  };
}

function listPolicyAuthoringCompletionArtifactPaths() {
  return [
    ...POLICY_AUTHORING_SERVER_CONTRACTS.flatMap(record => [
      record.docPath,
      record.servicePath,
      record.testPath,
    ]),
    ...POLICY_AUTHORING_VUE_REWRITE_SLICES.flatMap(record => [
      record.docPath,
      record.testPath,
    ]),
    ...POLICY_AUTHORING_NORMAL_WORKFLOW_RULES.flatMap(record => [
      record.docPath,
      record.testPath,
    ]),
  ];
}

function listPolicyAuthoringServerContracts() {
  return POLICY_AUTHORING_SERVER_CONTRACTS;
}

function listPolicyAuthoringVueRewriteSlices() {
  return POLICY_AUTHORING_VUE_REWRITE_SLICES;
}

function listPolicyAuthoringNormalWorkflowRules() {
  return POLICY_AUTHORING_NORMAL_WORKFLOW_RULES;
}

function listPolicyAuthoringNormalPathExclusions() {
  return POLICY_AUTHORING_NORMAL_PATH_EXCLUSIONS;
}

export {
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
};
